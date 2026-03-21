import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((s) => {
      const t = s["theme"] as Theme | undefined;
      if (t) {
        setThemeState(t);
        applyTheme(t);
      }
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    invoke("set_setting", { key: "theme", value: t });
  }, []);

  return { theme, setTheme };
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}
