import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 22;
const FONT_SIZE_DEFAULT = 16;
const FONT_SIZE_STEP = 2;

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState(FONT_SIZE_DEFAULT);

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((s) => {
      const raw = s["font_size"];
      const parsed = raw ? parseInt(raw, 10) : NaN;
      const size = isNaN(parsed) ? FONT_SIZE_DEFAULT : Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, parsed));
      setFontSizeState(size);
      applyFontSize(size);
    });
  }, []);

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
    setFontSizeState(clamped);
    applyFontSize(clamped);
    invoke("set_setting", { key: "font_size", value: String(clamped) });
  }, []);

  const increase = useCallback(() => {
    setFontSizeState((prev) => {
      const next = Math.min(FONT_SIZE_MAX, prev + FONT_SIZE_STEP);
      applyFontSize(next);
      invoke("set_setting", { key: "font_size", value: String(next) });
      return next;
    });
  }, []);

  const decrease = useCallback(() => {
    setFontSizeState((prev) => {
      const next = Math.max(FONT_SIZE_MIN, prev - FONT_SIZE_STEP);
      applyFontSize(next);
      invoke("set_setting", { key: "font_size", value: String(next) });
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setFontSizeState(FONT_SIZE_DEFAULT);
    applyFontSize(FONT_SIZE_DEFAULT);
    invoke("set_setting", { key: "font_size", value: String(FONT_SIZE_DEFAULT) });
  }, []);

  return { fontSize, setFontSize, increase, decrease, reset };
}

function applyFontSize(size: number) {
  document.documentElement.style.setProperty("--base-font-size", `${size}px`);
  document.documentElement.style.fontSize = `${size}px`;
}
