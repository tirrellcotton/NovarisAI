const enterToSendStorageKey = "novaris-enter-to-send";

export function initializePromptKeyboard(
    form: HTMLFormElement,
    prompt: HTMLTextAreaElement,
    submitButton: HTMLButtonElement): void {
    const options = form.querySelector<HTMLElement>("[data-chat-prompt-options]");
    const preference = form.querySelector<HTMLInputElement>("[data-chat-enter-to-send]");
    const hint = form.querySelector<HTMLElement>("[data-chat-keyboard-hint]");
    if (!options || !preference || !hint) {
        return;
    }

    const updateHint = (): void => {
        hint.textContent = preference.checked
            ? "Enter to send · Shift+Enter for a new line"
            : "Enter for a new line · Ctrl+Enter to send";
    };

    preference.checked = readEnterToSend();
    updateHint();
    options.hidden = false;

    preference.addEventListener("change", () => {
        storeEnterToSend(preference.checked);
        updateHint();
    });

    prompt.addEventListener("keydown", (event) => {
        if (!shouldSendPrompt(event, preference.checked)) {
            return;
        }

        event.preventDefault();
        if (event.repeat || submitButton.disabled || prompt.value.trim().length === 0) {
            return;
        }

        form.requestSubmit(submitButton);
    });
}

function shouldSendPrompt(event: KeyboardEvent, enterToSend: boolean): boolean {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) {
        return false;
    }

    if (event.shiftKey || event.altKey || event.metaKey) {
        return false;
    }

    return enterToSend || event.ctrlKey;
}

function readEnterToSend(): boolean {
    try {
        return window.localStorage.getItem(enterToSendStorageKey) !== "false";
    } catch {
        return true;
    }
}

function storeEnterToSend(enabled: boolean): void {
    try {
        window.localStorage.setItem(enterToSendStorageKey, String(enabled));
    } catch {
        // The preference still applies to this page when browser storage is unavailable.
    }
}
