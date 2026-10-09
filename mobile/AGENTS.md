# OutLoud mobile instructions

Follow the [shared agent instructions](../AGENTS.md). This is the Android-only
Expo / React Native / TypeScript client; use the architecture mapped in
[the source-alignment document](../docs/source-alignment.md).

## Check versions before using APIs

Read `package.json` and the lockfile before changing Expo or React Native code.
Consult the official documentation matching the installed version for APIs you use:
`https://docs.expo.dev/versions/v<major>.0.0/`.
Use `https://docs.expo.dev/llms.txt` to locate other relevant Expo documentation.
Do not assume the latest documentation matches this checkout.

## Commands and dependencies

Use the existing npm scripts and `package-lock.json`:

```sh
npm run check             # typecheck, lint and unit tests
npm run bundle:android    # Android JavaScript export
npm run android           # local Android development build
npm start                 # Metro for the development client
```

Use `npx expo install <package>` for Expo/React Native dependencies that need SDK
compatibility. Inspect the resulting manifest/lockfile diff. Run `npx expo-doctor`
when diagnosing configuration or dependency issues; do not run broad dependency
fixes as routine cleanup.

Mobile code changes need the relevant checks and Android flow verification described
in the shared instructions. Documentation-only edits need accuracy/link/diff checks,
not lint, typechecking or a rebuild solely because the file is under `mobile/`.

## Navigation and native development

- Use Expo Router. Keep screens/layouts in `src/app/`; keep helpers and components
  outside the route directory. Preserve existing navigation contracts.
- Use local Android builds. When needed, run `npm run prebuild:android`, then open
  the generated `android/` project in Android Studio. Keep Metro running.
- Configure native behavior through `app.json` and config plugins. Do not hand-edit
  or commit generated native directories, even when they already exist locally.
- Native dependency/configuration changes may require a new Android development
  build; Expo Go and a successful JS export do not prove native compatibility.
  Do not add iOS, cloud-build or publishing setup unless requested.

## Feature boundaries

Read the [handoff](../docs/iteration-1-handoff.md) and
[API contract](../docs/api-contract.md) when changing feature boundaries. Inspect
this branch to determine which flows are real and which use fixtures; preserve their
labels. Coordinate shared contract changes and keep provider credentials on the backend.
