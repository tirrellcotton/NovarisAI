import { whenDocumentReady } from "./modules/dom.js";
const themeStorageKey = "novaris-theme";
const fallbackTheme = "light";
const supportedThemes = readSupportedThemes();
applyStoredTheme();
whenDocumentReady(() => {
    initializeThemeToggle();
});
function initializeThemeToggle() {
    const root = document.documentElement;
    const themeButtons = Array.from(document.querySelectorAll("[data-theme-option]"));
    if (themeButtons.length === 0) {
        return;
    }
    const activeTheme = isThemeName(root.dataset.theme)
        ? root.dataset.theme
        : readStoredTheme() ?? fallbackTheme;
    applyTheme(activeTheme, root, themeButtons);
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
function applyStoredTheme() {
    const storedTheme = readStoredTheme();
    if (storedTheme !== null) {
        document.documentElement.dataset.theme = storedTheme;
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
function readSupportedThemes() {
    return Array.isArray(window.novarisThemes) && window.novarisThemes.length > 0
        ? window.novarisThemes
        : [fallbackTheme];
}
function isThemeName(value) {
    return value !== null
        && value !== undefined
        && supportedThemes.includes(value);
}
