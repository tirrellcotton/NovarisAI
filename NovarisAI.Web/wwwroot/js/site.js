import { whenDocumentReady } from "./modules/dom.js";
const themeStorageKey = "novaris-theme";
const supportedThemes = ["light", "dark", "blue"];
whenDocumentReady(() => {
    initializeThemeToggle();
});
function initializeThemeToggle() {
    const root = document.documentElement;
    const themeButtons = Array.from(document.querySelectorAll("[data-theme-option]"));
    if (themeButtons.length === 0) {
        return;
    }
    const storedTheme = readStoredTheme();
    applyTheme(storedTheme ?? "light", root, themeButtons);
    for (const button of themeButtons) {
        button.addEventListener("click", () => {
            const requestedTheme = button.dataset.themeOption;
            if (!isThemeName(requestedTheme)) {
                return;
            }
            applyTheme(requestedTheme, root, themeButtons);
            storeTheme(requestedTheme);
        });
    }
}
function applyTheme(theme, root, themeButtons) {
    root.dataset.theme = theme;
    for (const button of themeButtons) {
        const isActive = button.dataset.themeOption === theme;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.classList.toggle("theme-toggle__button--active", isActive);
    }
}
function readStoredTheme() {
    try {
        const storedTheme = window.localStorage.getItem(themeStorageKey);
        return isThemeName(storedTheme) ? storedTheme : null;
    }
    catch {
        return null;
    }
}
function storeTheme(theme) {
    try {
        window.localStorage.setItem(themeStorageKey, theme);
    }
    catch {
    }
}
function isThemeName(value) {
    return value !== null
        && value !== undefined
        && supportedThemes.includes(value);
}
