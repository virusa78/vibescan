export type ThemeMode = "light" | "dark";
export declare function readThemePreference(storedValue: string | null, prefersDark: boolean): ThemeMode;
export declare function applyTheme(theme: ThemeMode): void;
export declare function persistTheme(theme: ThemeMode): void;
//# sourceMappingURL=theme.d.ts.map