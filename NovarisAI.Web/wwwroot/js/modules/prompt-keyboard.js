const enterToSendStorageKey = "novaris-enter-to-send";
export function initializePromptKeyboard(form, prompt, submitButton) {
    const options = form.querySelector("[data-chat-prompt-options]");
    const preference = form.querySelector("[data-chat-enter-to-send]");
    const hint = form.querySelector("[data-chat-keyboard-hint]");
    if (!options || !preference || !hint) {
        return;
    }
    const updateHint = () => {
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
function shouldSendPrompt(event, enterToSend) {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) {
        return false;
    }
    if (event.shiftKey || event.altKey || event.metaKey) {
        return false;
    }
    return enterToSend || event.ctrlKey;
}
function readEnterToSend() {
    try {
        return window.localStorage.getItem(enterToSendStorageKey) !== "false";
    }
    catch {
        return true;
    }
}
function storeEnterToSend(enabled) {
    try {
        window.localStorage.setItem(enterToSendStorageKey, String(enabled));
    }
    catch {
        // The preference still applies to this page when browser storage is unavailable.
    }
}
