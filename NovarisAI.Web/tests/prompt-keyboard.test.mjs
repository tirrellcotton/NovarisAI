import assert from "node:assert/strict";
import { test } from "node:test";
import { initializePromptKeyboard } from "../wwwroot/js/modules/prompt-keyboard.js";

function setup(savedPreference, storageUnavailable = false) {
    const values = new Map();
    if (savedPreference !== undefined) {
        values.set("novaris-enter-to-send", savedPreference);
    }

    globalThis.window = {
        localStorage: {
            getItem: key => {
                if (storageUnavailable) throw new Error("Storage unavailable");
                return values.get(key) ?? null;
            },
            setItem: (key, value) => {
                if (storageUnavailable) throw new Error("Storage unavailable");
                values.set(key, value);
            }
        }
    };

    const options = { hidden: true };
    const hint = { textContent: "" };
    let change;
    const preference = { checked: false, addEventListener: (_, callback) => change = callback };
    const submit = { disabled: false };
    let keydown;
    const prompt = { value: "A prompt", addEventListener: (_, callback) => keydown = callback };
    const submissions = [];
    const elements = {
        "[data-chat-prompt-options]": options,
        "[data-chat-enter-to-send]": preference,
        "[data-chat-keyboard-hint]": hint
    };
    const form = {
        querySelector: selector => elements[selector],
        requestSubmit: button => submissions.push(button)
    };
    initializePromptKeyboard(form, prompt, submit);

    return {
        options, hint, preference, prompt, submit, submissions, values,
        setPreference(enabled) { preference.checked = enabled; change(); },
        press(overrides = {}) {
            const event = {
                key: "Enter", isComposing: false, keyCode: 13, shiftKey: false,
                ctrlKey: false, altKey: false, metaKey: false, repeat: false,
                prevented: false, preventDefault() { this.prevented = true; }, ...overrides
            };
            keydown(event);
            return event;
        }
    };
}

test("Enter sends through the existing form submission by default", () => {
    const ui = setup();
    assert.equal(ui.options.hidden, false);
    assert.equal(ui.preference.checked, true);
    assert.match(ui.hint.textContent, /Shift\+Enter/);
    assert.equal(ui.press().prevented, true);
    assert.deepEqual(ui.submissions, [ui.submit]);
});

test("Shift+Enter and ordinary typing retain native textarea behavior", () => {
    const ui = setup();
    for (const overrides of [{ shiftKey: true }, { key: "a" }, { altKey: true }, { metaKey: true }]) {
        assert.equal(ui.press(overrides).prevented, false);
    }
    assert.equal(ui.submissions.length, 0);
});

test("disabled Enter-to-send uses Ctrl+Enter and persists across initialization", () => {
    const ui = setup();
    ui.setPreference(false);
    assert.equal(ui.values.get("novaris-enter-to-send"), "false");
    assert.match(ui.hint.textContent, /Ctrl\+Enter to send/);
    assert.equal(ui.press().prevented, false);
    assert.equal(ui.press({ ctrlKey: true, shiftKey: true }).prevented, false);
    assert.equal(ui.press({ ctrlKey: true }).prevented, true);
    assert.equal(ui.submissions.length, 1);
    const restored = setup(ui.values.get("novaris-enter-to-send"));
    assert.equal(restored.preference.checked, false);
    restored.setPreference(true);
    assert.equal(restored.values.get("novaris-enter-to-send"), "true");
    assert.match(restored.hint.textContent, /^Enter to send/);
});

test("Enter never sends while composing text, including the IME compatibility key", () => {
    const ui = setup();
    for (const overrides of [{ isComposing: true }, { isComposing: true, ctrlKey: true }, { keyCode: 229 }]) {
        assert.equal(ui.press(overrides).prevented, false);
    }
    assert.equal(ui.submissions.length, 0);
});

test("blank prompts, held Enter, and busy forms cannot submit", () => {
    const ui = setup();
    for (const value of ["", "  ", "\t\n"]) {
        ui.prompt.value = value;
        assert.equal(ui.press().prevented, true);
    }
    ui.prompt.value = "A prompt";
    ui.press({ repeat: true });
    ui.submit.disabled = true;
    ui.press();
    ui.press({ ctrlKey: true });
    assert.equal(ui.submissions.length, 0);
});

test("browser storage failures preserve working controls and the page preference", () => {
    const ui = setup(undefined, true);
    assert.equal(ui.preference.checked, true);
    ui.setPreference(false);
    assert.equal(ui.press().prevented, false);
    ui.press({ ctrlKey: true });
    assert.equal(ui.submissions.length, 1);
});
