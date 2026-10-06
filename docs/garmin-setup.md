# Garmin setup

Updated 6 October 2026. Sieste prepares Garmin's official OAuth 2.0 connection lifecycle. **Garmin data sync is pending:** connecting an account does not yet import workouts, daily health, sleep or HRV. The existing Tredict, COROS and manual FIT paths continue to operate independently.

## Activate the connection

1. Apply for access to the [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/program-faq/). Garmin approval and app credentials are required; a personal Garmin Connect login alone cannot activate this integration.
2. In the approved developer portal, configure the app for the required Health and Activity API access. Register this exact redirect URI:

   ```text
   https://sieste.daaalil.chatgpt.site/api/garmin/callback
   ```

3. Set `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` as server runtime secrets for the deployed Sieste environment. Use the credentials issued for that approved app. Keep them out of source control, browser code, public build variables, logs and screenshots. The existing server storage and `TOKEN_ENCRYPTION_KEY` configuration are also required to store the connection securely.
4. Deploy the prepared OAuth routes with those runtime bindings, then open Sieste's Garmin connection card while signed in. Without both bindings, the card remains **Setup pending**.
5. Connect Garmin and review the Garmin-hosted consent screen. The intended permissions are `HEALTH_EXPORT` and `ACTIVITY_EXPORT`, subject to the app's approved entitlements and the user's consent. These are provider permission values, not a fixed OAuth `scope` string requested by Sieste. Check the granted permissions after authorization; absent permission must not be treated as consent.
6. Verify that the callback returns to Sieste and reports a connection. **A connected account still has data sync pending.** Do not treat a successful OAuth exchange as evidence that a data feed, historical import or health metric is available.

Use the [official OAuth 2.0 PKCE specification](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf) for the approved app configuration. Garmin's [official OAuth tool](https://apis.garmin.com/tools/oauth2/confirmUser) also identifies the current token service. Do not substitute an older token endpoint or an OAuth 1.0 integration guide.

## Prepared OAuth lifecycle

| Operation | Official endpoint |
| --- | --- |
| User authorization with PKCE S256 | `GET https://connect.garmin.com/oauth2Confirm` |
| Authorization-code exchange and refresh | `POST https://diauth.garmin.com/di-oauth2-service/oauth/token` |
| Stable Garmin user identity | `GET https://apis.garmin.com/wellness-api/rest/user/id` |
| Granted permissions | `GET https://apis.garmin.com/wellness-api/rest/user/permissions` |
| Deregister the user's app connection | `DELETE https://apis.garmin.com/wellness-api/rest/user/registration` |

Identity, permissions and deregistration use the user's bearer access token. The client secret and token exchanges stay on the server. The callback URI and provider endpoints are fixed; they are not supplied by the browser.

The prepared connection uses an owner-bound, one-use authorization state and PKCE verifier with a 10-minute lifetime. Pending authorization material and saved access/refresh tokens are encrypted with the existing server encryption key; tokens are not exposed through connection metadata. A stable Garmin user ID identifies the provider account and must not be attached to multiple Sieste owners.

Expired access tokens are refreshed on the server. Database leases and connection-revision checks prevent concurrent refreshes or a stale callback from replacing a newer connection. A shared authorization lease serializes callback finalization and provider deregistration. A reconnect creates a new connection revision; an ordinary token refresh retains it.

Disconnect invalidates pending authorization attempts first, then deregisters the user with Garmin before removing the saved local connection. A failed provider deregistration surfaces as an incomplete disconnect and retains the saved connection for retry. Changing to a different Garmin account requires disconnecting the previous account first. Rejected authorization attempts are cleaned up only when doing so cannot revoke another current account mapping or a newer authorization attempt. If that cleanup fails, Sieste explicitly asks the user to remove its connection in Garmin's connected apps before retrying.

Garmin is not yet an active source in dashboard sync or device-cache scope. Account-deletion, data-feed deregistration events and retained-data cleanup must be covered when those feeds are implemented.

## Data-feed work still pending

Public [Health API](https://developer.garmin.com/gc-developer-program/health-api/) and [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) pages describe the available programs, delivery options and backfill tools. Implementing them requires the approved app's current [portal specifications](https://developerportal.garmin.com/developer-programs/programs-docs), subscribed feeds and permissions. Their authenticated payload contracts, delivery authentication, retry behavior and backfill APIs have not been implemented in Sieste. Do not invent webhook fields, signatures or fetch routes from legacy examples.

Remaining provider integration checklist:

- **Normalize with provenance.** Map approved daily, sleep, HRV and activity payloads into the existing athlete model, retaining Garmin's external IDs, calendar date, timestamps, offsets, units and raw source. Keep missing values distinct from valid zero values. Verify sleep-duration, HRV and active/total-calorie definitions before displaying them; do not invent baselines or readiness values.
- **Make delivery idempotent.** Route the stable Garmin user ID to the correct connection. Handle duplicate notifications, out-of-order updates and reconnect revisions. A summary and its later FIT file must update one stable Garmin activity ID, preserving useful summaries when a file is unavailable. Reuse neutral FIT decoding and pause alignment while retaining Garmin provenance.
- **Bound and resume backfill.** Implement only documented, permitted feeds. Track date coverage and resumable progress, honor provider limits, and preserve already saved records during partial failures.
- **Preserve hybrid precedence and prevent duplicates.** Retain the existing Tredict/COROS merge behavior. Define Garmin precedence per health metric and an explicit activity identity/alias policy before merging recordings across providers; do not sum duplicate workouts or discard raw provider snapshots.
- **Support Garmin-only accounts.** Add authenticated sync, activity-detail routing and provider-neutral daily/sleep selectors without requiring Tredict or COROS. Treat unavailable feeds or denied permissions as missing data, not an empty successful import.
- **Invalidate caches and process account changes.** Include Garmin connection identity/revision in saved snapshots and device cache scope. Add documented permission-change and deregistration notifications, safe local cleanup, and user-visible partial/failure status.
- **Verify the integration.** Cover duplicate delivery, summary/FIT updates, hybrid duplicates, Garmin-only sync, denied permissions, missing/zero values, local midnight and offsets, token refresh races, reconnect/disconnect, resumable backfill and FIT pause/provenance regressions. Existing provider and import regressions must remain passing.
