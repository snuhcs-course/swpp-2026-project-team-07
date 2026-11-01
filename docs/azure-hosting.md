# Public Azure submission backend

OutLoud's submission APK connects directly to `https://outloud-team07.koreacentral.cloudapp.azure.com/api` over public HTTPS. Reviewers enter one demo code inside the app; they do not install Tailscale or configure a server address. The existing Ubuntu 24.04 x64 VM, `outloud-team07` in `outloud-team07-semester`, remains in Korea Central: `Standard_B2als_v2` (2 vCPU / 4 GiB), 64 GiB Standard SSD. This is a semester pilot, not a load-tested public service.

## Install and use the APK

The local artifact is `output/public-demo/OutLoud-public-demo-20261102-feedback.apk`, package `com.team07.outloud`, Android version code 5. It is standalone and does not require Metro or a running laptop. Its signing identity matches the previous team APK; its manifest is non-debuggable, while signing still uses the existing internal debug certificate. The APK is 143,224,470 bytes; SHA-256 `9f1e1cbaba83f6c3ea7aef326c2ae163d815ffdedb414658acc29d489d573ffe`. It supports Android API 24+ with arm64-v8a, armeabi-v7a, x86 and x86_64 libraries. APK binaries remain local delivery artifacts, outside Git.

Version 5 preserves PR #34’s selected UI and preloads the supplied seven-slide Seoul presentation once, including its PDF and text for offline use. Existing local presentations and recordings remain intact. It repairs first-Redo lifecycle handling and connects compact Review rows to verified feedback data. [Automated and artifact evidence](testing-evidence/redo-feedback-20261102.md) is separate from the [historical version 4 report](apk-feature-verification-20261102.md).

1. Install the APK on a supported Android phone.
2. Enter the code from the operator's private `~/.codex/backups/outloud-public-20261101/reviewer-access.txt`. Supply that code separately to intended reviewers, for example in the submission instructions; never commit it or embed it in the APK.
3. Use an internet connection for uploads and processing. After successful entry, the app remembers the code in Android secure storage. Local recording/playback and cached results remain available offline, including through **Continue offline** on the access screen.
4. For the bundled Seoul demo, open **Edit time & audience**, explicitly select the required time and audience, save, and wait for synchronization. The offline seed's five-minute target is a suggestion and does not create a server context; audience-specific Q&A and required-duration checks need those saved choices.

Do not uninstall or clear an existing app to resolve an update/signature problem before preserving local recordings. The app retains local presentation references and caches scoped by API address; changing endpoints does not create an account-wide cloud library or automatically transfer every local binding. Provider consent remains part of the existing transcription flow.

## Access and data boundary

```text
Android APK + entered code → public HTTPS Caddy gate → private nginx
                                                    → Django API / media
                                                    → PostgreSQL / Redis / worker
```

The standalone [production stack](../compose.production.yaml) plus [public overlay](../compose.public.yaml) runs seven services: PostgreSQL, Redis, API, one Celery worker, one scheduler, nginx and Caddy. Only Caddy publishes the VM NIC's TCP 80/443. HTTP serves HTTPS redirects/certificate validation; application and media traffic requires HTTPS. nginx remains bound to host loopback, and API/database/broker ports are unpublished. The edge has its own Docker network and cannot directly reach the database/API network.

[Caddy](../deploy/Caddyfile) requires HTTP Basic authentication, username `reviewer`, for every public API/media path, including health, PDF/image/audio GET, HEAD and ranged requests. It stores a bcrypt hash, consumes the credential at the edge and strips authorization headers before proxying. Missing/wrong codes receive 401 before file access or application work. Request body/header/idle limits are configured; access logging is off and Caddy runtime error logs omit request metadata. nginx error logs can still include request URIs. [Caddy authentication](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [managed HTTPS](https://caddyserver.com/docs/automatic-https).

Code holders share the same trusted reviewer workspace, including uploaded files and rehearsal history. There are no separate accounts, ownership restrictions or per-user data isolation. The code is not a provider key or a spending cap. Keep it private and rotate it if shared beyond the intended reviewers. Feedback is enabled on this Azure VM through OpenRouter `openai/gpt-6-luna`, with an initial application limit of 300 LLM requests/day shared across prompt families. The API, worker and scheduler use the same configuration/image. This is a request limit, not a money cap; Scribe has separate provider charges. Repository examples remain disabled by default. No personal OpenAI key is present on the VM; the separate OpenRouter account's BYOK settings are unverified.

The mobile client attaches credentials only to the exact HTTPS origin where it validated the code, for both API requests and media downloads. It refuses authenticated redirects and never puts a credential in a URL. A 401 allows code re-entry without unmounting an active recorder, discarding local files/caches or automatically replaying a POST. The public address and `EXPO_PUBLIC_REQUIRE_DEMO_CODE=1` are build configuration; the code and all provider credentials remain outside `EXPO_PUBLIC_*`.

The server's old Tailscale Serve configuration was reset, its device signed out, `tailscaled` disabled and the package removed after the public path passed verification. Tailscale is no longer an app dependency. The previous certificate hostname remains in public certificate-transparency history. Public certificate hostnames are also public metadata. No teammate invitations, account deletion or GitHub OAuth revocation was performed.

## Deploy and maintain

Use `/srv/outloud` on the VM. The [Ubuntu bootstrap](../deploy/bootstrap-ubuntu.sh) installs Docker/Compose from Ubuntu's official packages and no longer installs Tailscale. Keep the local [compose.yaml](../compose.yaml) development setup separate.

Keep ignored `deploy/.env` mode 600 with backend/provider secrets, a strong Django secret, a separate database password and exact comma-separated `DJANGO_ALLOWED_HOSTS`. The public hostname must be first for the internal health check. No wildcard hosts are accepted. The old exact private hostname is retained as a reversible transition alias; it does not provide network access while Tailscale is disabled.

Copy [public.env.example](../deploy/public.env.example) to ignored `deploy/.env.public`, mode 600. It contains only the public hostname, primary private NIC address (`10.0.0.4`) and a single-quoted bcrypt hash. Keep this separate from the backend environment so only the edge receives the hash. Use a long random printable ASCII code without spaces. Generate the hash with the pinned official Caddy image's `caddy hash-password`, reading the code from newline-terminated stdin; omit `--plaintext` so it is not exposed in process arguments or shell history. An EOF without a final newline is rejected by this pinned CLI. Never print the resolved environment/configuration.

```sh
dc() { docker compose --env-file deploy/.env --env-file deploy/.env.public -f compose.production.yaml -f compose.public.yaml "$@"; }
dc config --quiet
dc build api
dc up -d db redis
# Fresh installations only; preserve an existing database and media volume.
dc run -T --rm --no-deps api python manage.py migrate </dev/null
dc up -d api worker scheduler proxy caddy
dc ps
dc exec -T worker celery -A config inspect ping
```

Use `-T` and `</dev/null` for one-off Compose commands inside SSH scripts. Docker's automatic restart policy and Caddy's persistent certificate volumes keep this independent of the laptop. The free Azure DNS label belongs to the existing static public IP; Caddy obtains and renews a publicly trusted certificate. Keep public TCP 80/443 available for redirects/certificate renewal. [Azure DNS label](https://learn.microsoft.com/en-us/azure/virtual-machines/custom-domain).

The temporary operator-only SSH rule was removed after cutover; the only custom inbound rule now permits TCP 80/443. Use Azure's authenticated VM Run Command for management. For an SSH maintenance window, temporarily allow only the operator's current public IP to TCP 22 and connect with the existing pinned SSH key; remove that temporary firewall rule afterward. Normal APK access needs only TCP 443. Keep databases, Redis, Gunicorn and nginx off public host ports. The dedicated Mac SSH config/key are `~/.ssh/outloud-azure-team07.conf` and `~/.ssh/outloud-azure-team07`; never share the private key with reviewers.

## History, backups and rollback

The migrated original history comprises 3 presentations, 14 slides and 17 rehearsals: 16 completed legacy results and one unqueued awaiting-analysis result. All 34 original media files total 21,725,239 bytes and matched original hashes/sizes at migration. Migration did not queue old recordings, manufacture Scribe provenance or generate feedback. The November 2 activation verified unchanged fingerprints of the original records before/after deployment. Later labeled synthetic checks are additive and separate from that original inventory.

The original local schema diverged from current main after migration 0002. Keep the original PostgreSQL dump on the Mac in `~/.codex/backups/outloud-azure-20261031/`; do not restore it and run current migrations over it. The bounded [legacy exporter](../deploy/export-legacy-history.py) and [import command](../backend/rehearsals/management/commands/import_legacy_history.py) validate IDs, references and file hashes. Import requires a freshly migrated empty history database and media already restored with matching hashes; restore media into an empty destination before import. They are not a repeat-import or general schema conversion service. Preserve the original local containers/volumes and both private archives.

Run `bash deploy/backup.sh` as root for a consistent current-schema PostgreSQL dump/media archive. It stops and resumes only previously running API/worker/scheduler writers; public requests may briefly fail during that maintenance window. Copy verified snapshots off the VM. The helper excludes environment secrets and certificate keys; keep those separately. [Backup helper](../deploy/backup.sh).

A current-schema snapshot was restored successfully on October 31 in an isolated PostgreSQL 16 container, preserving all records/media with zero provider/description/feedback jobs. Before the public cutover, another data-only snapshot was copied to `~/.codex/backups/outloud-public-20261101/` and its three checksums verified. Credential rollback stayed only in root-private `/var/backups/outloud-public-cutover/pre-public.env` on the VM. No new production-secret download occurred. These are manual one-time backups, not a schedule.

For rollback, close the public HTTP/HTTPS firewall rule, retain all current volumes, images and backups, and restore the previous root-private environment/configuration and image. Re-enabling private Tailscale access would require a deliberate operator action. Do not reverse schema migrations, use `down -v`, overwrite source volumes or delete archives. Export new Azure-only records before retiring the server.

## Verification and costs

November 2 version 5 checks supersede the earlier checkpoints below: mobile
type/lint and 576 tests pass with one existing warning; final PostgreSQL checks
cover 597 tests (596 executed passes, one local packaged-VAD skip). Both the
final canonical CPU image and actual Azure image pass 86 offline tests with
zero skips. First/repeated Redo, Keep/Overwrite, playback, code entry and offline
restore pass in the disposable emulator. Real generated cues render there;
the synthetic microphone-injection setup failed and physical speech capture
remains unverified. Actual API checks verify seven-slide profiles, 150-word
Scribe transcription, an accepted grounded finding and Q&A questions/answer
evaluation. One fresh scoring v2.2 generation assessed all seven slides and the
overall presentation, with zero score-critical evidence rejections. Real
feedback data also renders in the unchanged Review component.
The [current report](apk-redo-feedback-verification-20261102.md) and
[portable evidence](testing-evidence/redo-feedback-20261102.md) separate these
results, scoring recovery and remaining limits.

November 1 agent-operated checks passed: backend system/migration-drift checks; 569 SQLite tests with 25 skips (544 executed passed); mobile type/lint/test checks with 559 tests and one pre-existing `useSegmentPlayer` lint warning; Android JS export. Independent access tests cover 11 cases, including absent browser globals, origin binding, secure restore/offline access, redirects, expiry races and a recorder staying mounted. The final native APK is rebuilt after those changes.

Actual disposable Caddy/nginx probes passed with a temporary localhost CA explicitly trusted by the test process: all-route authentication, stripped credentials, HTTPS forwarding, Origin rejection, MIME/HEAD/ranges, HTTP redirect, byte limits and private upstream ports. No certificate validation was bypassed. Ten focused tests passed inside the new amd64 production image without network, including the actual packaged CPU speech gate. The test helper never reads a live environment file.

Independent real public GET/HEAD verification used normal TLS trust, no VPN/proxy and no redirect following: health/readiness 200, all source data/media hashes matched, ten missing/wrong-code probes returned 401, Origin-bearing API access returned 403, audio Range returned 206 and HEAD returned 200. Unchanged mobile parsers accepted all 17 results. Raw private data stayed in memory and only summary metadata was retained. All seven services are healthy and the actual worker returned pong. No verification wrote app data or called a paid provider.

Native access acceptance on the November 1 APK passed in an Android API 36 arm64 emulator after explicit ADB approval: fresh code gate, visible wrong-code rejection, explicit Continue offline, correct-code HTTPS unlock, and a new-process offline launch using saved access without another prompt. Wi-Fi/mobile data were both disabled and Android reported no active default network for offline checkpoints; no Tailscale package or ADB reverse mapping was present. An independent reviewer checked the six screenshots against those conditions. This proves native code entry, secure restore and standalone offline launch; it does not prove recording, playback, PDF import, migrated-history discovery or provider behavior on a phone. No product change or APK rebuild was needed. Local evidence is `output/public-demo/native-emulator-verification.json`.

Physical-phone acceptance and AI usefulness remain unverified; the newer live API results are recorded above. Production `check --deploy` has the four previously documented warnings: missing frame/CSRF middleware for the native JSON API (nginx rejects browser Origin), HSTS subdomains off and preload off. No warning-free deploy or AI-quality acceptance is claimed.

At 730 hours/month, checked retail rates are USD 0.0468/hour compute + USD 4.80/month disk + USD 0.005/hour public IPv4: **USD 42.614/month before disk transactions, bandwidth, backups or other usage**. USD 100 therefore funds roughly two months, not a promised year of this stack. [VM rate](https://prices.azure.com/api/retail/prices?currencyCode=%27USD%27&%24filter=armRegionName+eq+%27koreacentral%27+and+armSkuName+eq+%27Standard_B2als_v2%27+and+productName+eq+%27Virtual+Machines+Basv2+Series%27+and+meterName+eq+%27B2als+v2%27+and+priceType+eq+%27Consumption%27), [disk rate](https://prices.azure.com/api/retail/prices?currencyCode=%27USD%27&%24filter=armRegionName+eq+%27koreacentral%27+and+productName+eq+%27Standard+SSD+Managed+Disks%27+and+meterName+eq+%27E6+LRS+Disk%27+and+priceType+eq+%27Consumption%27), [IPv4 rate](https://prices.azure.com/api/retail/prices?currencyCode=%27USD%27&%24filter=armRegionName+eq+%27koreacentral%27+and+productName+eq+%27IP+Addresses%27+and+meterName+eq+%27Standard+IPv4+Static+Public+IP%27+and+priceType+eq+%27Consumption%27).

Check actual credit use in Azure Cost Management. Deallocating the VM stops compute charges while retained disks and public IPs can still cost money. Stopping the app or guest OS is insufficient. Plan an explicit semester-end export and resource-retirement review; no automatic shutdown, deletion or backup schedule is configured. Keep backups before approving any deletion. [Azure cost guidance](https://learn.microsoft.com/en-us/azure/virtual-machines/cost-optimization-plan-to-manage-costs).
