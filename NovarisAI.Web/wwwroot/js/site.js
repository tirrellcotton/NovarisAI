import { whenDocumentReady } from "./modules/dom.js";
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
    initializeProgressiveWebApp();
    initializeThemeToggle();
    initializeSyntaxHighlighting();
    initializePhi4PresetSelection();
    initializeChatRequestState();
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
function initializeChatRequestState() {
    const form = document.querySelector("[data-chat-request-form]");
    const submitButton = form?.querySelector("[data-chat-submit]");
    const submitStatus = submitButton?.querySelector(".chat__submit-status");
    const responsePanel = document.querySelector("[data-chat-response]");
    const history = responsePanel?.querySelector("[data-chat-history]");
    const validationSummary = form?.querySelector("[data-valmsg-summary]");
    const conversationId = form?.querySelector("[data-chat-conversation-id]");
    const prompt = form?.querySelector("[name=Prompt]");
    if (form === null || form === undefined
        || submitButton === null || submitButton === undefined
        || submitStatus === null || submitStatus === undefined
        || responsePanel === null || responsePanel === undefined
        || history === null || history === undefined
        || conversationId === null || conversationId === undefined
        || prompt === null || prompt === undefined) {
        return;
    }
    const resetRequestState = () => {
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    };
    const markResponseStarted = () => {
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    };
    const showError = (message) => {
        if (validationSummary === null || validationSummary === undefined) {
            return;
        }
        validationSummary.textContent = message;
        validationSummary.classList.add("validation-summary-errors");
    };
    const clearError = () => {
        if (validationSummary === null || validationSummary === undefined) {
            return;
        }
        validationSummary.textContent = "";
        validationSummary.classList.remove("validation-summary-errors");
    };
    const appendMessage = (role, content) => {
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
    const renderMarkdown = async (messageContent, markdown) => {
        const markdownUrl = form.dataset.markdownUrl;
        if (markdownUrl === undefined) {
            return;
        }
        const requestBody = new FormData();
        const antiForgeryToken = form.querySelector("input[name=__RequestVerificationToken]");
        requestBody.append("markdown", markdown);
        if (antiForgeryToken !== null) {
            requestBody.append(antiForgeryToken.name, antiForgeryToken.value);
        }
        try {
            const response = await fetch(markdownUrl, {
                method: "POST",
                body: requestBody,
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
        }
        catch {
        }
    };
    const updateConversationLocation = (id) => {
        if (id === null || id.length === 0) {
            return;
        }
        conversationId.value = id;
        const url = new URL(window.location.href);
        url.searchParams.set("conversationId", id);
        window.history.replaceState({}, "", url);
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
        responsePanel.hidden = false;
        const promptContent = prompt.value;
        const userMessageContent = appendMessage("user", promptContent);
        const responseContent = appendMessage("assistant", "");
        const requestBody = new FormData(form);
        prompt.value = "";
        void renderMarkdown(userMessageContent, promptContent);
        try {
            const response = await fetch(form.dataset.streamUrl ?? form.action, {
                method: "POST",
                body: requestBody,
                headers: {
                    Accept: "text/plain"
                }
            });
            updateConversationLocation(response.headers.get("X-Conversation-Id"));
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
            await renderMarkdown(responseContent, responseContent.textContent ?? "");
        }
        catch (error) {
            if (responseContent.textContent?.trim().length === 0) {
                responseContent.parentElement?.parentElement?.remove();
            }
            showError(error instanceof Error ? error.message : "Unable to complete the request.");
        }
        finally {
            resetRequestState();
        }
    });
    window.addEventListener("pageshow", resetRequestState);
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
function initializeProgressiveWebApp() {
    if (!("serviceWorker" in navigator)) {
        return;
    }
    void navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
        updateViaCache: "none"
    }).then((registration) => {
        observeServiceWorkerUpdates(registration);
    }).catch(() => {
        // PWA registration is progressive enhancement and must never block chat.
    });
}
function observeServiceWorkerUpdates(registration) {
    const updatePrompt = document.querySelector("[data-pwa-update]");
    const updateAction = document.querySelector("[data-pwa-update-action]");
    let refreshRequested = false;
    const showUpdatePrompt = () => {
        if (registration.waiting === null || updatePrompt === null || updateAction === null) {
            return;
        }
        updatePrompt.hidden = false;
        updateAction.onclick = () => {
            if (isChatRequestActive()) {
                updateAction.textContent = "Finish request to update";
                return;
            }
            refreshRequested = true;
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        };
    };
    if (registration.waiting !== null) {
        showUpdatePrompt();
    }
    registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (installingWorker === null) {
            return;
        }
        installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller !== null) {
                showUpdatePrompt();
            }
        });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshRequested) {
            window.location.reload();
        }
    }, { once: true });
}
function isChatRequestActive() {
    return document.querySelector("[data-chat-request-form]")
        ?.getAttribute("aria-busy") === "true";
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
