import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";

import {
  getSettings,
  saveSettings,
  ThemeMode,
} from "../storage/clips";

interface ThemeContextValue {
  mode: ThemeMode;
  scheme: "dark" | "light";
  setMode: (m: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  mode: ThemeMode,
  systemScheme: ColorSchemeName,
): "dark" | "light" {
  if (mode === "system") {
    return systemScheme === "light" ? "light" : "dark";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  // Load persisted theme mode on mount
  useEffect(() => {
    (async () => {
      try {
        const settings = await getSettings();
        setModeState(settings.themeMode ?? "dark");
      } catch {}
    })();
  }, []);

  // Listen to system appearance changes (relevant when mode === "system")
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await saveSettings({ themeMode: m });
  }, []);

  const value: ThemeContextValue = {
    mode,
    scheme: resolveScheme(mode, systemScheme),
    setMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for places that render before provider mounts
    return {
      mode: "dark",
      scheme: "dark",
      setMode: async () => {},
    };
  }
  return ctx;
}
