import { whenDocumentReady } from "./modules/dom.js";
import { initializeChatRequestState } from "./modules/chat-request.js";
const themeStorageKey = "novaris-theme";
const fallbackTheme = "light";
const supportedThemes = readSupportedThemes();
const themeColors = {
    light: "#f6f7f9",
    dark: "#171a1d",
    blue: "#0d1220"
};
const phi4Model = "phi4";
const phi4Presets = new Set([
    "Math",
    "AnalyticalReasoning",
    "TechnicalProblemSolving"
]);
applyStoredTheme();
whenDocumentReady(() => {
    initializeThemeToggle();
    initializeSyntaxHighlighting();
    initializePhi4PresetSelection();
    initializeChatRequestState(highlightCodeBlocks);
});
window.addEventListener("novaris-highlight-ready", initializeSyntaxHighlighting);
function initializeSyntaxHighlighting() {
    highlightCodeBlocks(document);
}
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
function initializePhi4PresetSelection() {
    const form = document.querySelector("[data-chat-request-form]");
    const model = form?.querySelector("[data-chat-model]");
    const preset = form?.querySelector("[data-chat-preset]");
    if (model === undefined || model === null || preset === undefined || preset === null) {
        return;
    }
    preset.addEventListener("change", () => {
        if (phi4Presets.has(preset.value)) {
            model.value = phi4Model;
        }
    });
}
function highlightCodeBlocks(container) {
    if (window.hljs === undefined) {
        return;
    }
    for (const codeBlock of container.querySelectorAll("pre code")) {
        if (!codeBlock.classList.contains("hljs")) {
            window.hljs.highlightElement(codeBlock);
        }
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
    updateThemeColor(theme);
    for (const button of themeButtons) {
        const isActive = button.dataset.themeOption === theme;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.classList.toggle("theme-toggle__button--active", isActive);
    }
}
function updateThemeColor(theme) {
    const themeColor = themeColors[theme];
    const themeColorMeta = document.querySelector("[data-theme-color]");
    if (themeColor !== undefined && themeColorMeta !== null) {
        themeColorMeta.content = themeColor;
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
