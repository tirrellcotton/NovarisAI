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
    const responsePanel = document.querySelector<HTMLElement>("[data-chat-response]");
    const responseContent = responsePanel?.querySelector<HTMLElement>("[data-chat-response-content]");
    const validationSummary = form?.querySelector<HTMLElement>("[data-valmsg-summary]");

    if (form === null || form === undefined
        || submitButton === null || submitButton === undefined
        || submitStatus === null || submitStatus === undefined
        || responsePanel === null || responsePanel === undefined
        || responseContent === null || responseContent === undefined) {
        return;
    }

    const resetRequestState = (): void => {
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    };

    const markResponseStarted = (): void => {
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    };

    const showError = (message: string): void => {
        if (validationSummary === null || validationSummary === undefined) {
            return;
        }

        validationSummary.textContent = message;
        validationSummary.classList.add("validation-summary-errors");
    };

    const clearError = (): void => {
        if (validationSummary === null || validationSummary === undefined) {
            return;
        }

        validationSummary.textContent = "";
        validationSummary.classList.remove("validation-summary-errors");
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            return;
        }

        if (submitButton.disabled) {
            event.preventDefault();
            return;
        }

        clearError();
        form.setAttribute("aria-busy", "true");
        submitButton.disabled = true;
        submitButton.classList.add("chat__submit--loading");
        submitStatus.hidden = false;

        responseContent.textContent = "";
        responsePanel.hidden = false;

        try {
            const response = await fetch(form.dataset.streamUrl ?? form.action, {
                method: "POST",
                body: new FormData(form),
                headers: {
                    Accept: "text/plain"
                }
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Unable to complete the request.");
            }

            const reader = response.body?.getReader();

            if (reader === undefined) {
                throw new Error("The browser could not read the streamed response.");
            }

            const decoder = new TextDecoder();
            let hasReceivedContent = false;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                responseContent.textContent += chunk;

                if (!hasReceivedContent && chunk.length > 0) {
                    hasReceivedContent = true;
                    markResponseStarted();
                }
            }

            const finalChunk = decoder.decode();
            responseContent.textContent += finalChunk;

            if (!hasReceivedContent && finalChunk.length > 0) {
                markResponseStarted();
            }
        } catch (error) {
            if (responseContent.textContent?.trim().length === 0) {
                responsePanel.hidden = true;
            }

            showError(error instanceof Error ? error.message : "Unable to complete the request.");
        } finally {
            resetRequestState();
        }
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
