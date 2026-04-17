// Initialize theme before React renders
function initTheme() {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const stored = localStorage.getItem("theme");
  const isDark = stored ? stored === "dark" : prefersDark;
  
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Run immediately, before any React code
if (typeof document !== "undefined") {
  initTheme();
}

export { initTheme };
