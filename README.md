# Train Delay Intelligence

> **Documentation update — 28 September 2026**
>
> The current implementation status and dated change record below document the RailETA frontend, FastAPI backend, live-provider integration, frontend-to-backend connections, and remaining work.

Railway operations dashboard for live train position, scheduled versus actual timing, delay attribution, confidence scoring, and route visibility.

The project has a Python FastAPI backend and a React/Vite frontend. It can work with seeded JSON files, trusted payload ingestion, or a compatible external live train API.

## Work Completed — 28 September 2026

The following frontend work is complete. These changes use the existing APIs and app state; they do not add endpoints, alter backend/ML behavior, or add polling.

### Home and Live Search

- Removed the train-number/name field from the Home hero. The Home hero remains focused on the existing live From/To station search, station autocomplete, and date display.
- Removed the global header train-number input. Train lookup is available through the navbar's Live Search panel, which searches by train number or train name.
- Live Search autocomplete calls the existing provider-backed train lookup API, waits briefly between keystrokes, displays loading and API error states, and does not fall back to a hardcoded train list.
- Selecting a returned train or submitting a matching train number opens the existing Live Service detail view and calls the existing manual train-sync flow. Search-by-name requires choosing an API suggestion when the query is ambiguous.
- The detail history entry is contextual: Back to Live Trains returns to the Live Trains list, and browser Back/Forward follows the app's history state. The existing Live Trains list stays mounted while its detail is open so its query and status filters are retained.
- The Live Trains list no longer inserts static seed records or train-number-derived progress values when the API is unavailable. Missing live values are shown as unavailable.
- The Live Search control and panel are responsive on mobile. Autocomplete errors, including HTTP 429, are shown to the user. Sync and refresh remain manual; no polling was added.

### Live Train Detail

- Live Search selection reuses the existing `POST /api/v1/live/sync-by-train` flow and existing route, delay, live-position, prediction, and forecast APIs. No backend endpoint or ML logic changed.
- The detail view presents the selected train number, API-derived train/route details when available, live position fields, scheduled and actual station timings, station status, predictions, route timeline, and supported map.
- The full API station list is expanded by default in Schedule Intelligence. The train marker is rendered only when the live current-station code matches a route station; it stays at that station and is not continuously animated.
- Missing delay, confidence, freshness, prediction, and live-position values display as unavailable instead of invented zeroes or sample contribution percentages. HTTP 429 from detail requests is surfaced through the existing API error state.
- Refresh remains explicit and disabled while a request is in progress. Last-updated time changes only after a successful sync.

### Dashboard UI and Navigation

- Added a reusable, small Back control only to contextual train-detail views. Primary destinations such as Home, Analytics, Corridors, Network Intelligence, and Live Trains do not show it. The current app is state-based rather than React Router-based, so in-app browser history is synchronized through the History API.
- Redesigned the station-to-station results presentation while retaining its existing live API data, filters, route expansion, and manual refresh actions.
- Redesigned Active Corridors using `/analytics/corridors` and `/analytics/summary`, with manual refresh and explicit empty/loading states instead of fabricated corridor records.
- Redesigned Delay Analytics to use real summary, delay, position, and prediction fields. The APIs do not provide ETA regression samples/R² or per-signal contribution percentages, so those values are displayed as unavailable.
- Redesigned Schedule Intelligence with a timeline rail, API-derived station cards and status, scheduled/live/predicted timing separation, and a live marker tied to the matching current station.
- Added consistent medium-dark borders and subtle shadows for focused/selected controls without changing unselected colors or backgrounds.

### Verification and Current Limitations

- `npm.cmd exec tsc -- -b` passes, and editor diagnostics for the changed frontend files are clean.
- Browser checks verified the Home hero has no train-number field, the mobile Live Search trigger/panel fit within a 390px viewport, the selected-train history returns to Live Trains, and the no-data Live Trains list shows no seeded cards.
- The local FastAPI service was unavailable during the latest Live Search verification. The frontend showed the backend connection error and unavailable detail fields; successful live selection could not be re-verified in that session.
- A production Vite build may still be blocked by existing CSS parsing issues in shared stylesheets (`App.css` import ordering and a malformed rule in `train-search-results.css`). A passing TypeScript check is not a successful production build.

### Remaining Work

- Restore backend availability and verify live train-number/name autocomplete, selected-train sync, actual station-by-station detail values, manual refresh, HTTP 429 presentation, and browser Back with the configured provider account.
- Add automated browser coverage for Home station search, Live Search autocomplete, Live Trains/detail navigation, Back/Forward restoration, manual refresh loading/error states, and desktop/mobile layouts.
- Fix the existing shared CSS production-build blockers, then run and record the full frontend build and lint results.
- Complete provider health/quota monitoring, retry-after guidance for 429 responses, durable sync observability, and production rate limiting.
- Replace the temporary SQLite migration with Alembic and operationalize PostgreSQL, deployment monitoring, and CI/CD.
- Repair/replace the unreadable station-list PDF and add repeatable station-catalog and coordinate enrichment imports for offline coverage.
- Continue ETA model calibration across train types and corridors; current regression validation and per-signal attribution are not exposed by the existing frontend API contract.
- Connect real weather, signal, maintenance-block, and official congestion feeds where available; unavailable network conditions must remain explicitly unavailable.
- Replace the Home live-preview card, Home corridor previews/statistics, and remaining Network Intelligence lane/hotspot/alert/health values with real API data or label them clearly as presentation examples before treating them as operational live data.

## Work Completed — 27 September 2026

<div style="color: green">

- Inspected the configured RailRadar API and its OpenAPI contract instead of inferring response fields. Confirmed station autocomplete at `GET /v1/lookup/search/stations` (query `q`, optional `limit`) and train autocomplete at `GET /v1/lookup/search/trains` (query `q`, optional `limit`).
- Confirmed the provider's point-to-point availability endpoint is `GET /v1/trains/between/{from}/{to}?live=true`. Its response envelope is `{success, data, meta}`; `data` contains `from`, `to`, `count`, and `trains`. Each service includes a train object and ordered `from.sequence` / `to.sequence` stops, schedules, and optional live fields.
- Replaced saved-database station suggestions with live provider autocomplete. The exact station code returned by RailRadar is kept on selection and sent to the backend.
- Replaced station-pair search over locally stored candidate trains with one request to the provider's trains-between endpoint. The backend validates the returned station pair and each train's stop codes and sequence order before returning it. No local station or train rows are used to discover station-pair results.
- Added provider-backed train-number/name suggestions, removing the unfiltered saved-train list request from frontend startup.
- Verified real provider behavior: GAYA to HWH returned 19 services; the API also returned 19 services for HWH to GAYA. A query from GAYA to provider-listed WCB returned `found: false`, zero trains, and a station-name-specific message. The real provider response determines availability; the app does not assume the reverse route is empty.
- Redesigned both Refresh Live controls as a responsive glass-style pill with an SVG refresh icon and LIVE badge. The icon rotates only while the user-triggered request is in progress; the control disables against duplicate clicks, records successful refresh time, and shows a provider error state on failure.
- Redesigned the station-to-station results screen with a route summary, responsive train cards, search/sort/status/departure filters, and polished loading and empty states. This is a presentation-only change; existing search data, API calls, and manual refresh behavior are unchanged.
- Kept refresh manual-only. No periodic refresh or polling was introduced.
- Added tests for the actual provider response contracts, live station/train autocomplete fields, route code/order filtering, empty results, invalid provider envelopes, and API errors.

</div>

## Earlier Work — 25 September 2026

<div style="color: green">

- Added the persisted ETA ML pipeline using all five railway JSON datasets, with chronological splits, outlier handling, saved preprocessing, model metrics, confidence, and evidence factors.
- Connected real ML predictions and station forecasts to the FastAPI prediction APIs and existing React ETA displays, with explicit fallback labeling.
- Removed automatic live polling and background synchronization. Live data refreshes only through explicit Live Search or the manual Refresh Live button.
- Improved backend stability with startup database initialization, safe session rollback, cancellation-aware shutdown handling, request logging, eager route loading, and batched forecast inference.
- Updated Schedule Intelligence to keep scheduled times black, live arrival blue, live departure red, and AI Predicted green with a blue LIVE station indicator.
- Added live current-station details and the existing train marker to Train Search results.
- Added the premium Rail Gaadi navbar logo and search transition styling. The Refresh Live control was redesigned on 27 September 2026; see today's work above.

</div>

## Current Status

### Completed

- FastAPI backend with SQLAlchemy and SQLite development database.
- Layered backend structure: API, services, repositories, models, engines, and database.
- Train, station, route segment, live position, delay event, prediction, and evidence models.
- Raw train payload normalization for both simple payloads and wrapped API payloads under `data`.
- Concatenated historical JSON snapshot loading.
- Historical live-position and delay-event storage.
- Evidence-based delay reason classification.
- Fresh versus cumulative delay attribution.
- Confidence score and confidence level calculation.
- Train search, train overview, live position, delay, and route endpoints.
- Backend live API proxy and ingestion endpoints.
- Train-number based live lookup through `POST /api/v1/live/sync-by-train`; the user does not need to paste a provider URL for every train.
- RailRadar Bearer-token support through `.env`.
- React dashboard with these pages:
  - Rail Gaadi home page
  - Train Search
  - Live Trains
  - Analytics
  - Corridors
  - Network Intelligence
- Dashboard displays provider/backend-returned scheduled and actual times, delay, reason, confidence, route segments, and live position; unavailable values are not treated as verified live values.
- Home page includes a Rail Gaadi brand header, full-bleed railway hero, From/To station search panel, live ETA preview, ETA visualization, live corridor cards, and network statistics. Train-number/name lookup is only in Live Search.
- Brand presentation uses the asset-based train icon from `frontend/public/train-marker.svg`; no train emoji is used.
- Source route classification is preserved: `isHalt: true` is rendered as a main station and `isHalt: false` as an intermediate halt.
- ETA prediction v1.1 uses current live speed for the next segment, stored segment average speed for later segments, scheduled dwell time, route distance, and the latest delay trend.
- Main station flow shows only main stations by default; each main station can expand to reveal the halts in the route segment after it.
- Every halt can be selected, and the current halt receives a live train marker/highlight.
- Main stations and intermediate halts are grouped by route sequence, so a halt appears between the correct main stations.
- The route connector is animated and the train marker follows the provider's current station or halt.
- Manual station selection is preserved during route interaction; live-location auto-focus happens on initial page/train load rather than after every user click.
- Leaflet route map with an online OpenStreetMap base layer and local station-to-station route overlay.
- Route overlay remains available from saved coordinates when the live API is unavailable; external map tiles are optional for the route line and markers.
- Zoom controls are disabled and the selected route is fitted as a complete corridor rather than auto-zooming into one station.
- Route-level `lat`/`lng`, `latitude`/`longitude`, and `lon` coordinates are preserved when the provider supplies them.
- Current train marker on the active main station or halt row.
- Smooth initial scrolling to the active route segment.
- Live data synchronization is manual-only: the user must run Live Search or click Refresh.
- Older live snapshots are rejected before they can overwrite a newer route or live state.
- Provider timeout and HTTP error responses are mapped to actionable API statuses such as `401`, `404`, `429`, `502`, and `504`.
- Train-number live lookup rejects a provider response for a different train with HTTP `409` before persistence.
- Regression coverage includes stale snapshots, provider `401`, `404`, `429`, timeout, malformed JSON, train-number URL generation, and payload normalization.
- Imported and verified train datasets for `13024`, `13401`, `15658`, `63207`, `63209`, and `20801`.

### Current implementation status

- **Working locally:** JSON import, route normalization, `isHalt` preservation, live position storage, train-number live lookup, delay analysis, ETA fallback, route flow, full station halt expansion, live-station marker matching, manual refresh, provider-backed autocomplete and station-pair results, API-backed Live Trains filtering, data-backed Corridors and Delay Analytics, contextual detail navigation, and the station-only Home search flow.
- **Operational API coverage:** the backend now exposes live delay analytics, route-based ETA forecasts, and network-condition checks through `/api/v1/analytics/*`, `/api/v1/predictions/*/forecast`, and `/api/v1/network/trains/{train_number}/conditions`.
- **Frontend assets:** the home hero image is `frontend/public/train.jpg`; city cards use `frontend/public/delhi.jpg`, `frontend/public/kolkata.jpg`, and `frontend/public/mumbai.jpg`. Replace those files to change the home visuals without editing React.
- **Partially complete:** ETA calibration/interpolation quality across corridors, complete coordinates for every Indian station, PDF station-catalog import, real weather/network feeds, and production-grade provider monitoring. Network Intelligence still contains presentation-only lane, hotspot, alert, and health values that must be replaced by suitable real backend/provider data before being treated as operational metrics.
- **Development-only:** SQLite database and local CORS configuration. The frontend API URL is configurable through `VITE_API_BASE_URL` with a local default.

### Operational endpoints available

- `GET /api/v1/trains/stations?query=Gaya&limit=10` — proxy station autocomplete to the configured live provider and return provider-issued station codes and names.
- `GET /api/v1/trains/search?query=13024` — proxy train-number/name autocomplete to the configured live provider. An empty query returns an empty list; it does not enumerate saved train records.
- `GET /api/v1/trains/search?from=GAYA&to=HWH` — proxy live point-to-point train availability to the provider's `/v1/trains/between/GAYA/HWH?live=true` endpoint and verify returned stop codes and order.
- `GET /api/v1/trains/{train_number}/route` — route geometry, scheduled timings, halt markers, and segment speeds.
- `GET /api/v1/live/trains/{train_number}` — latest live-position snapshot from the local store.
- `POST /api/v1/live/sync-by-train` — refresh a trained route from the configured upstream provider.
- `GET /api/v1/predictions/trains/{train_number}` — latest ETA/delay prediction record.
- `GET /api/v1/predictions/trains/{train_number}/forecast` — route remainder forecast for the next stations on the journey.
- `GET /api/v1/analytics/summary` — active-train network summary.
- `GET /api/v1/analytics/trains/{train_number}` — train-level delay and ETA analytics payload.
- `GET /api/v1/network/trains/{train_number}/conditions` — signal, congestion, weather, and route-density insight derived from the local railway data source.

> The network-condition service is intentionally data-source aware. If no live weather or external network feed is configured, it reports a safe `unavailable` or `local_db` status instead of fabricating operational conditions.

### Completed project work

#### Backend and data

- FastAPI application with versioned `/api/v1` routes is running locally on port 8000.
- SQLAlchemy models and repositories cover trains, stations, train-station routes, route segments, live positions, delays, predictions, evidence, and operational events.
- Raw JSON payloads are normalized from both simple and provider-wrapped formats under `data`.
- Seeded train data preserves station sequence, scheduled and actual timings, delay values, platforms, halt classification, route distances, and coordinates.
- Duplicate route stations are removed before the frontend timeline is rendered.
- Historical operational records are preserved when a live payload is synced.
- Delay reason attribution, fresh versus cumulative delay, evidence, and confidence scoring are available through the delay engine.
- Prediction and ETA endpoints are available with stored route and speed fallback logic.

#### Search and navigation

- Train-number/name autocomplete is fetched from RailRadar's `/v1/lookup/search/trains` endpoint.
- Station autocomplete is fetched from RailRadar's `/v1/lookup/search/stations` endpoint. Search suggestions are request-driven; the backend does not preload the local station table for this workflow.
- A selected station keeps the exact code returned by RailRadar. Station-pair availability is fetched from `/v1/trains/between/{from}/{to}?live=true` through the backend.
- The backend only returns provider results whose returned From/To codes agree with the requested pair and whose From sequence is less than the To sequence. A zero-match result includes `found: false`, an empty `trains` list, and a message naming the selected stations.
- Station and train autocomplete show request loading/error states. Repeated identical pending station searches are suppressed, prior autocomplete requests are aborted, and duplicate route-search submissions are guarded.
- Search recommendations appear when a search field is typed into and come from the live provider lookup endpoints.
- Home station-pair search opens the provider-backed train result list.
- Selecting a train from Live Search or Live Trains opens its live-service detail view and requests current data through the existing manual sync flow.
- Contextual Back buttons appear on detail views only. Live-service detail returns to Live Trains when opened from Live Search or the Live Trains list; browser history restores the prior list state.
- The obsolete provider URL input box was removed from the normal dashboard workflow.
- Home `From station` / `To station` fields query live station autocomplete and retain provider-returned codes after selection. The navbar Live Search panel is train-number/name-only.
- Selecting From and To calls the live trains-between endpoint; route matching is server-side against the endpoint's returned train stops, not against the saved local route list.

#### Station catalog import

- The uploaded source file is stored under `data/raw/` as `List of railway stations in India - Wikipedia_260921094158 (1).pdf`.
- The PDF has been detected, but its text layer is corrupt/empty and its compressed content cannot currently be parsed reliably by local PDF readers.
- The PDF remains unusable for importing into the local station catalog. Station-pair search/autocomplete now uses the configured live provider endpoints and does not depend on this PDF or the local catalog.
- A separate repeatable importer is still needed if the project needs its own all-India station dataset for offline or non-provider features.

#### Dashboard and route view

- The detail page shows current station, previous station, next station, speed, update time, delay reason, ETA, confidence, route flow, delay analysis, and map panels.
- Main stations and intermediate halts are grouped by route sequence; halts can be expanded and selected.
- The active live station or halt receives the train marker and route focus.
- Duplicate station rows are not rendered.
- Current delay displays the numeric sign correctly: positive values use `+`, early arrival values use `-`, and zero displays as `0`.
- Estimated arrival uses the destination station timing from the stored route.
- Speed prefers the live API value and falls back to route segment average speed when live speed is missing.
- When a stored route contains actual station timings, those actual records can provide a saved-position fallback; otherwise current/previous/next position remains unavailable. A fresh live API position overrides saved actuals when available.

#### Live API behavior

- The backend proxies provider requests, so the browser does not call the external provider directly.
- Train-number sync uses `POST /api/v1/live/sync-by-train` and derives the provider URL from `LIVE_API_URL`.
- RailRadar authentication is supplied through `RAILRADAR_API_KEY` in `.env` using a Bearer token.
- Backend live synchronization runs only for an explicit Live Search or Refresh request.
- The frontend keeps the displayed live state unchanged between explicit user actions.
- Station autocomplete proxies to RailRadar `/v1/lookup/search/stations?q=...`; train autocomplete proxies to `/v1/lookup/search/trains?q=...`.
- Station-pair search proxies to `/v1/trains/between/{from}/{to}?live=true`. The provider is the source for station suggestions, station codes, train availability, stop order, and the schedule/live fields it supplies.
- The `Refresh Live` button explicitly requests a fresh provider sync and then reloads route, delay, prediction, and live-position data. Its SVG icon rotates during the request, the button is disabled against duplicate clicks, a successful request updates the last-updated display, and a failed request exposes an error state.
- Refresh remains click-only; no automatic live polling or interval-based refresh is active.
- If a provider sync fails, existing page data remains visible and the failure is surfaced; it is not represented as a successful refresh.
- Live provider behavior is implemented, but availability depends on the configured upstream account and quota. Earlier checks returned upstream `401`/`429` responses, so the application deliberately keeps saved route/live snapshots visible when the provider is unavailable.

#### Provider search verification — 27 September 2026

- `GET /v1/lookup/search/stations?q=Gaya&limit=10` returned live station suggestions including `GAYA` / `Gaya Jn`.
- `GET /v1/lookup/search/trains?q=13024&limit=5` returned `13024`, `Gaya - Howrah Express`, with provider source `GAYA` and destination `HWH`.
- `GET /v1/trains/between/GAYA/HWH?live=true` returned 19 trains. The provider also returned 19 for HWH to GAYA; the application follows the provider response rather than assuming reverse direction has no service.
- Searching from GAYA to the provider-listed WCB station returned no services. The backend returned `found: false`, zero trains, and the provider station names in the no-results message.

#### Map behavior

- The map uses Leaflet with a normal online OpenStreetMap tile layer when internet is available.
- Leaflet draws the route locally from saved station coordinates using a Polyline and station markers; the route does not depend on live API data.
- Origin, current, destination, and station tooltips are rendered from the selected train route.
- Zoom controls are disabled; the complete selected route is fitted into the map.
- The map uses a fresh Leaflet instance for each selected train and handles missing or invalid coordinates without blanking the detail page.

#### Backend hardening

- CORS origins and trusted hosts are environment-configurable.
- Optional API-key protection uses constant-time comparison and the `X-API-Key` header.
- Production startup rejects the default secret key.
- SQLAlchemy enables connection health checks, safe SQLite threading, and configurable pooling for PostgreSQL.
- Request method, path, status, and duration are logged for operational debugging.
- Security response headers are applied consistently to API responses.

### Current known issues

- The uploaded station-list PDF cannot yet be imported automatically because its text/compressed content is damaged for local parsers.
- The external live provider can return `401` when credentials are invalid or `429` when the account quota is exhausted. This is an upstream access issue, not a frontend routing failure.
- Full production deployment is not complete: PostgreSQL migration execution, Alembic migration history, external monitoring, provider quota alerting, and CI/CD still need to be operationalized.

## Frontend Navigation and Backend Connection

The frontend is a React/Vite single-page application. Navigation is state-based in `frontend/src/App.tsx` rather than URL-router based. The `page` state controls which existing section is rendered, so the navbar does not create duplicate pages or duplicate backend calls.

| Navbar item | Frontend section | Current behavior | Backend/data connection |
| --- | --- | --- | --- |
| Home | `homeView()` / `PremiumHomePage` | AI ETA introduction, From/To station search, live preview, ETA visualization, corridors, and network statistics. | Station suggestions call `GET /api/v1/trains/stations?query=...`; selected provider station codes are submitted to `GET /api/v1/trains/search?from=...&to=...`. No train-number field is shown in the Home hero. |
| Train Search | `searchView()` | Provider-backed station-pair results, filters, route expansion, and entry to train detail. | Station-pair results come from RailRadar's trains-between API; the frontend does not match saved local routes. |
| Live Trains | `liveView()` / `LiveTrainsDashboard` | API-backed live-train cards, All/Running/Delayed/On Time/Unavailable filters, current station, delay, AI ETA, and Open Live Service. The list is empty with an error state if live API data is unavailable; no seed cards are displayed. | Records come from `GET /api/v1/live/trains`. Open Live Service calls `POST /api/v1/live/sync-by-train`, then loads route, delay, live position, prediction, and forecast endpoints. |
| Analytics | `analyticsView()` | API-derived delay index, reported-reason distribution, fleet delays, live signal values, and selected-train confidence/evidence. Regression samples/R² and per-signal contribution percentages display as unavailable because the current API does not provide them. | Network summary uses `GET /api/v1/analytics/summary`; selected-train details use the existing delay, live, prediction, and forecast APIs. |
| Corridors | `corridorsView()` / `CorridorDirectory` | Active corridor cards with API-derived route performance, average delay, density, and status; manual refresh with loading/empty states. | Uses `GET /api/v1/analytics/corridors` and `/api/v1/analytics/summary`; opening a train uses the existing live sync/detail flow. |
| Network Intelligence | `networkView()` / `NetworkDashboard` / `LiveNetworkIntelligence` | Network summary counts plus network flow, delay corridors, hotspots, alerts, and health visualization. | Some summary values use `GET /api/v1/analytics/summary`; lane geometry, hotspot/alert examples, and several health percentages remain presentation-only and must not be treated as live operational measures. Train clicks use the existing live sync/detail endpoints. |
| Live Search CTA | Navbar control in `App.tsx` | Opens a train-number/name-only panel with debounced live suggestions, loading/error states, and train selection. Selection opens Live Service detail; Back returns to Live Trains. | Suggestions use `GET /api/v1/trains/search?query=...`. Selection calls `POST /api/v1/live/sync-by-train` and the existing route, delay, live-position, prediction, and forecast reads. HTTP 429 is surfaced; no local train fixture is used for suggestions. |

### Detail-page request flow

When a user opens a train, the frontend uses the backend proxy and does not call the external provider directly:

```text
Navbar / Home / Live Trains
  |
  +--> POST /api/v1/live/sync-by-train
  |       |
  |       +--> provider request using LIVE_API_URL + RAILRADAR_API_KEY
  |       +--> normalize and persist live payload
  |
  +--> GET /api/v1/trains/{train_number}/route
  +--> GET /api/v1/delays/trains/{train_number}
  +--> GET /api/v1/live/trains/{train_number}
  +--> GET /api/v1/predictions/trains/{train_number}
       |
       +--> Live status, timeline, map, ETA, delay, confidence
```

### Completed frontend work

- Full-bleed AI-powered Rail Gaadi Home page using the existing railway image.
- Home station autocomplete by station name and code.
- Navbar Live Search CTA with train number/name lookup only, debounced API autocomplete, loading/error/429 states, disabled in-flight actions, and a responsive mobile panel.
- Home hero focused on its existing From/To station search; the train-number/name field is removed from Home.
- Live Search train selection opens the existing live-service detail and loads provider-backed route, delay, live-position, prediction, and forecast data. Contextual Back and browser history return to Live Trains.
- Live Trains parent list uses API records only; seeded fallback trains and train-number-derived position progress were removed. Unavailable values are not replaced by fabricated live data.
- API-returned station and train autocomplete with exact provider station codes, request loading/error states, and duplicate-request prevention for route searches.
- Provider-backed station-pair results with route order checked in the backend and a clear no-trains state that never displays unrelated candidates.
- Station-pair results screen with route summary, responsive train cards, result filters, live status and delay indicators, route-stop expansion, loading skeletons, and no-results states.
- Sticky glass navbar with Home, Train Search, Live Trains, Analytics, Corridors, and Network Intelligence.
- About navigation and About page removed.
- Live Trains dashboard with API-provided records, status filters, search, current station, delay, AI ETA, and direct service opening. No local seed train list is shown when the API is unavailable.
- Train Search result list and live-service detail navigation preserved. Back controls are limited to contextual detail views and return to their parent list/history entry.
- Responsive Refresh Live glass pill with inline SVG icon, LIVE badge, hover elevation, request-only rotation, disabled in-flight state, success timestamp, and visible provider failure state.
- Live-service prediction colors standardized: arrival blue, departure red, AI Predicted green.
- Current station/junction emphasis, collapsed intermediate halts, Show all halts control, compact station cards, live status, metrics, delay reason, confidence, and route progress.
- Leaflet live map with current marker animation, passed/upcoming route treatment, and junction markers.
- Delay Analytics dashboard derives supported metrics/charts from existing APIs. ETA regression/R² and per-signal contribution values are shown as unavailable because the current API does not provide those datasets.
- Active Corridors dashboard derives corridor rows and network summary from the existing analytics APIs, with manual refresh and loading/empty states.
- Schedule Intelligence displays the full API route by default, preserves scheduled/live/prediction timing colors, and only places the live train marker at an exact current-station match.
- Focused/selected controls use slightly stronger neutral borders and subtle shadows while unselected styling remains unchanged.

### Work Not Completed Yet

- Full all-India local station-catalog import from the damaged PDF. The station-pair search currently uses RailRadar's live lookup API; a local catalog is still needed only for offline/self-hosted station features.
- Full use of `/api/v1/network/trains/{train_number}/conditions` and real source data for every Network Intelligence metric. Corridors and supported Delay Analytics values use the existing analytics APIs; Network Intelligence still includes non-operational presentation-only lanes, hotspots, alerts, and health figures that need a real data contract.
- Weather, signal, maintenance-block, preceding-train, and official congestion feeds are not connected to a real external data provider.
- ETA ML training and inference are available through the persisted `eta-delay-rf-v1` artifact. The model predicts future station arrival delay from the five raw train snapshot datasets; route/speed fallback remains available when required features or model reliability are insufficient.
- Provider credential/quota operations remain external setup work. A valid `RAILRADAR_API_KEY`, permitted endpoints, and available provider quota are required for live station/trains search and fresh live sync.
- PostgreSQL/Alembic production migration, deployment monitoring, alerting, and CI/CD are not finished.
- Automated browser visual regression tests and production-scale performance testing are not yet included. The Refresh Live pill and live search were manually exercised in the browser; this is not a substitute for automated visual regression coverage.

### Current Imported Trains

These local imports remain available to existing dashboard, seed, and analytics workflows. They are not used to populate live station suggestions or discover station-pair search results.

- `13024` - Gaya - Howrah Express
- `13401` - Danapur Intercity Express
- `15658` - Brahmaputra Mail
- `63207` - Jhajha - Patna MEMU
- `63209` - Deoghar - Patna MEMU
- `20801` - Magadh Express

## Project Structure

```text
backend/
  app/              FastAPI app, settings, dependencies
  api/v1/           HTTP routes, including live sync-by-train
  database/         SQLAlchemy engine, sessions, DB initialization
  engines/          Delay reason and attribution logic
  models/           ORM models
  repositories/     Database access layer
  services/         Business logic, live sync, prediction, and payload ingestion
  schemas/          Pydantic request/response schemas

frontend/
  src/App.tsx       Dashboard, manual live refresh, live-provider search, route grouping, and train movement state
  src/App.css       Dashboard and route-flow styling
  src/train-search-results.css  Station-pair result screen layout, cards, filters, and responsive states
  src/live-marker.css  Train marker and animated route movement styling
  src/home-premium.css  Full-bleed AI ETA homepage styling
  src/live-trains.css   Live Trains dashboard and corridor directory styling
  src/live-service.css  Live train detail layout and status styling
  src/live-service-time.css  Arrival/departure/AI prediction color system
  src/live-search-polish.css  Navbar Live Search CTA styling
  src/home-live-search.css  Station-only Home search grid and train-only Live Search panel states
  src/back-button.css  Contextual detail-page Back button
  src/selection-states.css  Shared selected/focused border and shadow states
  src/station-search-results-polish.css  Station-to-station result card presentation
  src/schedule-intelligence-polish.css  Schedule station-card and live railway timeline styling
  src/delay-analytics.css  Delay Analytics dashboard presentation
  src/refresh-live.css        Responsive Refresh Live pill, LIVE indicator, and loading animation
  src/navbar-buttons.css  Navbar pill, active, hover, and responsive button styling
  src/network-intelligence.css  Network Intelligence visualization styling
  src/home-landmarks.css  City-card landmark image overrides
  src/header-layout.css   Brand/navigation separation and responsive header layout
  public/train.jpg        Home hero image
  public/delhi.jpg        New Delhi route-card image
  public/kolkata.jpg      Kolkata route-card image
  public/mumbai.jpg       Mumbai route-card image
  public/train-marker.svg

data/
  raw/              Raw train payload exports
  processed/        Processed data area
  training/         Future ML training data
  samples/          Small development fixtures

scripts/
  seed_train.py     Import a JSON payload or snapshot export

tests/              Backend normalization, sync, delay, and live-provider search tests
ml/                 Future model training and inference area
docs/               Project documentation area
```

## Requirements

- Windows PowerShell
- Python 3.11 or newer
- Node.js and npm
- Internet access for the OpenStreetMap map tiles

## Setup

From the repository root:

```powershell
cd D:\backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

If `.env` already exists, keep it and edit only the values you need.

For the frontend, copy `frontend/.env.example` to `frontend/.env` when the backend is not running at the local default URL:

```env
VITE_API_BASE_URL="http://127.0.0.1:8000/api/v1"
```

## Environment Configuration

Actual secrets belong in `D:\backend\.env`, not `.env.example`:

```env
APP_NAME="Train Delay Intelligence"
APP_ENV="development"
DEBUG=true
DATABASE_URL="sqlite:///./train_delay.db"
SECRET_KEY="change-me-in-production"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60
RAILRADAR_API_KEY="your_actual_api_key"
LIVE_API_URL="https://api.railradar.in/v1/trains/{train_number}/live"
API_ACCESS_KEY="set-a-long-random-value-in-production"
CORS_ORIGINS="https://dashboard.example.com"
TRUSTED_HOSTS="api.example.com"
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
```

Never commit or share `.env`. It is ignored by Git. `.env.example` contains placeholders only.

### Production hardening

- Set `APP_ENV=production` and `DEBUG=false` before deployment.
- Replace the default `SECRET_KEY`; the backend refuses to start in production while it remains unchanged.
- Set `API_ACCESS_KEY` to enable `X-API-Key` protection for all `/api/*` routes. The `/health` endpoint remains available for monitoring.
- Set `CORS_ORIGINS` to the exact frontend origins. Do not use a wildcard when credentials are enabled.
- Set `TRUSTED_HOSTS` to the API hostnames accepted by the deployment proxy.
- Use PostgreSQL or another production database instead of SQLite. `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` apply to non-SQLite databases.
- The backend emits request timing logs and security headers including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- HTTPS deployments also receive the `Strict-Transport-Security` header.
- Put TLS termination, external rate limiting, and multi-worker process supervision in the reverse proxy or deployment platform.

## Run The Backend

Start FastAPI from `D:\backend` so the correct SQLite database and `.env` are loaded:

```powershell
cd D:\backend
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "app": "Train Delay Intelligence",
  "env": "development"
}
```

## Run The Frontend

In a second terminal:

```powershell
cd D:\backend\frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/?fresh=2
```

For a production build check:

```powershell
npm.cmd run build
npm.cmd run lint
```

## Import A JSON File

Import one payload or a concatenated snapshot export:

```powershell
cd D:\backend
.\.venv\Scripts\python.exe -m scripts.seed_train data\raw\20801.JSON
```

The importer normalizes fields such as:

- `trainNumber` and `trainName`
- `train.source` and `train.destination`
- `currentLocation`
- `previousHalt` and `nextHalt`
- `delayMinutes`
- route station schedule and actual timestamps
- arrival and departure delay
- station platform and distance

## Train The ETA Model

The five raw JSON exports are processed one file at a time. The training job creates adjacent-station examples using the recorded `delayArrival` target, removes duplicate snapshot/target pairs, rejects invalid timestamps and delays beyond 30 days, and uses chronological train/validation/test splits.

Install the ML runtime dependencies and train the persisted artifact:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe ml\training\train_eta_model.py --data-dir data\raw --output ml\models\eta_delay_model.joblib
```

The model and metrics are saved to `ml/models/eta_delay_model.joblib` and `ml/models/eta_delay_model.metrics.json`. The current training run used 17,615 examples:

- Validation MAE: 18.232 minutes; RMSE: 30.978 minutes.
- Test MAE: 35.924 minutes; RMSE: 69.657 minutes.
- Test reliability is checked before an ML response is returned; otherwise the API marks the route/speed estimate as `prediction_source: "fallback"` and `is_fallback: true`.

The model endpoint is available at `POST /api/v1/predictions/predict-eta`:

```json
{"train_number": "20801", "current_station_code": "GZH"}
```

## Live API Workflow

### Dashboard workflow

1. Configure `LIVE_API_URL` in `.env`.
2. Start the backend. It derives the provider URL and fetches a train only after an explicit Live Search or Refresh action.
3. Start the frontend and open the dashboard.
4. Open `Live Search` in the navbar and enter a train number or name. Choose a result from live API suggestions, or submit an unambiguous matching query.
5. The frontend calls the existing train-number sync endpoint. The backend builds the provider URL, adds configured authentication, fetches and stores the payload, then returns the live train state.
6. The dashboard loads route, delay, confidence, current station/halt, prediction, forecast, and map data after train selection or an explicit `Refresh Live` action. Back returns to the Live Trains list.

The dashboard no longer requires a full provider URL for normal use. The manual `POST /api/v1/live/sync` endpoint remains available for testing or providers with a custom URL.

The browser does not call the external provider directly. The backend proxy handles the request, which avoids browser CORS limitations.

### Train-number live lookup

```text
POST /api/v1/live/sync-by-train
Content-Type: application/json
```

Request:

```json
{
  "train_number": "20801"
}
```

The endpoint derives the provider URL from `LIVE_API_URL`. Both forms are supported:

```env
LIVE_API_URL="https://api.railradar.in/v1/trains/20801/live"
```

or:

```env
LIVE_API_URL="https://api.railradar.in/v1/trains/{train_number}/live"
```

The provider URL must contain `/trains/<number>/live` unless it uses the `{train_number}` placeholder.

### Backend proxy endpoint

```text
POST /api/v1/live/sync
Content-Type: application/json
```

Request:

```json
{
  "url": "https://provider.example/api/train/20801/live",
  "headers": {}
}
```

For RailRadar, use the real train number without braces:

```text
https://api.railradar.in/v1/trains/20801/live
```

Do not use:

```text
https://api.railradar.in/v1/trains/{20801}/live
```

If the provider requires authentication, configure it in `.env`. RailRadar requests automatically receive:

```http
Authorization: Bearer YOUR_RAILRADAR_API_KEY
```

### Direct trusted payload ingestion

```text
POST /api/v1/live/ingest
Content-Type: application/json
```

Request:

```json
{
  "payload": {
    "data": {
      "trainNumber": "20801",
      "trainName": "Magadh Express",
      "delayMinutes": 83,
      "currentLocation": {
        "stationCode": "KYT"
      },
      "route": []
    }
  }
}
```

Live sync preserves historical operational records while updating the current route and train state.

## API Endpoints

```text
GET  /health
GET  /api/v1/trains/stations?query=Gaya&limit=10
GET  /api/v1/trains/search
GET  /api/v1/trains/search?query=13024
GET  /api/v1/trains/search?from=GAYA&to=HWH
GET  /api/v1/trains/{train_number}
GET  /api/v1/trains/{train_number}/overview
GET  /api/v1/trains/{train_number}/route
GET  /api/v1/live/trains
GET  /api/v1/live/trains/{train_number}
POST /api/v1/live/sync
POST /api/v1/live/sync-by-train
POST /api/v1/live/ingest
GET  /api/v1/delays/trains/{train_number}
GET  /api/v1/delays/trains/{train_number}/reasons
GET  /api/v1/predictions/trains/{train_number}
```

The station-pair route query accepts station codes returned by live autocomplete. The frontend passes the selected `station_code`; display labels are never used as a substitute after selection. The backend calls RailRadar's documented `/v1/trains/between/{from}/{to}?live=true` endpoint and accepts only provider results whose returned station codes agree with the requested pair and whose `from.sequence` is less than `to.sequence`.

Example response for a successful search:

```json
{
  "found": true,
  "message": null,
  "trains": [
    {
      "train_number": "13066",
      "train_name": "Anand Vihar - Howrah Amrit Bharat Express",
      "from_station": { "station_code": "GAYA", "station_name": "Gaya Jn" },
      "to_station": { "station_code": "HWH", "station_name": "Howrah Jn" },
      "scheduled_departure": "01:50",
      "scheduled_arrival": "10:50",
      "status": "not-running",
      "delay_minutes": null
    }
  ]
}
```

When the provider reports no results, the response has `found: false`, an empty `trains` array, and a message such as `No trains found between Gaya Jn and West Cabin Gaya`. Provider errors are returned as HTTP errors; they are not replaced with local or fabricated trains. `status`, `delay_minutes`, current station, and ETA are included only when the provider returns corresponding information.

The provider response observed during live verification is wrapped as `{ "success": true, "data": ..., "meta": ... }`. Station lookup results are under `data` as a list with fields including `code`, `name`, `city`, and `isActive`. Train lookup results use `number`, `name`, `source`, `dest`, and `type`. Trains-between data includes `from`, `to`, `count`, and `trains`; each returned train has nested `train`, `from`, `to`, and optional `live` data.

The route response contains the complete station list and station-to-station segments. Each station can include scheduled arrival/departure, actual arrival/departure, delay, platform, distance, coordinates, and `is_halt`.

Route classification rules:

- `is_halt: true`: main station/junction shown in the compact station flow.
- `is_halt: false`: intermediate halt shown inside the segment after the previous main station.
- Station order is always based on the source `sequence`; the frontend does not invent main stations using an index or sampling rule.

## Live Position And Marker

The dashboard uses:

```text
current_station_code
previous_station_code
next_station_code
current_speed_kmph
updated_at
```

The current station row receives the train marker. If the provider reports an intermediate halt, the marker is shown on that halt row rather than incorrectly showing only the surrounding junction. When the live payload changes its `currentLocation.stationCode`, the marker moves after the next sync cycle.

After the initial page/train load, the dashboard scrolls to the active route segment. Manual station or halt selection is not overridden by an automatic refresh cycle; the user must explicitly run Live Search or click Refresh Live. The movement follows the provider's reported station code; it does not invent intermediate GPS movement.

The current payloads provide origin and destination coordinates. A complete geographic line through every station requires latitude and longitude for each route station. Without station coordinates, the full timing route still works, but the map cannot draw an exact station-by-station geographic path.

## Validation

Backend tests:

```powershell
$env:PYTHONPATH="D:\backend"
.\.venv\Scripts\python.exe -m pytest D:\backend\tests -q
```

Frontend validation:

```powershell
cd D:\backend\frontend
npm.cmd run build
npm.cmd run lint
```

Historical verification on 27 September 2026: backend suite `23 passed`; the frontend production build passed at that time. Browser checks verified manual refresh success and a simulated provider `429` state. On 28 September, `npm.cmd exec tsc -- -b` and editor diagnostics pass. The current production Vite build remains blocked by CSS parsing issues in shared stylesheets (`App.css` import ordering and a malformed rule in `train-search-results.css`). The local FastAPI service was unavailable during the latest Live Search test, so successful upstream train sync was not re-verified. ESLint previously reported 6 errors and 2 warnings in chart, map, and effect code; lint was not re-run as part of the 28 September UI work.

## Remaining Work

### High priority: backend hardening

- Add provider health, quota, and sync-success monitoring so live connectivity regressions are detected early.
- Add durable sync history and alerting for user-requested provider syncs. Do not add periodic background sync without an explicit product requirement; refresh is intentionally manual-only.
- Add versioned provider response contract tests and stricter schema validation for station autocomplete, train lookup, and trains-between responses.
- Store sync attempts, response status, provider timestamp, and trace ID for operational debugging.
- Add circuit breaking and clearer handling for provider `5xx` responses.
- Move SQLite to PostgreSQL or another production database before multi-user deployment.
- Add provider-specific authentication configuration for providers beyond RailRadar.
- Add a station-coordinate enrichment provider for payloads that do not include route-level coordinates.
- Repair or replace the uploaded station PDF, then add a repeatable station-catalog import for all Indian station names and codes.
- Tune ETA against historical runs and add calibration metrics for different train types and corridors.
- Add explicit current station and live status fields to the train overview response.

### Medium priority: frontend and API quality

- Replace the temporary SQLite `is_halt` startup migration with Alembic migrations.
- Replace frontend DOM event delegation for halt selection with a dedicated route-row component.
- Extend loading, empty, stale-data, provider-error, and no-coordinate coverage across pages beyond station search and Refresh Live.
- Add automated responsive visual QA for the route flow, map, live-search panel, and Refresh Live control at desktop and mobile widths.
- Add distributed rate limiting at the reverse proxy or API gateway for production deployment.
- Add staging/production environment files and deployment-time validation for `VITE_API_BASE_URL`.
- Extend structured logging and provider retry/backoff observability.
- Add idempotency and snapshot de-duplication using provider timestamps or trace IDs.
- Add broader integration tests for provider `5xx` failures, malformed live payload shapes, unusual route ordering, and repeated syncs.
- Improve delay reason attribution using route-level evidence instead of the current V1 classification inputs.

### Remaining user-facing work

- Generalize the live-data status badge across dashboard pages to distinguish `Live`, `Saved fallback`, `Provider rate-limited`, and `Stale` states.
- Show last-success times and provider error detail consistently across all live-data panels. The Live Service Refresh Live control now shows its last successful update and a refresh error state.
- Add a retry-after countdown when the provider returns `429` instead of allowing repeated requests during the limit window.
- Add automated responsive visual QA against reference layouts at desktop and mobile widths.

### Later: product and modeling

- Improve ETA model calibration by train type/corridor and add model evaluation/monitoring.
- Add user accounts, saved trains, alerts, and notification delivery.
- Deploy the API, worker, database, and frontend separately.

## Recommended Next Steps

1. Add automated browser tests for live station selection, matching/no-match searches, refresh success, refresh failure, and responsive layouts.
2. Resolve RailRadar credentials/quota and add provider health, quota, retry-after, and sync observability.
3. Add complete station coordinates and verify the Leaflet route against provider route data.
4. Tune ETA against historical runs and measure prediction accuracy across train types and corridors.
5. Replace the temporary SQLite migration with Alembic and add production database support.
6. Add deployment monitoring, gateway rate limiting, and CI/CD configuration.

## Important Limitations

- The system cannot invent live movement. The provider must return fresh `currentLocation` and route data.
- Backend live sync is manual-only and runs through explicit Live Search or Refresh requests.
- If FastAPI is stopped, live data stops updating even if the frontend remains open.
- A provider returning `429 Too Many Requests` requires waiting for the provider rate limit to reset or changing the provider account/plan/key.
- A provider returning `401 Unauthorized` needs a valid API key and the correct authentication header.
- A provider returning station names but no station coordinates cannot produce a precise station-by-station map line.
- Online OpenStreetMap tiles require internet access, but the local Leaflet route line and station markers can still render from saved coordinates without the tile layer.
- SQLite is intended for local development, not high-volume production ingestion.
