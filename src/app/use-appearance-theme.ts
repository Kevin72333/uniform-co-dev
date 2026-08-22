import { useEffect, useSyncExternalStore } from "react";

export const appearanceThemes = [
  { id: "current", label: "現在風格", description: "Apple-inspired" },
  { id: "previous", label: "修改前風格", description: "Prototype C" },
] as const;

export type AppearanceTheme = (typeof appearanceThemes)[number]["id"];

const STORAGE_KEY = "uniform:appearance-theme";

function isAppearanceTheme(value: string | null): value is AppearanceTheme {
  return appearanceThemes.some((theme) => theme.id === value);
}

function getStoredTheme(): AppearanceTheme {
  if (typeof window === "undefined") return "current";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isAppearanceTheme(stored) ? stored : "current";
}

function getServerTheme(): AppearanceTheme {
  return "current";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("uniform:appearance-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("uniform:appearance-change", onStoreChange);
  };
}

export function useAppearanceTheme() {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, getServerTheme);

  useEffect(() => {
    document.documentElement.dataset.appearance = theme;
  }, [theme]);

  function setTheme(nextTheme: AppearanceTheme) {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    document.documentElement.dataset.appearance = nextTheme;
    window.dispatchEvent(new Event("uniform:appearance-change"));
  }

  return { theme, setTheme };
}
