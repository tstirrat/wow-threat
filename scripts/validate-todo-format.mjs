#!/usr/bin/env node

/**
 * Validates agent task card format in TODO.md.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredKeys = [
  'id',
  'title',
  'package',
  'status',
  'priority',
  'size',
  'depends_on',
  'files_hint',
  'acceptance_criteria',
  'validation',
  'branch_name',
  'worktree_path',
  'publish',
  'pr_url',
  'commit_sha',
]

const statusValues = new Set([
  'DISCOVERY',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
])
const priorityValues = new Set(['P0', 'P1', 'P2', 'P3'])
const sizeValues = new Set(['XS', 'S', 'M', 'L'])
const packageValues = new Set([
  '@wow-threat/api',
  '@wow-threat/web',
  '@wow-threat/engine',
  '@wow-threat/config',
  '@wow-threat/shared',
  '@wow-threat/wcl-types',
])

const fileArg = process.argv[2] ?? 'TODO.md'
const filePath = resolve(process.cwd(), fileArg)
const markdown = readFileSync(filePath, 'utf8')

const yamlBlocks = [...markdown.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map(
  (match) => match[1],
)

if (yamlBlocks.length === 0) {
  console.error(`No YAML task cards found in ${filePath}`)
  process.exit(1)
}

const parseYamlBlock = (block, blockNumber) => {
  const parsed = {}
  let listKey = null

  block.split('\n').forEach((line, lineNumber) => {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return
    }

    const keyMatch = line.match(/^([a-z_]+):\s*(.*)$/)
    if (keyMatch) {
      const key = keyMatch[1]
      const rawValue = keyMatch[2].trim()
      listKey = null

      if (rawValue === '') {
        parsed[key] = []
        listKey = key
        return
      }

      if (rawValue === '[]') {
        parsed[key] = []
        return
      }

      if (rawValue === 'null') {
        parsed[key] = null
        return
      }

      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const inner = rawValue.slice(1, -1).trim()
        parsed[key] =
          inner.length === 0
            ? []
            : inner
                .split(',')
                .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
        return
      }

      parsed[key] = rawValue.replace(/^['"]|['"]$/g, '')
      return
    }

    const listMatch = line.match(/^  - (.*)$/)
    if (listMatch && listKey) {
      parsed[listKey].push(listMatch[1].trim().replace(/^['"]|['"]$/g, ''))
      return
    }

    throw new Error(
      `Block ${blockNumber}: unsupported line ${lineNumber + 1}: ${line}`,
    )
  })

  return parsed
}

const cards = yamlBlocks.map((block, index) => parseYamlBlock(block, index + 1))

const errors = []
const seenIds = new Set()

cards.forEach((card, index) => {
  const context = `Card ${index + 1}${card.id ? ` (${card.id})` : ''}`

  requiredKeys.forEach((key) => {
    if (!(key in card)) {
      errors.push(`${context}: missing required key '${key}'`)
    }
  })

  if (card.id) {
    if (seenIds.has(card.id)) {
      errors.push(`${context}: duplicate id '${card.id}'`)
    }
    seenIds.add(card.id)
  }

  if (card.package && !packageValues.has(card.package)) {
    errors.push(`${context}: invalid package '${card.package}'`)
  }

  if (card.status && !statusValues.has(card.status)) {
    errors.push(`${context}: invalid status '${card.status}'`)
  }

  if (card.priority && !priorityValues.has(card.priority)) {
    errors.push(`${context}: invalid priority '${card.priority}'`)
  }

  if (card.size && !sizeValues.has(card.size)) {
    errors.push(`${context}: invalid size '${card.size}'`)
  }

  if (card.publish && card.publish !== 'auto_push_pr') {
    errors.push(`${context}: invalid publish mode '${card.publish}'`)
  }

  if (typeof card.branch_name === 'string') {
    if (!/^codex\/[a-z0-9-]+$/.test(card.branch_name)) {
      errors.push(`${context}: invalid branch_name '${card.branch_name}'`)
    }
  }

  if (typeof card.worktree_path === 'string') {
    if (!/^\.\.\/wow-threat-[a-z0-9-]+$/.test(card.worktree_path)) {
      errors.push(`${context}: invalid worktree_path '${card.worktree_path}'`)
    }
  }

  const listFields = [
    'depends_on',
    'files_hint',
    'acceptance_criteria',
    'validation',
  ]
  listFields.forEach((field) => {
    if (!(field in card)) {
      return
    }
    if (!Array.isArray(card[field])) {
      errors.push(`${context}: '${field}' must be a YAML list`)
    }
  })

  if (card.status === 'READY') {
    if (
      !Array.isArray(card.acceptance_criteria) ||
      card.acceptance_criteria.length === 0
    ) {
      errors.push(`${context}: READY tasks must include acceptance_criteria`)
    }
    if (!Array.isArray(card.validation) || card.validation.length === 0) {
      errors.push(`${context}: READY tasks must include validation commands`)
    }
  }
})

if (errors.length > 0) {
  console.error(`TODO format validation failed (${errors.length} errors):`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`TODO format validation passed (${cards.length} task cards)`)
