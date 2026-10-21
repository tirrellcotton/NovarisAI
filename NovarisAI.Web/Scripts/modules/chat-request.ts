import { initializePromptKeyboard } from "./prompt-keyboard.js";
import { initializeHistoryScroll } from "./history-scroll.js";

type HighlightCodeBlocks = (container: ParentNode) => void;
type ChatElements = NonNullable<ReturnType<typeof findChatElements>>;

interface ChatSubmission {
    promptContent: string;
    responseContent: HTMLElement;
    requestBody: FormData;
}

/** Initializes chat requests when the page contains all required chat elements. */
export function initializeChatRequestState(highlightCodeBlocks: HighlightCodeBlocks): void {
    const elements = findChatElements();
    if (!elements) {
        return;
    }

    new ChatRequestController(elements, highlightCodeBlocks).initialize();
}

/** Finds the chat form, history, and optional validation and clearing controls. */
function findChatElements() {
    const form = document.querySelector<HTMLFormElement>("[data-chat-request-form]");
    const responsePanel = document.querySelector<HTMLElement>("[data-chat-response]");
    if (!form || !responsePanel) {
        return null;
    }

    const controls = findChatFormControls(form);
    const history = responsePanel.querySelector<HTMLElement>("[data-chat-history]");
    if (!controls || !history) {
        return null;
    }

    const clearHistoryForm = document.querySelector<HTMLFormElement>("[data-chat-clear-form]");
    const clearHistoryButton = clearHistoryForm?.querySelector<HTMLButtonElement>("[data-chat-clear]");
    const validationSummary = form.querySelector<HTMLElement>("[data-valmsg-summary]");

    return {
        form, ...controls, responsePanel, history, validationSummary,
        clearHistoryForm, clearHistoryButton
    };
}

/** Finds the required inputs, buttons, and status indicators in the chat form. */
function findChatFormControls(form: HTMLFormElement) {
    const submitButton = form.querySelector<HTMLButtonElement>("[data-chat-submit]");
    const stopButton = form.querySelector<HTMLButtonElement>("[data-chat-stop]");
    const requestStatus = form.querySelector<HTMLElement>("[data-chat-request-status]");
    const submitStatus = submitButton?.querySelector<HTMLElement>(".chat__submit-status");
    const conversationId = form.querySelector<HTMLInputElement>("[data-chat-conversation-id]");
    const prompt = form.querySelector<HTMLTextAreaElement>("[name=Prompt]");

    if (!submitButton || !stopButton || !requestStatus || !submitStatus || !conversationId || !prompt) {
        return null;
    }

    return { submitButton, stopButton, requestStatus, submitStatus, conversationId, prompt };
}

class ChatRequestController {
    private activeRequest: AbortController | undefined;
    private readonly followLatestMessage: () => void;

    /** Creates a controller and initializes history scrolling for its chat elements. */
    constructor(
        private readonly elements: ChatElements,
        private readonly highlightCodeBlocks: HighlightCodeBlocks) {
        this.followLatestMessage = initializeHistoryScroll(elements.history);
    }

    /** Connects keyboard shortcuts and chat request lifecycle event handlers. */
    initialize(): void {
        const { form, prompt, submitButton, stopButton, clearHistoryForm } = this.elements;
        initializePromptKeyboard(form, prompt, submitButton);
        stopButton.addEventListener("click", /** Stops the active stream. */ () => this.stopRequest());
        clearHistoryForm?.addEventListener("submit", /** Clears the selected conversation. */ event => this.clearHistory(event));
        form.addEventListener("submit", /** Submits the prompt. */ event => this.submit(event));
        window.addEventListener("pageshow", /** Restores controls after page navigation. */ () => this.resetRequestState());
    }

    /** Aborts the active request and disables repeated stop actions. */
    private stopRequest(): void {
        this.activeRequest?.abort();
        this.elements.stopButton.disabled = true;
    }

    /** Restores idle form controls and clears the active request reference. */
    private resetRequestState(): void {
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

    /** Hides the waiting indicator once response content arrives. */
    private markResponseStarted(): void {
        const { submitButton, submitStatus } = this.elements;
        submitButton.classList.remove("chat__submit--loading");
        submitStatus.hidden = true;
    }

    /** Displays a request error in the optional validation summary. */
    private showError(message: string): void {
        const { validationSummary } = this.elements;
        if (!validationSummary) {
            return;
        }

        validationSummary.textContent = message;
        validationSummary.classList.add("validation-summary-errors");
    }

    /** Clears the optional validation summary before a new operation. */
    private clearError(): void {
        const { validationSummary } = this.elements;
        if (!validationSummary) {
            return;
        }

        validationSummary.textContent = "";
        validationSummary.classList.remove("validation-summary-errors");
    }

    /** Appends a plain-text chat message and returns its content element. */
    private appendMessage(role: "user" | "assistant", content: string): HTMLElement {
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

    /** Requests rendered Markdown while preserving plain text if rendering fails. */
    private async renderMarkdown(
        messageContent: HTMLElement,
        markdown: string,
        signal?: AbortSignal): Promise<void> {
        const markdownUrl = this.elements.form.dataset.markdownUrl;

        if (markdownUrl === undefined) {
            return;
        }

        try {
            const response = await fetch(markdownUrl, {
                method: "POST",
                body: this.createMarkdownRequestBody(markdown),
                signal,
                headers: {
                    Accept: "text/html"
                }
            });

            if (!response.ok) {
                return;
            }

            this.applyRenderedMarkdown(messageContent, await response.text());
        } catch {
            // Keep the plain text when rendering fails or the request is stopped.
        }
    }

    /** Builds a Markdown rendering request with the form's verification token. */
    private createMarkdownRequestBody(markdown: string): FormData {
        const requestBody = new FormData();
        const antiForgeryToken = this.elements.form.querySelector<HTMLInputElement>(
            "input[name=__RequestVerificationToken]");
        requestBody.append("markdown", markdown);
        if (antiForgeryToken !== null) {
            requestBody.append(antiForgeryToken.name, antiForgeryToken.value);
        }
        return requestBody;
    }

    /** Displays server-rendered HTML and highlights its code blocks. */
    private applyRenderedMarkdown(messageContent: HTMLElement, html: string): void {
        messageContent.innerHTML = html;
        messageContent.classList.add("markdown-content--rendered");
        this.highlightCodeBlocks(messageContent);
    }

    /** Synchronizes the conversation field and URL when the server supplies an ID. */
    private updateConversationLocation(id: string | null): void {
        const { conversationId } = this.elements;
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
    }

    /** Starts request tracking and switches the form to its pending state. */
    private beginRequest(): AbortController {
        this.clearError();
        const controller = new AbortController();
        this.activeRequest = controller;
        this.showRequestPending();
        return controller;
    }

    /** Marks the form busy and displays the waiting controls. */
    private showRequestPending(): void {
        const { form, submitButton, stopButton, requestStatus, submitStatus, clearHistoryButton } = this.elements;
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
    }

    /** Captures the submitted form and adds user and assistant messages to history. */
    private prepareMessages(): ChatSubmission {
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

    /** Coordinates fetching, streaming, and final rendering of a chat response. */
    private async sendRequest(
        requestBody: FormData,
        responseContent: HTMLElement,
        controller: AbortController): Promise<void> {
        const response = await this.fetchChatResponse(requestBody, controller.signal);
        await readChatResponse(response, responseContent, /** Hides the waiting indicator. */ () => this.markResponseStarted(), controller.signal);
        await this.finishResponse(responseContent, controller.signal);
    }

    /** Posts the chat form and validates the server's response. */
    private async fetchChatResponse(requestBody: FormData, signal: AbortSignal): Promise<Response> {
        const { form } = this.elements;
        const response = await fetch(form.dataset.streamUrl ?? form.action, {
            method: "POST",
            body: requestBody,
            signal,
            headers: {
                Accept: "text/plain"
            }
        });

        this.updateConversationLocation(response.headers.get("X-Conversation-Id"));

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Unable to complete the request.");
        }

        return response;
    }

    /** Ends streaming controls and renders the completed assistant message. */
    private async finishResponse(responseContent: HTMLElement, signal: AbortSignal): Promise<void> {
        this.elements.stopButton.hidden = true;
        this.activeRequest = undefined;
        await this.renderMarkdown(responseContent, responseContent.textContent ?? "", signal);
    }

    /** Removes empty responses and handles cancellation or displays the request error. */
    private handleRequestError(
        error: unknown,
        responseContent: HTMLElement,
        promptContent: string,
        controller: AbortController): void {
        if (responseContent.textContent?.trim().length === 0) {
            responseContent.parentElement?.remove();
        }

        if (controller.signal.aborted) {
            this.restoreStoppedPrompt(promptContent);
            return;
        }

        this.showError(error instanceof Error ? error.message : "Unable to complete the request.");
    }

    /** Announces cancellation and restores the submitted prompt if the input is empty. */
    private restoreStoppedPrompt(promptContent: string): void {
        const { requestStatus, prompt } = this.elements;
        requestStatus.textContent = "Request stopped.";
        if (prompt.value.length === 0) {
            prompt.value = promptContent;
        }
        prompt.focus();
    }

    /** Coordinates history deletion with busy controls, error reporting, and cleanup. */
    private async clearHistory(event: SubmitEvent): Promise<void> {
        const { submitButton, clearHistoryForm, clearHistoryButton } = this.elements;
        event.preventDefault();
        if (submitButton.disabled || !clearHistoryForm || !clearHistoryButton) {
            return;
        }

        submitButton.disabled = true;
        clearHistoryButton.disabled = true;
        clearHistoryForm.setAttribute("aria-busy", "true");
        this.clearError();

        try {
            await this.deleteConversationHistory(clearHistoryForm);
            this.resetConversation();
        } catch (error) {
            this.showError(error instanceof Error ? error.message : "Unable to clear conversation history.");
        } finally {
            clearHistoryForm.removeAttribute("aria-busy");
            this.resetRequestState();
        }
    }

    /** Requests deletion of the current conversation's saved history. */
    private async deleteConversationHistory(form: HTMLFormElement): Promise<void> {
        const requestBody = new FormData(form);
        requestBody.set("conversationId", this.elements.conversationId.value);
        const response = await fetch(form.action, { method: "POST", body: requestBody });
        if (!response.ok) {
            throw new Error("Unable to clear conversation history. Please try again.");
        }
    }

    /** Clears displayed messages and resets the conversation selection and status. */
    private resetConversation(): void {
        const { history, responsePanel, requestStatus, prompt } = this.elements;
        history.replaceChildren();
        responsePanel.hidden = true;
        this.updateConversationLocation("");
        requestStatus.textContent = "Conversation history cleared.";
        prompt.focus();
    }

    /** Intercepts form submission and starts a request when the form is ready. */
    private async submit(event: SubmitEvent): Promise<void> {
        event.preventDefault();
        if (!this.canSubmit()) {
            return;
        }
        await this.executeSubmission();
    }

    /** Checks that the prompt is nonblank, valid, and ready for submission. */
    private canSubmit(): boolean {
        const { form, submitButton, prompt } = this.elements;
        return prompt.value.trim().length > 0 && form.checkValidity() && !submitButton.disabled;
    }

    /** Runs a prepared chat submission and restores controls after success or failure. */
    private async executeSubmission(): Promise<void> {
        const controller = this.beginRequest();
        const { promptContent, responseContent, requestBody } = this.prepareMessages();

        try {
            await this.sendRequest(requestBody, responseContent, controller);
        } catch (error) {
            this.handleRequestError(error, responseContent, promptContent, controller);
        } finally {
            this.resetRequestState();
        }
    }
}

/** Decodes streamed response chunks, reports arriving content, and releases the reader. */
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
