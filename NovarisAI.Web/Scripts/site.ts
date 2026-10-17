import { whenDocumentReady } from "./modules/dom.js";
import { initializePromptKeyboard } from "./modules/prompt-keyboard.js";
import { initializeHistoryScroll } from "./modules/history-scroll.js";

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
    initializeChatRequestState();
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

function initializeChatRequestState(): void {
    const form = document.querySelector<HTMLFormElement>("[data-chat-request-form]");
    const submitButton = form?.querySelector<HTMLButtonElement>("[data-chat-submit]");
    const stopButton = form?.querySelector<HTMLButtonElement>("[data-chat-stop]");
    const requestStatus = form?.querySelector<HTMLElement>("[data-chat-request-status]");
    const submitStatus = submitButton?.querySelector<HTMLElement>(".chat__submit-status");
    const responsePanel = document.querySelector<HTMLElement>("[data-chat-response]");
    const history = responsePanel?.querySelector<HTMLElement>("[data-chat-history]");
    const validationSummary = form?.querySelector<HTMLElement>("[data-valmsg-summary]");
    const conversationId = form?.querySelector<HTMLInputElement>("[data-chat-conversation-id]");
    const prompt = form?.querySelector<HTMLTextAreaElement>("[name=Prompt]");
    const clearHistoryForm = document.querySelector<HTMLFormElement>("[data-chat-clear-form]");
    const clearHistoryButton = clearHistoryForm?.querySelector<HTMLButtonElement>("[data-chat-clear]");

    if (form === null || form === undefined
        || submitButton === null || submitButton === undefined
        || stopButton === null || stopButton === undefined
        || requestStatus === null || requestStatus === undefined
        || submitStatus === null || submitStatus === undefined
        || responsePanel === null || responsePanel === undefined
        || history === null || history === undefined
        || conversationId === null || conversationId === undefined
        || prompt === null || prompt === undefined) {
        return;
    }

    initializePromptKeyboard(form, prompt, submitButton);
    const followLatestMessage = initializeHistoryScroll(history);

    let activeRequest: AbortController | undefined;

    stopButton.addEventListener("click", () => {
        activeRequest?.abort();
        stopButton.disabled = true;
    });

    const resetRequestState = (): void => {
        activeRequest = undefined;
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
        stopButton.hidden = true;
        if (clearHistoryButton) {
            clearHistoryButton.disabled = false;
        }
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

    const appendMessage = (role: "user" | "assistant", content: string): HTMLElement => {
        const message = document.createElement("article");
        const roleLabel = document.createElement("p");
        const messageContent = document.createElement("div");

        message.className = `chat__message chat__message--${role}`;
        roleLabel.className = "chat__message-role";
        roleLabel.textContent = role;
        messageContent.className = "chat__message-content markdown-content";
        messageContent.textContent = content;

        message.append(roleLabel, messageContent);
        history.append(message);

        return messageContent;
    };

    const renderMarkdown = async (
        messageContent: HTMLElement, markdown: string, signal?: AbortSignal): Promise<void> => {
        const markdownUrl = form.dataset.markdownUrl;

        if (markdownUrl === undefined) {
            return;
        }

        const requestBody = new FormData();
        const antiForgeryToken = form.querySelector<HTMLInputElement>(
            "input[name=__RequestVerificationToken]");

        requestBody.append("markdown", markdown);

        if (antiForgeryToken !== null) {
            requestBody.append(antiForgeryToken.name, antiForgeryToken.value);
        }

        try {
            const response = await fetch(markdownUrl, {
                method: "POST",
                body: requestBody,
                signal,
                headers: {
                    Accept: "text/html"
                }
            });

            if (!response.ok) {
                return;
            }

            messageContent.innerHTML = await response.text();
            messageContent.classList.add("markdown-content--rendered");
            highlightCodeBlocks(messageContent);
        } catch {
        }
    };

    const updateConversationLocation = (id: string | null): void => {
        if (id === null) {
            return;
        }

        conversationId.value = id;

        const url = new URL(window.location.href);
        if (id.length === 0) {
            url.searchParams.delete("conversationId");
        } else {
            url.searchParams.set("conversationId", id);
        }
        window.history.replaceState({}, "", url);
    };

    clearHistoryForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submitButton.disabled || !clearHistoryButton) {
            return;
        }

        submitButton.disabled = true;
        clearHistoryButton.disabled = true;
        clearHistoryForm.setAttribute("aria-busy", "true");
        clearError();

        try {
            const requestBody = new FormData(clearHistoryForm);
            requestBody.set("conversationId", conversationId.value);
            const response = await fetch(clearHistoryForm.action, { method: "POST", body: requestBody });
            if (!response.ok) {
                throw new Error("Unable to clear conversation history. Please try again.");
            }

            history.replaceChildren();
            responsePanel.hidden = true;
            updateConversationLocation("");
            requestStatus.textContent = "Conversation history cleared.";
            prompt.focus();
        } catch (error) {
            showError(error instanceof Error ? error.message : "Unable to clear conversation history.");
        } finally {
            clearHistoryForm.removeAttribute("aria-busy");
            resetRequestState();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (prompt.value.trim().length === 0) {
            return;
        }

        if (!form.checkValidity()) {
            return;
        }

        if (submitButton.disabled) {
            event.preventDefault();
            return;
        }

        clearError();
        const controller = new AbortController();
        activeRequest = controller;
        requestStatus.textContent = "";
        stopButton.hidden = false;
        stopButton.disabled = false;
        form.setAttribute("aria-busy", "true");
        submitButton.disabled = true;
        if (clearHistoryButton) {
            clearHistoryButton.disabled = true;
        }
        submitButton.classList.add("chat__submit--loading");
        submitStatus.hidden = false;

        responsePanel.hidden = false;
        const promptContent = prompt.value;
        const userMessageContent = appendMessage("user", promptContent);
        const responseContent = appendMessage("assistant", "");
        followLatestMessage();
        const requestBody = new FormData(form);
        prompt.value = "";

        void renderMarkdown(userMessageContent, promptContent);

        try {
            const response = await fetch(form.dataset.streamUrl ?? form.action, {
                method: "POST",
                body: requestBody,
                signal: controller.signal,
                headers: {
                    Accept: "text/plain"
                }
            });

            updateConversationLocation(response.headers.get("X-Conversation-Id"));

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Unable to complete the request.");
            }

            await readChatResponse(response, responseContent, markResponseStarted, controller.signal);
            stopButton.hidden = true;
            activeRequest = undefined;
            await renderMarkdown(responseContent, responseContent.textContent ?? "", controller.signal);
        } catch (error) {
            if (responseContent.textContent?.trim().length === 0) {
                responseContent.parentElement?.remove();
            }

            if (controller.signal.aborted) {
                requestStatus.textContent = "Request stopped.";
                if (prompt.value.length === 0) {
                    prompt.value = promptContent;
                }
                prompt.focus();
                return;
            }

            showError(error instanceof Error ? error.message : "Unable to complete the request.");
        } finally {
            resetRequestState();
        }
    });

    window.addEventListener("pageshow", resetRequestState);
}

async function readChatResponse(
    response: Response,
    content: HTMLElement,
    onContent: () => void,
    signal: AbortSignal): Promise<void> {
    const reader = response.body?.getReader();
    if (reader === undefined) {
        throw new Error("The browser could not read the streamed response.");
    }

    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await reader.read();
            signal.throwIfAborted();
            if (done) {
                content.textContent += decoder.decode();
                return;
            }

            const chunk = decoder.decode(value, { stream: true });
            content.textContent += chunk;
            if (chunk.length > 0) {
                onContent();
            }
        }
    } finally {
        reader.releaseLock();
    }
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
