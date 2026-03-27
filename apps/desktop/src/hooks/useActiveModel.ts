import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useActiveModel() {
  const [activeModel, setActiveModelState] = useState("");

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((settings) => {
      const model = settings["active_model"];
      if (model) {
        setActiveModelState(model);
      } else {
        // First launch: settings table not yet seeded — fall back to yml config
        invoke<{ model: string }>("get_ai_config")
          .then(({ model: m }) => { if (m) setActiveModelState(m); })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const setActiveModel = useCallback((model: string) => {
    setActiveModelState(model);
    invoke("set_setting", { key: "active_model", value: model });
  }, []);

  return { activeModel, setActiveModel };
}
