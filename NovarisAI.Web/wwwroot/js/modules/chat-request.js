import { initializePromptKeyboard } from "./prompt-keyboard.js";
import { initializeHistoryScroll } from "./history-scroll.js";
export function initializeChatRequestState(highlightCodeBlocks) {
    const elements = findChatElements();
    if (!elements) {
        return;
    }
    new ChatRequestController(elements, highlightCodeBlocks).initialize();
}
function findChatElements() {
    const form = document.querySelector("[data-chat-request-form]");
    const responsePanel = document.querySelector("[data-chat-response]");
    if (!form || !responsePanel) {
        return null;
    }
    const controls = findChatFormControls(form);
    const history = responsePanel.querySelector("[data-chat-history]");
    if (!controls || !history) {
        return null;
    }
    const clearHistoryForm = document.querySelector("[data-chat-clear-form]");
    const clearHistoryButton = clearHistoryForm?.querySelector("[data-chat-clear]");
    const validationSummary = form.querySelector("[data-valmsg-summary]");
    return {
        form, ...controls, responsePanel, history, validationSummary,
        clearHistoryForm, clearHistoryButton
    };
}
function findChatFormControls(form) {
    const submitButton = form.querySelector("[data-chat-submit]");
    const stopButton = form.querySelector("[data-chat-stop]");
    const requestStatus = form.querySelector("[data-chat-request-status]");
    const submitStatus = submitButton?.querySelector(".chat__submit-status");
    const conversationId = form.querySelector("[data-chat-conversation-id]");
    const prompt = form.querySelector("[name=Prompt]");
    if (!submitButton || !stopButton || !requestStatus || !submitStatus || !conversationId || !prompt) {
        return null;
    }
    return { submitButton, stopButton, requestStatus, submitStatus, conversationId, prompt };
}
class ChatRequestController {
    elements;
    highlightCodeBlocks;
    activeRequest;
    followLatestMessage;
    constructor(elements, highlightCodeBlocks) {
        this.elements = elements;
        this.highlightCodeBlocks = highlightCodeBlocks;
        this.followLatestMessage = initializeHistoryScroll(elements.history);
    }
    initialize() {
        const { form, prompt, submitButton, stopButton, clearHistoryForm } = this.elements;
        initializePromptKeyboard(form, prompt, submitButton);
        stopButton.addEventListener("click", () => this.stopRequest());
        clearHistoryForm?.addEventListener("submit", event => this.clearHistory(event));
        form.addEventListener("submit", event => this.submit(event));
        window.addEventListener("pageshow", () => this.resetRequestState());
    }
    stopRequest() {
        this.activeRequest?.abort();
        this.elements.stopButton.disabled = true;
    }
    resetRequestState() {
        const { form, submitButton, stopButton, submitStatus, clearHistoryButton } = this.elements;
        this.activeRequest = undefined;
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
        stopButton.hidden = true;
        if (clearHistoryButton) {
            clearHistoryButton.disabled = false;
        }
    }
    markResponseStarted() {
        const { submitButton, submitStatus } = this.elements;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    }
    showError(message) {
        const { validationSummary } = this.elements;
        if (!validationSummary) {
            return;
        }
        validationSummary.textContent = message;
        validationSummary.classList.add("validation-summary-errors");
    }
    clearError() {
        const { validationSummary } = this.elements;
        if (!validationSummary) {
            return;
        }
        validationSummary.textContent = "";
        validationSummary.classList.remove("validation-summary-errors");
    }
    appendMessage(role, content) {
        const { history } = this.elements;
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
    }
    async renderMarkdown(messageContent, markdown, signal) {
        const { form } = this.elements;
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
            this.highlightCodeBlocks(messageContent);
        }
        catch {
            // Keep the plain text when rendering fails or the request is stopped.
        }
    }
    updateConversationLocation(id) {
        const { conversationId } = this.elements;
        if (id === null) {
            return;
        }
        conversationId.value = id;
        const url = new URL(window.location.href);
        if (id.length === 0) {
            url.searchParams.delete("conversationId");
        }
        else {
            url.searchParams.set("conversationId", id);
        }
        window.history.replaceState({}, "", url);
    }
    beginRequest() {
        const { form, submitButton, stopButton, requestStatus, submitStatus, clearHistoryButton } = this.elements;
        this.clearError();
        const controller = new AbortController();
        this.activeRequest = controller;
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
        return controller;
    }
    prepareMessages() {
        const { form, responsePanel, prompt } = this.elements;
        responsePanel.hidden = false;
        const promptContent = prompt.value;
        const userMessageContent = this.appendMessage("user", promptContent);
        const responseContent = this.appendMessage("assistant", "");
        this.followLatestMessage();
        const requestBody = new FormData(form);
        prompt.value = "";
        void this.renderMarkdown(userMessageContent, promptContent);
        return { promptContent, responseContent, requestBody };
    }
    async sendRequest(requestBody, responseContent, controller) {
        const { form, stopButton } = this.elements;
        const response = await fetch(form.dataset.streamUrl ?? form.action, {
            method: "POST",
            body: requestBody,
            signal: controller.signal,
            headers: {
                Accept: "text/plain"
            }
        });
        this.updateConversationLocation(response.headers.get("X-Conversation-Id"));
        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Unable to complete the request.");
        }
        await readChatResponse(response, responseContent, () => this.markResponseStarted(), controller.signal);
        stopButton.hidden = true;
        this.activeRequest = undefined;
        await this.renderMarkdown(responseContent, responseContent.textContent ?? "", controller.signal);
    }
    handleRequestError(error, responseContent, promptContent, controller) {
        const { requestStatus, prompt } = this.elements;
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
        this.showError(error instanceof Error ? error.message : "Unable to complete the request.");
    }
    async clearHistory(event) {
        const { submitButton, conversationId, clearHistoryForm, clearHistoryButton } = this.elements;
        event.preventDefault();
        if (submitButton.disabled || !clearHistoryForm || !clearHistoryButton) {
            return;
        }
        submitButton.disabled = true;
        clearHistoryButton.disabled = true;
        clearHistoryForm.setAttribute("aria-busy", "true");
        this.clearError();
        try {
            const requestBody = new FormData(clearHistoryForm);
            requestBody.set("conversationId", conversationId.value);
            const response = await fetch(clearHistoryForm.action, { method: "POST", body: requestBody });
            if (!response.ok) {
                throw new Error("Unable to clear conversation history. Please try again.");
            }
            this.resetConversation();
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : "Unable to clear conversation history.");
        }
        finally {
            clearHistoryForm.removeAttribute("aria-busy");
            this.resetRequestState();
        }
    }
    resetConversation() {
        const { history, responsePanel, requestStatus, prompt } = this.elements;
        history.replaceChildren();
        responsePanel.hidden = true;
        this.updateConversationLocation("");
        requestStatus.textContent = "Conversation history cleared.";
        prompt.focus();
    }
    async submit(event) {
        const { form, submitButton, prompt } = this.elements;
        event.preventDefault();
        if (prompt.value.trim().length === 0) {
            return;
        }
        if (!form.checkValidity()) {
            return;
        }
        if (submitButton.disabled) {
            return;
        }
        const controller = this.beginRequest();
        const { promptContent, responseContent, requestBody } = this.prepareMessages();
        try {
            await this.sendRequest(requestBody, responseContent, controller);
        }
        catch (error) {
            this.handleRequestError(error, responseContent, promptContent, controller);
        }
        finally {
            this.resetRequestState();
        }
    }
}
async function readChatResponse(response, content, onContent, signal) {
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
    }
    finally {
        reader.releaseLock();
    }
}
