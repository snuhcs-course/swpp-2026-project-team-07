// Public endpoint only; the demo code is entered by the user and never bundled.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000/api"
).replace(/\/+$/, "");
export const DEMO_CODE_REQUIRED = process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE === "1";
