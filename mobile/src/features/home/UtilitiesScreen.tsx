import { useState } from "react";
import { router } from "expo-router";
import { API_URL, checkBackend } from "../../services/api";
import { activeLayout } from "../../layouts/registry";
export function UtilitiesScreen() { return <activeLayout.Utilities model={useUtilitiesController()} />; }
export function useUtilitiesController() {
  const [checking, setChecking] = useState(false),
    [notice, setNotice] = useState("");
  async function connect() {
    if (checking) return;
    setChecking(true);
    try {
      setNotice(await checkBackend());
    } catch {
      setNotice(
        "Could not reach the backend. Check the configured server and connection.",
      );
    } finally {
      setChecking(false);
    }
  }
  return { apiUrl: API_URL, checking, notice, connect, openSample: () => router.push("/viewer") };
}
