import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeChatRequestState } from "../wwwroot/js/modules/chat-request.js";

function setGlobal(t, name, value) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else delete globalThis[name];
    });
}

function element() {
    const selectors = new Map();
    const classes = new Set();
    const attributes = new Map();
    return {
        selectors, classes, attributes, events: {}, children: [], dataset: {},
        value: "", textContent: "", hidden: false, disabled: false,
        scrollTop: 0, scrollHeight: 0, clientHeight: 0,
        get childElementCount() { return this.children.length; },
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        querySelector(selector) { return this.selectors.get(selector) ?? null; },
        addEventListener(name, callback) { this.events[name] = callback; },
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        append(...children) {
            for (const child of children) child.parentElement = this;
            this.children.push(...children);
        },
        replaceChildren() { this.children = []; },
        remove() {
            const siblings = this.parentElement.children;
            siblings.splice(siblings.indexOf(this), 1);
        },
        focus() { this.focused = true; }
    };
}

function setup(t, { optionalControls = true, missingSelector } = {}) {
    const form = element();
    const submit = element();
    const stop = element();
    const status = element();
    const submitStatus = element();
    const panel = element();
    const history = element();
    const errors = element();
    const conversation = element();
    const prompt = element();
    const clearForm = element();
    const clearButton = element();
    const token = { name: "__RequestVerificationToken", value: "token" };
    form.action = "/chat";
    form.dataset.streamUrl = "/stream";
    form.checkValidity = () => true;
    clearForm.action = "/clear";
    prompt.value = "Explain this";
    submit.selectors.set(".chat__submit-status", submitStatus);
    panel.selectors.set("[data-chat-history]", history);
    clearForm.selectors.set("[data-chat-clear]", clearButton);
    form.selectors = new Map([
        ["[data-chat-submit]", submit], ["[data-chat-stop]", stop],
        ["[data-chat-request-status]", status], ["[data-chat-conversation-id]", conversation],
        ["[name=Prompt]", prompt], ["input[name=__RequestVerificationToken]", token]
    ]);
    if (optionalControls) form.selectors.set("[data-valmsg-summary]", errors);
    form.selectors.delete(missingSelector);
    const documentElements = new Map([
        ["[data-chat-request-form]", form], ["[data-chat-response]", panel]
    ]);
    if (optionalControls) documentElements.set("[data-chat-clear-form]", clearForm);
    const windowEvents = {};
    const locations = [];
    const highlighted = [];
    t.mock.method(globalThis, "fetch", async () => new Response("Hello", {
        headers: { "X-Conversation-Id": "conversation-1" }
    }));
    setGlobal(t, "window", {
        addEventListener: (name, callback) => windowEvents[name] = callback,
        getComputedStyle: () => ({ overflowY: "auto" }),
        requestAnimationFrame() {},
        location: { href: "https://example.com/chat?model=phi4" },
        history: { replaceState: (_, __, url) => locations.push(url) }
    });
    setGlobal(t, "document", {
        querySelector: selector => documentElements.get(selector) ?? null, createElement: element
    });
    setGlobal(t, "MutationObserver", class { observe() {} });
    // Node's FormData does not accept a browser form. Snapshot its submitted fields.
    setGlobal(t, "FormData", class extends Map {
        constructor(source) {
            super();
            if (source === form) {
                this.set("Prompt", prompt.value);
                this.set("conversationId", conversation.value);
            }
        }
        append(name, value) { this.set(name, value); }
    });
    initializeChatRequestState(content => highlighted.push(content));
    const dispatch = (target, name) => target.events[name]({ preventDefault() {} });
    return {
        form, submit, stop, status, submitStatus, panel, history, errors, conversation,
        prompt, clearForm, clearButton, locations, highlighted, windowEvents,
        send: () => dispatch(form, "submit"),
        clear: () => dispatch(clearForm, "submit"),
        stopRequest: () => dispatch(stop, "click"),
        assistant: () => history.children.at(-1).children[1]
    };
}

function assertIdle(ui) {
    assert.equal(ui.submit.disabled, false);
    assert.equal(ui.clearButton.disabled, false);
    assert.equal(ui.stop.hidden, true);
    assert.equal(ui.submitStatus.hidden, true);
    assert.equal(ui.form.attributes.has("aria-busy"), false);
    assert.equal(ui.submit.classes.has("chat__submit--loading"), false);
}

test("initialization skips pages without required controls", t => {
    const ui = setup(t, { missingSelector: "[data-chat-stop]" });
    assert.equal(ui.form.events.submit, undefined);
    assert.equal(ui.clearForm.events.submit, undefined);
});

test("blank and invalid prompts do not start a request", async t => {
    const ui = setup(t);
    ui.prompt.value = " \n ";
    await ui.send();
    ui.prompt.value = "A prompt";
    ui.form.checkValidity = () => false;
    await ui.send();
    assert.equal(fetch.mock.calls.length, 0);
    assert.equal(ui.history.children.length, 0);
});

test("submission streams content, preserves submitted prompt, and resets controls", async t => {
    const ui = setup(t);
    const pending = ui.send();
    assert.equal(ui.submit.disabled, true);
    assert.equal(ui.clearButton.disabled, true);
    assert.equal(ui.stop.hidden, false);
    assert.equal(ui.prompt.value, "");
    await ui.send();
    await ui.clear();
    assert.equal(fetch.mock.calls.length, 1);
    assert.equal(fetch.mock.calls[0].arguments[1].body.get("Prompt"), "Explain this");
    await pending;
    assert.equal(ui.assistant().textContent, "Hello");
    assert.equal(ui.conversation.value, "conversation-1");
    assert.equal(ui.locations.at(-1).searchParams.get("model"), "phi4");
    assertIdle(ui);
});

test("markdown requests include the verification token and highlight rendered messages", async t => {
    const ui = setup(t);
    ui.form.dataset.markdownUrl = "/markdown";
    t.mock.method(globalThis, "fetch", async url => url === "/markdown"
        ? new Response("<p>Rendered</p>")
        : new Response("Hello"));
    await ui.send();
    const requests = fetch.mock.calls.filter(call => call.arguments[0] === "/markdown");
    assert.deepEqual(requests.map(call => call.arguments[1].body.get("markdown")), ["Explain this", "Hello"]);
    assert.ok(requests.every(call => call.arguments[1].body.get("__RequestVerificationToken") === "token"));
    assert.equal(ui.highlighted.length, 2);
    assert.equal(ui.assistant().innerHTML, "<p>Rendered</p>");
    assertIdle(ui);
});

test("failed requests display the server error and remove the empty assistant message", async t => {
    const ui = setup(t);
    t.mock.method(globalThis, "fetch", async () => new Response("Model unavailable", { status: 503 }));
    await ui.send();
    assert.equal(ui.errors.textContent, "Model unavailable");
    assert.equal(ui.history.children.length, 1);
    assertIdle(ui);
});

test("stopping a stream keeps partial content and restores the prompt", async t => {
    const ui = setup(t);
    let contentReceived;
    const received = new Promise(resolve => contentReceived = resolve);
    let readCount = 0;
    let released = false;
    t.mock.method(globalThis, "fetch", async (_, { signal }) => ({
        ok: true, headers: new Headers(),
        body: { getReader: () => ({
            read() {
                if (readCount++ === 0) {
                    return Promise.resolve({ done: false, value: new TextEncoder().encode("Partial") });
                }
                contentReceived();
                return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
            },
            releaseLock() { released = true; }
        }) }
    }));
    const pending = ui.send();
    await received;
    assert.equal(ui.submitStatus.hidden, true);
    ui.stopRequest();
    await pending;
    assert.equal(ui.assistant().textContent, "Partial");
    assert.equal(ui.prompt.value, "Explain this");
    assert.equal(ui.prompt.focused, true);
    assert.equal(ui.status.textContent, "Request stopped.");
    assert.equal(released, true);
    assertIdle(ui);
});

test("clearing history sends the current conversation and resets the page", async t => {
    const ui = setup(t);
    await ui.send();
    await ui.clear();
    const clearRequest = fetch.mock.calls.at(-1).arguments;
    assert.equal(clearRequest[0], "/clear");
    assert.equal(clearRequest[1].body.get("conversationId"), "conversation-1");
    assert.equal(ui.history.children.length, 0);
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.conversation.value, "");
    assert.equal(ui.locations.at(-1).searchParams.has("conversationId"), false);
    assert.equal(ui.status.textContent, "Conversation history cleared.");
    assert.equal(ui.clearForm.attributes.has("aria-busy"), false);
    assertIdle(ui);
});

test("failed history clearing preserves messages and restores controls", async t => {
    const ui = setup(t);
    await ui.send();
    t.mock.method(globalThis, "fetch", async () => new Response("", { status: 500 }));
    await ui.clear();
    assert.equal(ui.history.children.length, 2);
    assert.equal(ui.conversation.value, "conversation-1");
    assert.match(ui.errors.textContent, /Unable to clear conversation history/);
    assertIdle(ui);
});

test("chat works without optional history controls and validation summary", async t => {
    const ui = setup(t, { optionalControls: false });
    await ui.send();
    assert.equal(ui.assistant().textContent, "Hello");
    ui.windowEvents.pageshow();
    assertIdle(ui);
});
