# Threat Config Integration Fixtures

This directory stores real Warcraft Logs fixtures used by config integration tests.

Each fixture directory contains:

- `metadata.json`
- `report.json`
- `fight-<fightId>-<fightName>-events.json`

Download a fixture:

```bash
pnpm --filter @wcl-threat/threat-config fixtures:download -- \
  --report-url "https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?fight=26&type=damage-done&source=19" \
  --name fresh/naxx
```

Run integration tests:

```bash
pnpm --filter @wcl-threat/threat-config test:integration
```

Generate a local threat debug report from fixtures (cache-first, auto-download when
missing):

```bash
pnpm --filter @wcl-threat/threat-config report:debug -- \
  --report "https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?fight=26&type=damage-done&source=19" \
  --enemy-id 203
```

Notes:

- `--report` must be a WCL URL containing both `fight` and `source` query params.
- `--enemy-id` is the enemy target actor.
- Writes by default to the fixture directory as `report-<player>-<boss>.txt`.
- Use `--stdout` to print to terminal instead of writing a file.
