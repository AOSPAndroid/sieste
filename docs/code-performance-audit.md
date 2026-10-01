# Sieste code and performance audit

Audited 1 October 2026 against the deployed dashboard, API routes, dependency lockfile and production browser manifest.

## Changes made

| Finding | Change |
| --- | --- |
| Homepage imported expanded metric/comparison charts and weekly charts before they were opened. | Split metric history, comparisons, expanded weekly volume and detailed load charts into on-demand modules. |
| The small homepage load chart pulled in the full charting library. | Render this overview with SVG; preserve missing gaps, recorded zero, the usual-level line, partial-today styling and hover/touch/keyboard readings. Expanded charts retain Recharts and their controls. |
| Daily load calculations repeatedly parsed the entire workout and body history for each date. | Index workouts by local day and latest resting-heart readings once per calculation. Keep provider separation, coverage rules and rolling windows. |
| 61 starter UI components and their utility/configuration were unreachable from every application entry. | Remove them and 18 unused runtime dependencies plus the unused animation development dependency. Update the lockfile and verify a clean install. |
| Six superseded display components and an unused sleep-time adapter were unreachable. | Remove those wrappers; retain the calculation modules used by active features and tests. |
| Unused imports, state, filters, sorts and reductions remained in active views. | Remove them and add a strict typecheck with unused-local and unused-parameter checks. |
| Expanded load hover used the obsolete Recharts `activePayload` event field. | Use Recharts 3's active tooltip index and verify the daily readout callback. |
| Retention tests referenced old adapters; three export tests wrote to a developer-specific Windows path. | Test retention through the real workout cache and write export artifacts to a portable temporary directory, optionally overridden with `SIESTE_TEST_ARTIFACTS`. |

## Measurements

Production manifest comparison, summing the browser entry and homepage's static JavaScript imports without counting on-demand views:

| Metric | Before | After |
| --- | ---: | ---: |
| Initial JavaScript, uncompressed | 924,356 bytes | 533,283 bytes |
| Initial JavaScript, gzip per file | 285,580 bytes | 170,225 bytes |

This is approximately 42% less initial JavaScript and 40% less compressed JavaScript. These are build measurements; they do not measure a user's network, authentication latency, API payload or end-to-end page load time. The framework still accounts for most remaining initial JavaScript.

A local calculation benchmark used 4,002 activity records, 2,000 body readings and a 90-day view. Median calculation time over eight runs fell from 1,348 ms to 15 ms on this execution machine. Results matched the previous implementation for both load and training time in UTC, Europe/Paris and America/New_York, including a daylight-saving boundary, missing readings, future records and invalid activity dates. This synthetic benchmark is not a claim about every user's dashboard timing.

## Retained code and next opportunities

- `app/daily-ring-data.ts` and `app/training-assessment.ts` are currently referenced by tests rather than application routes. Retain these small calculation modules as documented candidates for a later decision about those features.
- `db/schema.ts` and `db/index.ts` are outside the application route graph, but the schema, Drizzle configuration and migrations remain part of the database tooling. Database tables and migrations were preserved.
- The layered global styles include historical selectors. Static class-name searches cannot establish safety for all conditional views, chart classes and exported designs. A later CSS cleanup should collect coverage across all views and export layouts before removing selectors.
- Background refresh still transfers the complete dashboard snapshot. An authenticated revision/ETag check could avoid unchanged transfers; incremental history responses could further reduce large-account payloads. These require API and sync contract changes, beyond this cleanup.
- Overview week summaries and other advanced analyses still have repeated scans. Profile them with representative athlete data before broader rewrites; the daily load path was the verified expensive case fixed here.

## Repeatable checks

```sh
npm ci --ignore-scripts
npm run typecheck
npm run audit:code
npm run test:overview
npm run test:cache
npm run build
npm run audit:bundle
```

`audit:code` reports static reachability, including type references and literal dynamic imports. Its review candidates must be checked against tests and tooling before deletion. `audit:bundle` prevents expanded charts from moving back into the homepage's static import graph and enforces a 200,000-byte initial gzip JavaScript budget.

Additional regression checks cover retained pages, progressive sync, workout caching, provider merging, running technique, routes, COROS extended data and shared image rendering. Selected new modules pass ESLint. No live-browser load-time measurement was available for this audit.
