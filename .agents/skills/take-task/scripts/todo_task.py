#!/usr/bin/env python3
"""
Select, claim, and complete TODO task cards for the take-task skill.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

PRIORITY_ORDER = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
SIZE_ORDER = {'XS': 0, 'S': 1, 'M': 2, 'L': 3}
MAX_CLAIM_ATTEMPTS = 16
DEFAULT_STALE_SECONDS = 6 * 60 * 60


@dataclass
class TaskCard:
  id: str
  title: str
  status: str
  priority: str
  size: str
  depends_on: list[str]
  branch_name: str | None
  worktree_path: str | None
  yaml_start: int
  yaml_end: int
  yaml_text: str


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description='Operate on task cards in TODO.md for take-task workflow.',
  )
  parser.add_argument(
    '--todo',
    default='',
    help='Path to TODO file (defaults to TODO.md, then todo.md).',
  )
  parser.add_argument(
    '--claims-dir',
    default='',
    help='Optional shared claims directory override.',
  )
  parser.add_argument(
    '--stale-seconds',
    type=int,
    default=DEFAULT_STALE_SECONDS,
    help='Reap missing/non-worktree claims older than this age in seconds.',
  )

  subparsers = parser.add_subparsers(dest='command', required=True)
  subparsers.add_parser('next', help='Print next eligible READY task.')
  subparsers.add_parser('claim', help='Claim next eligible task with shared lease file.')
  subparsers.add_parser('reap', help='Reap stale task lease files for missing worktrees.')

  complete_parser = subparsers.add_parser(
    'complete',
    help='Update task status; DONE archives from open sections to historical IDs.',
  )
  complete_parser.add_argument('--id', required=True, help='Task ID, for example WEB-014.')
  complete_parser.add_argument(
    '--status',
    default='DONE',
    help='Target status value (default: DONE).',
  )
  complete_parser.add_argument(
    '--pr-url',
    default=None,
    help='Optional PR URL to store in pr_url.',
  )
  complete_parser.add_argument(
    '--commit-sha',
    default=None,
    help='Optional commit SHA to store in commit_sha.',
  )

  return parser.parse_args()


def normalize_scalar(value: str) -> str | None | list[str]:
  value = value.strip()
  if value == 'null':
    return None
  if value == '[]':
    return []
  if (value.startswith("'") and value.endswith("'")) or (
    value.startswith('"') and value.endswith('"')
  ):
    return value[1:-1]
  return value


def parse_yaml_block(yaml_text: str) -> dict[str, object]:
  parsed: dict[str, object] = {}
  lines = yaml_text.splitlines()
  index = 0

  while index < len(lines):
    line = lines[index]
    if not line.strip():
      index += 1
      continue

    match = re.match(r'^([a-z_]+):(?:\s*(.*))?$', line)
    if not match:
      index += 1
      continue

    key = match.group(1)
    value = (match.group(2) or '').strip()

    if value == '':
      list_items: list[str] = []
      lookahead = index + 1
      while lookahead < len(lines):
        list_match = re.match(r'^\s+-\s+(.*)$', lines[lookahead])
        if not list_match:
          break
        list_items.append(list_match.group(1).strip())
        lookahead += 1
      parsed[key] = list_items
      index = lookahead
      continue

    parsed[key] = normalize_scalar(value)
    index += 1

  return parsed


def resolve_todo_path(path_arg: str) -> Path:
  candidates = [Path(path_arg)] if path_arg else [Path('TODO.md'), Path('todo.md')]
  for candidate in candidates:
    if candidate.exists():
      return candidate
  options = ', '.join(str(path) for path in candidates)
  raise SystemExit(f'Could not find TODO file. Checked: {options}')


def parse_historical_done_ids(text: str) -> set[str]:
  match = re.search(
    r'## Historical Completed IDs\s*\n(?P<body>.*?)(?=\n## |\Z)',
    text,
    flags=re.DOTALL,
  )
  if not match:
    return set()

  done_ids: set[str] = set()
  for line in match.group('body').splitlines():
    bullet = re.match(r'^\s*-\s+([A-Z]+-\d+)\s*$', line)
    if bullet:
      done_ids.add(bullet.group(1))
  return done_ids


def add_historical_done_id(text: str, task_id: str) -> str:
  match = re.search(
    r'## Historical Completed IDs\s*\n(?P<body>.*?)(?=\n## |\Z)',
    text,
    flags=re.DOTALL,
  )
  if not match:
    return text

  body = match.group('body')
  done_ids = parse_historical_done_ids(text)
  if task_id in done_ids:
    return text

  new_body = body.rstrip('\n')
  if new_body:
    new_body = f'{new_body}\n'
  new_body = f'{new_body}- {task_id}\n'

  return f'{text[:match.start("body")]}{new_body}{text[match.end("body") :]}'


def parse_task_cards(text: str) -> list[TaskCard]:
  cards: list[TaskCard] = []
  for match in re.finditer(r'```yaml\n(.*?)\n```', text, flags=re.DOTALL):
    yaml_text = match.group(1)
    parsed = parse_yaml_block(yaml_text)
    if 'id' not in parsed or 'status' not in parsed:
      continue

    task_id = str(parsed.get('id', '')).strip()
    if not task_id:
      continue

    depends_on = parsed.get('depends_on', [])
    if not isinstance(depends_on, list):
      depends_on = []

    cards.append(
      TaskCard(
        id=task_id,
        title=str(parsed.get('title', '') or ''),
        status=str(parsed.get('status', '') or ''),
        priority=str(parsed.get('priority', '') or ''),
        size=str(parsed.get('size', '') or ''),
        depends_on=[str(item) for item in depends_on],
        branch_name=(
          None if parsed.get('branch_name') is None else str(parsed.get('branch_name'))
        ),
        worktree_path=(
          None
          if parsed.get('worktree_path') is None
          else str(parsed.get('worktree_path'))
        ),
        yaml_start=match.start(1),
        yaml_end=match.end(1),
        yaml_text=yaml_text,
      ),
    )

  return cards


def slugify(text: str) -> str:
  slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
  return re.sub(r'-{2,}', '-', slug)


def task_branch_name(task: TaskCard) -> str:
  if task.branch_name:
    return task.branch_name
  title_slug = slugify(task.title)
  return f'codex/{task.id.lower()}-{title_slug}' if title_slug else f'codex/{task.id.lower()}'


def task_worktree_path(task: TaskCard) -> str:
  if task.worktree_path:
    return task.worktree_path
  return f'../wow-threat-{task.id.lower()}'


def resolve_repo_root(start_dir: Path) -> Path:
  result = subprocess.run(
    ['git', 'rev-parse', '--show-toplevel'],
    cwd=start_dir,
    capture_output=True,
    text=True,
  )
  if result.returncode != 0:
    raise SystemExit('Failed to resolve git repo root. Run from inside a git repository.')
  return Path(result.stdout.strip()).resolve()


def resolve_git_common_dir(repo_root: Path) -> Path:
  result = subprocess.run(
    ['git', 'rev-parse', '--git-common-dir'],
    cwd=repo_root,
    capture_output=True,
    text=True,
  )
  if result.returncode != 0:
    raise SystemExit('Failed to resolve git common dir for claim coordination.')

  common_dir_raw = result.stdout.strip()
  common_dir = Path(common_dir_raw)
  if not common_dir.is_absolute():
    common_dir = (repo_root / common_dir).resolve()
  return common_dir


def resolve_codex_home() -> Path:
  codex_home = os.environ.get('CODEX_HOME', '').strip()
  if codex_home:
    return Path(codex_home).expanduser().resolve()
  return (Path.home() / '.codex').resolve()


def resolve_claims_dir(repo_root: Path, claims_dir_arg: str) -> Path:
  if claims_dir_arg:
    claims_dir = Path(claims_dir_arg).expanduser().resolve()
    claims_dir.mkdir(parents=True, exist_ok=True)
    return claims_dir

  codex_home = resolve_codex_home()
  common_dir = resolve_git_common_dir(repo_root)
  repo_name = slugify(common_dir.parent.name or 'repo')
  repo_key = hashlib.sha1(str(common_dir).encode('utf-8')).hexdigest()[:12]
  claims_dir = codex_home / 'task-claims' / f'{repo_name}-{repo_key}'
  claims_dir.mkdir(parents=True, exist_ok=True)
  return claims_dir


def resolve_worktree_path(repo_root: Path, task: TaskCard) -> Path:
  configured = Path(task_worktree_path(task)).expanduser()
  if configured.is_absolute():
    return configured.resolve()
  return (repo_root / configured).resolve()


def claim_file_for_task(claims_dir: Path, task_id: str) -> Path:
  return claims_dir / f'{task_id}.claim'


def is_valid_worktree_path(path: Path) -> bool:
  return path.exists() and (path / '.git').exists()


def read_claim_path(claim_file: Path) -> Path | None:
  try:
    raw = claim_file.read_text().strip()
  except OSError:
    return None

  if not raw:
    return None

  parsed = Path(raw).expanduser()
  return parsed if parsed.is_absolute() else parsed.resolve()


def claim_age_seconds(claim_file: Path) -> float:
  try:
    return max(0.0, time.time() - claim_file.stat().st_mtime)
  except OSError:
    return float('inf')


def reap_stale_claims(
  claims_dir: Path,
  stale_seconds: int,
) -> tuple[dict[str, Path], list[Path]]:
  active_claims: dict[str, Path] = {}
  removed_claims: list[Path] = []

  for claim_file in sorted(claims_dir.glob('*.claim')):
    task_id = claim_file.stem
    claimed_worktree = read_claim_path(claim_file)

    if claimed_worktree is None:
      try:
        claim_file.unlink()
        removed_claims.append(claim_file)
      except OSError:
        continue
      continue

    if not is_valid_worktree_path(claimed_worktree):
      if claim_age_seconds(claim_file) <= stale_seconds:
        # Keep fresh leases active while the claimant creates the worktree.
        active_claims[task_id] = claimed_worktree
        continue

      try:
        claim_file.unlink()
        removed_claims.append(claim_file)
      except OSError:
        continue
      continue

    active_claims[task_id] = claimed_worktree

  return active_claims, removed_claims


def create_claim_file(claim_file: Path, worktree_path: Path) -> bool:
  flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
  try:
    file_descriptor = os.open(claim_file, flags)
  except FileExistsError:
    return False

  with os.fdopen(file_descriptor, 'w', encoding='utf-8') as handle:
    handle.write(f'{worktree_path}\n')

  return True


def choose_next_task(
  cards: list[TaskCard],
  done_ids: set[str],
  claimed_ids: set[str],
) -> TaskCard | None:
  ready_cards = [
    card
    for card in cards
    if card.status == 'READY'
    and card.id not in claimed_ids
    and all(dependency in done_ids for dependency in card.depends_on)
  ]

  if not ready_cards:
    return None

  return sorted(
    ready_cards,
    key=lambda card: (
      PRIORITY_ORDER.get(card.priority, 99),
      SIZE_ORDER.get(card.size, 99),
      card.id,
    ),
  )[0]


def set_yaml_scalar(yaml_text: str, key: str, value: str) -> str:
  replacement = f'{key}: {value}'
  pattern = re.compile(rf'^{re.escape(key)}:\s*.*$', flags=re.MULTILINE)
  if pattern.search(yaml_text):
    return pattern.sub(replacement, yaml_text, count=1)
  suffix = '' if yaml_text.endswith('\n') else '\n'
  return f'{yaml_text}{suffix}{replacement}\n'


def quote_yaml_string(value: str) -> str:
  escaped = value.replace('"', '\\"')
  return f'"{escaped}"'


def replace_card_yaml(text: str, card: TaskCard, new_yaml: str) -> str:
  return f'{text[:card.yaml_start]}{new_yaml}{text[card.yaml_end:]}'


def update_task_index_status(text: str, task_id: str, status: str) -> str:
  lines = text.splitlines(keepends=True)
  in_open_index = False

  for idx, line in enumerate(lines):
    if line.startswith('## Task Index (Open)'):
      in_open_index = True
      continue

    if in_open_index and line.startswith('## ') and not line.startswith('## Task Index (Open)'):
      break

    if not in_open_index or not line.lstrip().startswith('|'):
      continue

    cells = line.split('|')
    if len(cells) < 8:
      continue

    row_id = cells[1].strip()
    if row_id != task_id:
      continue

    cells[3] = f' {status:<11} '
    lines[idx] = '|'.join(cells)
    break

  return ''.join(lines)


def remove_task_index_row(text: str, task_id: str) -> str:
  lines = text.splitlines(keepends=True)
  in_open_index = False

  for idx, line in enumerate(lines):
    if line.startswith('## Task Index (Open)'):
      in_open_index = True
      continue

    if in_open_index and line.startswith('## ') and not line.startswith('## Task Index (Open)'):
      break

    if not in_open_index or not line.lstrip().startswith('|'):
      continue

    cells = line.split('|')
    if len(cells) < 8:
      continue

    row_id = cells[1].strip()
    if row_id != task_id:
      continue

    del lines[idx]
    break

  return ''.join(lines)


def remove_task_card(text: str, task_id: str) -> str:
  section_match = re.search(r'^## Task Cards \(Open\)\s*$', text, flags=re.MULTILINE)
  if not section_match:
    return text

  section_start = section_match.end()
  next_section = re.search(r'^\s*##\s+', text[section_start:], flags=re.MULTILINE)
  section_end = (
    section_start + next_section.start() if next_section is not None else len(text)
  )

  section_text = text[section_start:section_end]
  card_pattern = re.compile(
    rf'(?ms)^###\s+{re.escape(task_id)}\s+-.*?\n```yaml\n.*?\n```\n*',
  )
  updated_section_text = card_pattern.sub('', section_text, count=1)
  return f'{text[:section_start]}{updated_section_text}{text[section_end:]}'


def print_task(
  card: TaskCard,
  claims_dir: Path,
  claim_file: Path | None = None,
) -> None:
  print(f'id={card.id}')
  print(f'title={card.title}')
  print(f'status={card.status}')
  print(f'priority={card.priority}')
  print(f'size={card.size}')
  print(f'branch_name={task_branch_name(card)}')
  print(f'worktree_path={task_worktree_path(card)}')
  print(f'claims_dir={claims_dir}')
  if claim_file is not None:
    print(f'claim_file={claim_file}')


def command_next(todo_path: Path, claims_dir: Path, stale_seconds: int) -> int:
  text = todo_path.read_text()
  cards = parse_task_cards(text)
  done_ids = parse_historical_done_ids(text) | {card.id for card in cards if card.status == 'DONE'}
  active_claims, _ = reap_stale_claims(claims_dir, stale_seconds=stale_seconds)
  next_card = choose_next_task(cards, done_ids, set(active_claims.keys()))

  if not next_card:
    print('No eligible READY unclaimed task found.', file=sys.stderr)
    return 2

  print_task(next_card, claims_dir=claims_dir)
  return 0


def command_claim(
  todo_path: Path,
  repo_root: Path,
  claims_dir: Path,
  stale_seconds: int,
) -> int:
  for _ in range(MAX_CLAIM_ATTEMPTS):
    active_claims, _ = reap_stale_claims(claims_dir, stale_seconds=stale_seconds)

    text = todo_path.read_text()
    cards = parse_task_cards(text)
    done_ids = parse_historical_done_ids(text) | {
      card.id for card in cards if card.status == 'DONE'
    }
    next_card = choose_next_task(cards, done_ids, set(active_claims.keys()))

    if not next_card:
      print('No eligible READY unclaimed task found.', file=sys.stderr)
      return 2

    claim_file = claim_file_for_task(claims_dir, next_card.id)
    worktree_path = resolve_worktree_path(repo_root, next_card)

    if not create_claim_file(claim_file, worktree_path):
      continue

    updated_yaml = set_yaml_scalar(next_card.yaml_text, 'status', 'IN_PROGRESS')
    updated_text = replace_card_yaml(text, next_card, updated_yaml)
    updated_text = update_task_index_status(updated_text, next_card.id, 'IN_PROGRESS')
    todo_path.write_text(updated_text)

    claimed_card = TaskCard(
      id=next_card.id,
      title=next_card.title,
      status='IN_PROGRESS',
      priority=next_card.priority,
      size=next_card.size,
      depends_on=next_card.depends_on,
      branch_name=next_card.branch_name,
      worktree_path=next_card.worktree_path,
      yaml_start=next_card.yaml_start,
      yaml_end=next_card.yaml_end,
      yaml_text=updated_yaml,
    )
    print_task(claimed_card, claims_dir=claims_dir, claim_file=claim_file)
    return 0

  print('Could not claim a task due to concurrent claim races. Retry.', file=sys.stderr)
  return 3


def command_complete(
  todo_path: Path,
  claims_dir: Path,
  stale_seconds: int,
  task_id: str,
  status: str,
  pr_url: str | None,
  commit_sha: str | None,
) -> int:
  text = todo_path.read_text()
  cards = parse_task_cards(text)
  target = next((card for card in cards if card.id == task_id), None)

  if target is None:
    if status == 'DONE' and task_id in parse_historical_done_ids(text):
      print(f'id={task_id}')
      print('status=DONE')
      print(f'claims_dir={claims_dir}')
      return 0

    print(f'Task not found: {task_id}', file=sys.stderr)
    return 1

  if status == 'DONE':
    updated_text = remove_task_card(text, target.id)
    updated_text = remove_task_index_row(updated_text, target.id)
    updated_text = add_historical_done_id(updated_text, target.id)
    updated_yaml = target.yaml_text
  else:
    updated_yaml = set_yaml_scalar(target.yaml_text, 'status', status)
    if pr_url is not None:
      updated_yaml = set_yaml_scalar(updated_yaml, 'pr_url', quote_yaml_string(pr_url))
    if commit_sha is not None:
      updated_yaml = set_yaml_scalar(updated_yaml, 'commit_sha', quote_yaml_string(commit_sha))

    updated_text = replace_card_yaml(text, target, updated_yaml)
    updated_text = update_task_index_status(updated_text, target.id, status)

  todo_path.write_text(updated_text)

  # Keep claim files until the worktree disappears.
  reap_stale_claims(claims_dir, stale_seconds=stale_seconds)

  completed_card = TaskCard(
    id=target.id,
    title=target.title,
    status=status,
    priority=target.priority,
    size=target.size,
    depends_on=target.depends_on,
    branch_name=target.branch_name,
    worktree_path=target.worktree_path,
    yaml_start=target.yaml_start,
    yaml_end=target.yaml_end,
    yaml_text=updated_yaml,
  )
  print_task(completed_card, claims_dir=claims_dir)
  return 0


def command_reap(claims_dir: Path, stale_seconds: int) -> int:
  active_claims, removed_claims = reap_stale_claims(claims_dir, stale_seconds=stale_seconds)
  print(f'claims_dir={claims_dir}')
  print(f'removed={len(removed_claims)}')
  print(f'active={len(active_claims)}')
  for claim_file in removed_claims:
    print(f'removed_claim={claim_file}')
  for task_id, worktree_path in sorted(active_claims.items()):
    print(f'active_claim={task_id}:{worktree_path}')
  return 0


def main() -> int:
  args = parse_args()
  todo_path = resolve_todo_path(args.todo)
  repo_root = resolve_repo_root(Path.cwd())
  claims_dir = resolve_claims_dir(repo_root, args.claims_dir)

  if args.command == 'next':
    return command_next(
      todo_path=todo_path,
      claims_dir=claims_dir,
      stale_seconds=args.stale_seconds,
    )

  if args.command == 'claim':
    return command_claim(
      todo_path=todo_path,
      repo_root=repo_root,
      claims_dir=claims_dir,
      stale_seconds=args.stale_seconds,
    )

  if args.command == 'complete':
    return command_complete(
      todo_path=todo_path,
      claims_dir=claims_dir,
      stale_seconds=args.stale_seconds,
      task_id=args.id,
      status=args.status,
      pr_url=args.pr_url,
      commit_sha=args.commit_sha,
    )

  if args.command == 'reap':
    return command_reap(claims_dir=claims_dir, stale_seconds=args.stale_seconds)

  print(f'Unknown command: {args.command}', file=sys.stderr)
  return 1


if __name__ == '__main__':
  raise SystemExit(main())
