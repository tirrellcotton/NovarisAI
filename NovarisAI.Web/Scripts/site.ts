import { whenDocumentReady } from "./modules/dom.js";

type ThemeName = string;

declare global {
    interface Window {
        novarisThemes?: string[];
    }
}

const themeStorageKey = "novaris-theme";
const fallbackTheme = "light";
const supportedThemes = readSupportedThemes();

applyStoredTheme();

whenDocumentReady(() => {
    initializeThemeToggle();
    initializeChatRequestState();
});

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

function initializeChatRequestState(): void {
    const form = document.querySelector<HTMLFormElement>("[data-chat-request-form]");
    const submitButton = form?.querySelector<HTMLButtonElement>("[data-chat-submit]");
    const submitStatus = submitButton?.querySelector<HTMLElement>(".chat__submit-status");

    if (form === null || form === undefined || submitButton === null || submitButton === undefined || submitStatus === null || submitStatus === undefined) {
        return;
    }

    const resetRequestState = (): void => {
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    };

    form.addEventListener("submit", (event) => {
        if (!form.checkValidity()) {
            return;
        }

        if (submitButton.disabled) {
            event.preventDefault();
            return;
        }

        form.setAttribute("aria-busy", "true");
        submitButton.disabled = true;
        submitButton.classList.add("chat__submit--loading");
        submitStatus.hidden = false;
    });

    window.addEventListener("pageshow", resetRequestState);
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

    for (const button of themeButtons) {
        const isActive = button.dataset.themeOption === theme;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.classList.toggle("theme-toggle__button--active", isActive);
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
