import { applyTheme, readThemePreference } from "./theme";
// Initialize theme before React renders
function initTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = readThemePreference(localStorage.getItem("theme"), prefersDark);
    applyTheme(theme);
}
// Run immediately, before any React code
if (typeof document !== "undefined") {
    initTheme();
}
export { initTheme };
//# sourceMappingURL=theme-init.js.map