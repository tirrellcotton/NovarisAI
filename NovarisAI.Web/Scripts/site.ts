import { whenDocumentReady } from "./modules/dom.js";
import { initializeChatRequestState } from "./modules/chat-request.js";

type ThemeName = string;

declare global {
    interface Window {
        novarisThemes?: string[];
        hljs?: {
            highlightElement: (element: HTMLElement) => void;
        };
    }
}

const themeStorageKey = "novaris-theme";
const fallbackTheme = "light";
const supportedThemes = readSupportedThemes();
const themeColors: Record<string, string> = {
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

function initializeSyntaxHighlighting(): void {
    highlightCodeBlocks(document);
}

function initializeThemeToggle(): void {
    const root = document.documentElement;
    const themeButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));

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

function initializePhi4PresetSelection(): void {
    const form = document.querySelector<HTMLFormElement>("[data-chat-request-form]");
    const model = form?.querySelector<HTMLSelectElement>("[data-chat-model]");
    const preset = form?.querySelector<HTMLSelectElement>("[data-chat-preset]");

    if (model === undefined || model === null || preset === undefined || preset === null) {
        return;
    }

    preset.addEventListener("change", () => {
        if (phi4Presets.has(preset.value)) {
            model.value = phi4Model;
        }
    });
}

function highlightCodeBlocks(container: ParentNode): void {
    if (window.hljs === undefined) {
        return;
    }

    for (const codeBlock of container.querySelectorAll<HTMLElement>("pre code")) {
        if (!codeBlock.classList.contains("hljs")) {
            window.hljs.highlightElement(codeBlock);
        }
    }
}

function applyStoredTheme(): void {
    const storedTheme = readStoredTheme();

    if (storedTheme !== null) {
        document.documentElement.dataset.theme = storedTheme;
    }
}

function applyTheme(
    theme: ThemeName,
    root: HTMLElement,
    themeButtons: HTMLButtonElement[]): void {
    root.dataset.theme = theme;
    updateThemeColor(theme);

    for (const button of themeButtons) {
        const isActive = button.dataset.themeOption === theme;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.classList.toggle("theme-toggle__button--active", isActive);
    }
}

function updateThemeColor(theme: ThemeName): void {
    const themeColor = themeColors[theme];
    const themeColorMeta = document.querySelector<HTMLMetaElement>("[data-theme-color]");

    if (themeColor !== undefined && themeColorMeta !== null) {
        themeColorMeta.content = themeColor;
    }
}

function readStoredTheme(): ThemeName | null {
    try {
        const storedTheme = window.localStorage.getItem(themeStorageKey);
        return isThemeName(storedTheme) ? storedTheme : null;
    } catch {
        return null;
    }
}

function storeTheme(theme: ThemeName): void {
    try {
        window.localStorage.setItem(themeStorageKey, theme);
    } catch {
    }
}

function readSupportedThemes(): ThemeName[] {
    return Array.isArray(window.novarisThemes) && window.novarisThemes.length > 0
        ? window.novarisThemes
        : [fallbackTheme];
}

function isThemeName(value: string | undefined | null): value is ThemeName {
    return value !== null
        && value !== undefined
        && supportedThemes.includes(value);
}
