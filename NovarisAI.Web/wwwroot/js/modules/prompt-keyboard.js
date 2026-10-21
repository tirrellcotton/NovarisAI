const enterToSendStorageKey = "novaris-enter-to-send";
/** Initializes the saved keyboard preference and prompt submission shortcuts. */
export function initializePromptKeyboard(form, prompt, submitButton) {
    const options = form.querySelector("[data-chat-prompt-options]");
    const preference = form.querySelector("[data-chat-enter-to-send]");
    const hint = form.querySelector("[data-chat-keyboard-hint]");
    if (!options || !preference || !hint) {
        return;
    }
    preference.checked = readEnterToSend();
    updateKeyboardHint(hint, preference.checked);
    options.hidden = false;
    /** Saves the changed preference and refreshes its keyboard hint. */
    const handlePreferenceChange = () => {
        storeEnterToSend(preference.checked);
        updateKeyboardHint(hint, preference.checked);
    };
    /** Applies the current preference to a prompt key press. */
    const handleKeyDown = (event) => {
        submitPromptFromKeyboard(event, preference.checked, form, prompt, submitButton);
    };
    preference.addEventListener("change", handlePreferenceChange);
    prompt.addEventListener("keydown", handleKeyDown);
}
/** Displays the keyboard shortcuts for the selected Enter-to-send preference. */
function updateKeyboardHint(hint, enterToSend) {
    hint.textContent = enterToSend
        ? "Enter to send · Shift+Enter for a new line"
        : "Enter for a new line · Ctrl+Enter to send";
}
/** Submits an eligible prompt when a send shortcut is pressed. */
function submitPromptFromKeyboard(event, enterToSend, form, prompt, submitButton) {
    if (!shouldSendPrompt(event, enterToSend)) {
        return;
    }
    event.preventDefault();
    if (event.repeat || submitButton.disabled || prompt.value.trim().length === 0) {
        return;
    }
    form.requestSubmit(submitButton);
}
/** Identifies send shortcuts while allowing composition and modified newlines. */
function shouldSendPrompt(event, enterToSend) {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) {
        return false;
    }
    if (event.shiftKey || event.altKey || event.metaKey) {
        return false;
    }
    return enterToSend || event.ctrlKey;
}
/** Reads the saved preference, defaulting to Enter-to-send if storage is unavailable. */
function readEnterToSend() {
    try {
        return window.localStorage.getItem(enterToSendStorageKey) !== "false";
    }
    catch {
        return true;
    }
}
/** Persists the preference when browser storage is available. */
function storeEnterToSend(enabled) {
    try {
        window.localStorage.setItem(enterToSendStorageKey, String(enabled));
    }
    catch {
        // The preference still applies to this page when browser storage is unavailable.
    }
}
