export type ThemeMode = "light" | "dark";

export function readThemePreference(
  storedValue: string | null,
  prefersDark: boolean,
): ThemeMode {
  if (!storedValue) {
    return prefersDark ? "dark" : "light";
  }

  if (storedValue === "light" || storedValue === "dark") {
    return storedValue;
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (parsed === "light" || parsed === "dark") {
      return parsed;
    }
  } catch {
    return prefersDark ? "dark" : "light";
  }

  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: ThemeMode) {
  window.localStorage.setItem("theme", theme);
}
