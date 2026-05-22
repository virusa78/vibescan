import { useEffect, useState } from "react";
import { applyTheme, persistTheme, readThemePreference, } from "../theme";
export default function useColorMode() {
    const [colorMode, setColorMode] = useState(() => {
        if (typeof window === "undefined") {
            return "light";
        }
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return readThemePreference(window.localStorage.getItem("theme"), prefersDark);
    });
    useEffect(() => {
        persistTheme(colorMode);
        applyTheme(colorMode);
    }, [colorMode]);
    return [colorMode, setColorMode];
}
//# sourceMappingURL=useColorMode.js.map