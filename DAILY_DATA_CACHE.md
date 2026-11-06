# Daily source cache

With `DAILY_DATA_CACHE=true`, all daily source tables are served from a local
SQLite snapshot. Shared dashboard data, individual SKU history, freight,
inventory and promotion prices do not expire or poll Supabase. The public
health response reports generation, counts and source-read counters.

Restart files use lossless XZ compression (`.sqlite3.xz`). The publisher verifies
the SHA-256 of the decompressed file before uploading it. The server recognizes
both XZ and older gzip copies by their file signature. `snapshotCompression` in
the health response confirms the format actually restored or uploaded. The local
publisher configuration selects `compression: "xz"`; missing settings retain gzip
for safe staged rollout. Older gzip objects remain available for rollback.

The local daily import publishes both snapshots only after all database writes
and row-count checks succeed. It reuses the validated import payloads, uploads
compressed restart copies to the private `daily-render-cache` Storage bucket,
then updates each running service at `POST /api/data-refresh`. This endpoint
requires the dedicated `DATA_REFRESH_TOKEN`; it does not use a public API key.
Unverified, malformed and older uploads retain the existing snapshot. Publishing
failure fails the workflow visibly; retry `run_direct_refresh.ps1 -PublishCache`
without importing the database again. A price-history-only apply also publishes.

Render Free discards local files when spinning down or restarting. On cold
start, `DAILY_DATA_SNAPSHOT_URL` restores the private compressed file once using
the server-only `DAILY_DATA_STORAGE_KEY` (or the promotion service's existing
`SUPABASE_SERVICE_ROLE_KEY`). These credentials are never sent to browsers.
Failure to restore does not trigger an expensive raw-table fallback. With no
snapshot URL configured, a one-time raw-table recovery remains available for
other deployments. Existing local snapshots are reused until explicitly replaced.

Mutable promotion worktables, mappings, settings and event records still use
Supabase so user edits persist. Daily source tables are read-only through this
cache. Server counters deliberately distinguish raw source reads from compressed
snapshot downloads; small mutable reads are not included in source counters.

The refresh secret is stored locally in `refresh-data/render-cache-config.json`
outside the application repository and configured through Render's environment
settings. Do not commit the secret or snapshots. No paid Render service is needed.
