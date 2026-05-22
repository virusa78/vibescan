export function readThemePreference(storedValue, prefersDark) {
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
    }
    catch {
        return prefersDark ? "dark" : "light";
    }
    return prefersDark ? "dark" : "light";
}
export function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
}
export function persistTheme(theme) {
    window.localStorage.setItem("theme", theme);
}
//# sourceMappingURL=theme.js.map