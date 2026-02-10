# Threat Config Integration Fixtures

This directory stores real Warcraft Logs fixtures used by config integration tests.

Each fixture directory contains:

- `metadata.json`
- `report.json`
- `events.json`

Download a fixture:

```bash
pnpm --filter @wcl-threat/threat-config fixtures:download -- \
  --host fresh \
  --report f9yPamzBxQqhGndZ \
  --fight 26 \
  --name anniversary/naxx/patchwerk-fight-26
```

Run integration tests:

```bash
pnpm --filter @wcl-threat/threat-config test:integration
```
