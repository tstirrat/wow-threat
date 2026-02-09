# Threat Config Era Parity TODO

Legend:

- `Priority`: `P0` critical engine parity, `P1` major parity gaps, `P2` polish/advanced mechanics
- `Complexity`: `1` low, `2` medium-low, `3` medium, `4` high, `5` very high
- `Requirement Code`: `REQ-###` unique ID for cross-reference

## P0 - Core Engine Semantics

- [x] **[REQ-001][P0][C4]** Implement missing `ThreatSpecial` runtime behaviors (`taunt`, `fixate*`, `aggroLoss*`, `invulnerable*`) and wire config sets into output/state.
- [x] **[REQ-002][P0][C4]** Implement `taunt` special semantics in the engine (set to top threat + bonus, not flat add).
- [x] **[REQ-003][P0][C3]** Wire runtime handling for `fixate`, `fixateEnd`, `aggroLoss`, `aggroLossEnd`, `invulnerable`, `invulnerableEnd`.
- [x] **[REQ-004][P0][C1]** Remove `noThreatWindow` special from the contract (deprecated).
- [ ] **[REQ-005][P0][C3]** Allow effect handlers to pass `augment.special` through to core threat application (today only `threatRecipientOverride` is used).
- [x] **[REQ-006][P0][C2]** Support negative threat deltas (Feint/Cower/Disengage-style) with floor-at-zero semantics.
- [ ] **[REQ-007][P0][C3]** Add per-formula control for applying multipliers/coefs (Era has both coeff and no-coeff variants, e.g. `handler_castCanMissNoCoefficient`, `handler_resourcechange`).
- [ ] **[REQ-008][P0][C3]** Implement true cast-can-miss two-phase behavior (add on cast, rollback on miss/immune/resist result), not static one-shot.
- [x] **[REQ-009][P0][C3]** Enforce school-specific modifiers in runtime (and pass spell school through context).
- [x] **[REQ-010][P0][C3]** Enforce school-scoped modifiers at runtime (`ThreatModifier.schools` exists but is not applied).
- [x] **[REQ-011][P0][C3]** Carry spell school in event/context so school-based talents (Mage/Priest/Paladin holy-only) can be evaluated correctly.
- [ ] **[REQ-012][P0][C5]** Expand custom handler surface to Era parity: pre/global handlers, handler-composition, and safe aura/threat state mutation from handlers.

## P0 - Event Ingestion and Formula Triggering

- [x] **[REQ-013][P0][C4]** Add full event-type coverage used by Era handlers (`refreshbuff`, `refreshdebuff`, stack variants, etc.) in types + processing.
- [x] **[REQ-014][P0][C3]** Process aura event types needed by Era mechanics: `refreshbuff`, `refreshdebuff`, stack variants (`applybuffstack`, `applydebuffstack`, etc.).
- [x] **[REQ-015][P0][C4]** Make ability formulas trigger on the same event phases as Era (`applybuff/debuff`, refresh, cast, damage), not only current threat-calculated types.
- [x] **[REQ-016][P0][C3]** Let formulas run on `applybuff`/`applydebuff`/refresh/stack events, not just `damage/heal/energize/cast`.

## P1 - State Model and Inference Parity

- [x] **[REQ-017][P1][C4]** Add Era-style `combatantImplications` + talent-rank pipeline (not just `gearImplications`).
- [x] **[REQ-018][P1][C3]** Add class `combatantImplications` hooks (all/class) to infer synthetic auras/talent ranks from combatant info beyond gear-only logic.
- [x] **[REQ-019][P1][C4]** Add cast-driven aura inference (`auraImplications`) for stance/form inference parity.
- [x] **[REQ-020][P1][C3]** Add `auraImplications` (cast -> inferred aura) for stance/form inference parity.
- [x] **[REQ-021][P1][C4]** Support threat tracking by enemy instance (not only enemy ID) for parity with multi-instance mechanics.
- [x] **[REQ-022][P1][C4]** Add target/instance-aware state needed for advanced raid mechanics (e.g., magnetic pull-style behavior).

## P1 - Encounter and Behavior Parity

- [ ] **[REQ-023][P1][C3]** Add encounter-level preprocessor hook for synthetic/custom injected events (Era uses synthetic `-1` casts for Arlokk).
- [ ] **[REQ-024][P1][C2]** Add optional split-threat policy controls (Era has split-heal toggle + special enemy exclusions).

## P2 - Config Completion and Validation

- [ ] **[REQ-025][P2][C3]** After engine gaps above, port remaining class-level mechanics now marked TODO in Anniversary config (mage/priest/shaman/druid/warlock talent/handler gaps).
- [ ] **[REQ-026][P2][C3]** Expand tests to cover remaining runtime semantics above (notably aggro-loss state coverage).
