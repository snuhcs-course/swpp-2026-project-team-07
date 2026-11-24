# OutLoud public ONE Store release

Build 42 opens on Home. Users can use local rehearsal immediately or enable free online coaching after reading the English or Korean upload disclosure. The public API is `https://outloud-team07.koreacentral.cloudapp.azure.com/store/api`. Each installation receives its own credential through the app. Upgrading preserves recordings on the phone. Uploaded reviewer history belongs to the original reviewer service.

## Check provider coverage and set the spending limit

OutLoud uses OpenRouter for scoring and Q&A and ElevenLabs for transcription. The public service enforces a combined **US$50 lifetime limit on its requests**. The course beta ends on December 11, 2026 in Seoul. Set `OUTLOUD_PUBLIC_AI_UNTIL=2026-12-12T00:00:00+09:00` to stop new paid requests at midnight. Azure hosting and requests made outside the public service have their own billing. Store provider credentials only in the private server environment.

The public PostgreSQL ledger reserves money before each provider call, including retries, translations and recording segments. OpenRouter requests pin the model and provider, disable tools and web search, and reserve for the full input context, requested output and possible routing charges. A completed receipt with a verified price releases the unused reservation. Unexpected tool or separately billed routing activity stops new work. Scribe uses the length of the normalized mono recording and rounds each call up to a whole minute at the configured hourly ceiling. A request that exceeds the remaining allowance stops before dispatch. Keep the ledger across releases and reconcile outstanding charges after any database restore.

Check the selected model's context and both providers' rates when changing the deployment. The store's rates must cover the model's most expensive input and output tiers and Scribe's vocabulary hints and minimum billing. A provider-side limit can provide additional protection for activity outside OutLoud. [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection) · [ElevenLabs speech-to-text](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)

To suspend both providers, clear both keys in the private store environment and recreate the store API, worker and scheduler. The feedback flags control coaching features. Full-recording transcription also checks its own ElevenLabs credential.

## Start the isolated service on Azure

Use a separate checkout at `/srv/outloud-store`. It has its own PostgreSQL, Redis, media volume and worker. The Compose project is `outloud-store`. Only the store nginx joins the additional `outloud-store-ingress` network. The store stack publishes no host ports.

1. In the separate checkout, copy `deploy/store.env.example` to `deploy/.env.store` only on first setup, with mode `600`. Generate unique Django and PostgreSQL secrets on the server. Keep the preexisting tester and study environments in their own directories.
2. Populate the model, verified price ceilings and restricted keys directly in the private store environment. Enable `FEEDBACK_ENABLED`, `FEEDBACK_V3_ENABLED`, `FEEDBACK_V3_AUTO_START` and `INCREMENTAL_CAPTURE_ENABLED` when the accounts are ready. Running with empty credentials permits infrastructure and ownership testing.
3. Apply migrations and start the stack. Use the candidate's reviewed image tag. On a shared VM, check available memory, disk space and the health of the tester and study workloads before and after starting it.

```sh
cd /srv/outloud-store
store() { sudo docker compose --env-file deploy/.env.store -f compose.production.yaml -f compose.store.yaml "$@"; }
store build api
store up -d --wait db redis
store run --rm --no-deps -T api python manage.py migrate
store up -d --wait api worker scheduler proxy
store ps
store exec -T worker celery -A config inspect ping
```

4. Connect the existing Caddy to the store nginx with the additional network and route mount in `compose.store-edge.yaml`. Add `import /etc/caddy/store-route/*.caddy` inside the existing live HTTPS site, before its catch-all. Preserve the live study routes and reviewer authentication. Validate the merged Caddyfile with the running Caddy version and retain its previous configuration for rollback. Recheck the existing services after enabling the route. Removing the store route and disconnecting its ingress network rolls back public access while preserving its data and spending ledger.
5. Check the public `/store/privacy/` and `/store/api/health/` URLs over trusted HTTPS. Verify two installations can upload the same PDF independently and only access their own recordings, slide images, scores and Q&A. Check that the original reviewer URL still requires its existing code. The automated edge check is `python3 deploy/test_public_edge.py` on a workstation with Docker.

## Build and sign for ONE Store

The signing kit in the build 42 GitHub release includes the verified unsigned APK and a script for the Team 07 key holder. Extract the ZIP, open a terminal in that folder and run the command below. On Windows, use `py -3` for Python. The script prompts for passwords locally, checks the original signing certificate and writes the APK and checksum under `signed/`.

```sh
python3 sign_release.py "/path/to/team07-release.jks"
```

To rebuild the signing input, use Node 24, JDK 17 and the Android SDK specified in the repository. Run these commands from a clean checkout.

```sh
cd mobile
npm ci
export EXPO_PUBLIC_ACCESS_MODE=store
export EXPO_PUBLIC_REQUIRE_DEMO_CODE=0
export EXPO_PUBLIC_API_URL=https://outloud-team07.koreacentral.cloudapp.azure.com/store/api
npx expo prebuild --platform android --no-install
npm run check
npm run bundle:android
cd android
./gradlew --init-script ../one-store-release.init.gradle :app:assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

The build produces `app/build/outputs/apk/release/app-release-unsigned.apk`. The teammate with the original Team 07 signing key can sign that exact file. Set `ANDROID_BUILD_TOOLS` to the installed Android build-tools directory and `TEAM07_KEYSTORE` and `TEAM07_ALIAS` in the signer's private shell. Allow apksigner to prompt locally for passwords.

```sh
"$ANDROID_BUILD_TOOLS/zipalign" -P 16 -f 4 app/build/outputs/apk/release/app-release-unsigned.apk OutLoud-aligned.apk
"$ANDROID_BUILD_TOOLS/apksigner" sign --ks "$TEAM07_KEYSTORE" --ks-key-alias "$TEAM07_ALIAS" \
  --out OutLoud-0.1.0-42.apk OutLoud-aligned.apk
"$ANDROID_BUILD_TOOLS/apksigner" verify --verbose --print-certs OutLoud-0.1.0-42.apk
"$ANDROID_BUILD_TOOLS/aapt" dump badging OutLoud-0.1.0-42.apk
shasum -a 256 OutLoud-0.1.0-42.apk > OutLoud-0.1.0-42.apk.sha256
```

The published builds 40 and 41 use signer SHA-256 `6fa1ce0c3adf91895b0aafeb0a545cc2c6a5d245631ef428ff9e19f1b30011b3`. Confirm the same certificate, package `com.team07.outloud`, version `0.1.0`, code `42`, and all four ABIs before updating an existing installation. A different signer prevents an in-place Android update.

## Verify the signed file and submit

- On a clean Android install, cold-launch the signed APK without a tester code. Decline uploads, open Seoul, record and play back locally. Open the privacy policy and explicitly enable coaching.
- Against the funded store service, import a PDF, record a short rehearsal, wait for a real transcript and grounded score, then generate and answer a Q&A question. Check the provider receipts and lifetime ledger. Keep recordings and keys out of release evidence.
- On a separate installation of the signed build 41, create a local rehearsal and install the same signed build 42 as an update. Verify that local audio remains playable, online consent starts unselected, and the store workspace contains only that installation's uploads.
- Upload the tested signed APK and its checksum to the team's GitHub release. The ONE Store submitter uploads the signed APK and supplies the public privacy-policy URL. The signing kit provides the unsigned input.
