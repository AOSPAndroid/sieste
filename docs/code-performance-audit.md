# Sieste code and performance audit

Updated 5 October 2026 against application and tooling references, the dependency lockfile, current full-screen editor and production browser manifest.

## Cleanup on 5 October 2026

The approved full-screen editor, active shared-image designs and current athlete calculations are preserved.

| Finding | Cleanup |
| --- | --- |
| The superseded inline/sticky share editor left heading, palette, preview-column, caption, grid and recommendation rules behind. | Remove 27 obsolete/duplicate CSS rules, retire legacy classes and sticky positioning, and keep the closed launcher’s appearance. |
| Every colour/thickness change generated the entire closed design gallery. | Generate gallery SVGs only while the Design tray is open. A closed-gallery colour change now produces 3 SVGs rather than 183 across 60 templates. |
| Two abandoned calculation modules and an unused starter mobile hook had no application callers. | Delete daily-ring-data, training-assessment and use-mobile, with the obsolete tests/configuration. |
| Active data modules retained unused exports for old recovery/workload, comparison, stress/device and provider-merging experiments. | Remove only exports without production callers; preserve active fatigue, sensor evidence, efficiency, FIT, provider and COROS calculations and their tests. |
| Old Tailwind vendor CSS and its license were unimported; favicon.svg duplicated the active icon. | Delete these three files. Keep installed-app icons, notification icons, all cinematic fonts, font licenses and the glyph generator. |
| Optional pnpm installer helpers were unused by this npm project. | Remove the unreferenced helper pair; retain the active npm install:ci scripts and framework build tooling. |
| The file audit omitted hooks and flagged intentional database tooling as unreachable app code. | Include hooks and distinguish framework/database/example entry points from web routes. The audited graph has 202 application-reachable sources, 10 tooling-only sources and no unreferenced files. |

### Verification and measurement

- A browser fixture runs the real ActivityShare and ShareCanvas, with the committed v253 editor and CSS frozen for comparison. Mobile (390px) and desktop (1280px) screenshots are pixel-identical after cleanup; closed-launcher geometry, pointer controls, all colour/finish choices, thickness, design selection and parent dialog interaction pass.
- Selected SVG and actual 2160 × 3840 transparent PNG bytes match the previous renderer. Opaque export also passes. The artwork, values and export dimensions are unchanged.
- Instrumented synchronous SVG construction for a sample closed-gallery colour update fell from 183 calls / 22.5 ms to 3 calls / 0.9 ms on this execution machine. This is a sample local render measurement, not a page-load or user-device timing promise.
- The 42 retained parser/calculation declarations in the affected helper modules are unchanged. Focused tests cover performance math, efficiency insights, sensor evidence, COROS records and extended readings, fatigue recovery, FIT import and provider syncing. Overview, share-design, strict TypeScript and whitespace checks pass.
- All declared packages still support application, migration, build or test workflows; no dependency was removed. The v253 initial browser JavaScript baseline is 561,468 bytes uncompressed / 180,521 gzip bytes. The final production build is checked against the existing 200,000-byte gzip budget. Unreachable repository-file removal alone is not a homepage-load improvement.
- Whole-repository ESLint is still failing: 519 errors and 49 warnings, compared with 538 errors and 49 warnings before this cleanup. Most remaining errors are explicit-any declarations (465) and hook rules. They are existing audit findings; rules were not weakened or suppressed. Strict TypeScript unused-local and unused-parameter checks pass. A broader typing/hooks refactor needs separate behavior checks.

Database schemas, migrations, the optional D1 example and getDb wrapper remain intentional tooling, rather than unused application features. Broader global CSS still includes conditional/chart styling; this cleanup removes only selectors verified against current callers and browser comparisons.

## Earlier optimization on 1 October 2026

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

- The test-only daily-ring-data and training-assessment candidates from the earlier audit were removed in the 5 October cleanup above.
- `db/schema.ts` and `db/index.ts` are outside the application route graph, but the schema, Drizzle configuration and migrations remain part of the database tooling. Database tables and migrations were preserved.
- Superseded sharing/recommendation selectors were removed and verified in the 5 October cleanup. Further CSS pruning should collect coverage across conditional views, chart classes and export layouts.
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

`audit:code` reports static reachability, including type references and literal dynamic imports, with intentional build/database/example entries separated from web routes. Its review candidates must be checked against tests and tooling before deletion. `audit:bundle` prevents expanded charts from moving back into the homepage's static import graph and enforces a 200,000-byte initial gzip JavaScript budget.

Additional regression checks cover retained pages, progressive sync, workout caching, provider merging, running technique, routes, COROS extended data and shared image rendering. Selected new modules pass ESLint. No live-browser load-time measurement was available for this audit.
