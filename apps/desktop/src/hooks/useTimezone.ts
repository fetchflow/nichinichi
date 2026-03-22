import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

/** Returns the system (OS) timezone as an IANA string, e.g. "America/New_York". */
export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useTimezone() {
  const [timezone, setTimezoneState] = useState<string>(systemTimezone);

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((s) => {
      const tz = s["timezone"];
      if (tz) setTimezoneState(tz);
    });
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    invoke("set_setting", { key: "timezone", value: tz });
  }, []);

  const resetToSystem = useCallback(() => {
    const sys = systemTimezone();
    setTimezoneState(sys);
    invoke("set_setting", { key: "timezone", value: "" });
  }, []);

  return { timezone, setTimezone, resetToSystem };
}
