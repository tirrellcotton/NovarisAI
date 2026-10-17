import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeHistoryScroll } from "../wwwroot/js/modules/history-scroll.js";

function container() {
    let top = 0;
    return {
        scrollHeight: 1000, clientHeight: 300,
        get scrollTop() { return top; },
        set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); }
    };
}

function setup({ mobile = false, empty = false } = {}) {
    const historyEvents = {};
    const windowEvents = {};
    const frames = [];
    const history = Object.assign(container(), {
        childElementCount: empty ? 0 : 2,
        addEventListener: (event, callback) => historyEvents[event] = callback
    });
    const page = container();
    let mutated;
    globalThis.window = {
        addEventListener: (event, callback) => windowEvents[event] = callback,
        getComputedStyle: () => ({ overflowY: mobile ? "visible" : "auto" }),
        requestAnimationFrame: callback => frames.push(callback)
    };
    globalThis.document = { scrollingElement: page, documentElement: page };
    globalThis.MutationObserver = class {
        constructor(callback) { mutated = callback; }
        observe(element, options) {
            assert.equal(element, history);
            assert.deepEqual(options, { childList: true, characterData: true, subtree: true });
        }
    };
    const followLatest = initializeHistoryScroll(history);
    return {
        history, page, frames, historyEvents, windowEvents, followLatest,
        mutate: () => mutated(),
        flush() { while (frames.length > 0) frames.shift()(); },
        scroll(top) {
            (mobile ? page : history).scrollTop = top;
            (mobile ? windowEvents : historyEvents).scroll();
        }
    };
}

test("existing history opens at the latest message and new content stays in view", () => {
    const ui = setup();
    ui.flush();
    assert.equal(ui.history.scrollTop, 700);
    ui.history.scrollHeight = 1200;
    ui.mutate();
    ui.mutate();
    assert.equal(ui.frames.length, 1, "stream updates share one animation frame");
    ui.flush();
    assert.equal(ui.history.scrollTop, 900);
});

test("scrolling up pauses following, including a queued scroll", () => {
    const ui = setup();
    ui.flush();
    ui.history.scrollHeight = 1200;
    ui.mutate();
    ui.scroll(200);
    ui.flush();
    assert.equal(ui.history.scrollTop, 200);
    ui.mutate();
    assert.equal(ui.frames.length, 0);
});

test("scrolling back near the bottom resumes following", () => {
    const ui = setup();
    ui.flush();
    ui.scroll(100);
    ui.scroll(680);
    ui.history.scrollHeight = 1400;
    ui.mutate();
    ui.flush();
    assert.equal(ui.history.scrollTop, 1100);
});

test("submitting a new prompt follows the latest message after reading older messages", () => {
    const ui = setup();
    ui.flush();
    ui.scroll(100);
    ui.history.scrollHeight = 1600;
    ui.followLatest();
    ui.flush();
    assert.equal(ui.history.scrollTop, 1300);
});

test("mobile follows the page and respects scrolling up", () => {
    const ui = setup({ mobile: true });
    ui.flush();
    assert.equal(ui.page.scrollTop, 700);
    assert.equal(ui.history.scrollTop, 0);
    ui.scroll(100);
    ui.page.scrollHeight = 1600;
    ui.mutate();
    ui.flush();
    assert.equal(ui.page.scrollTop, 100);
});

test("image loads and viewport resizing follow layout changes", () => {
    const ui = setup();
    ui.flush();
    ui.history.scrollHeight = 1500;
    ui.historyEvents.load();
    ui.flush();
    assert.equal(ui.history.scrollTop, 1200);
    ui.history.clientHeight = 200;
    ui.windowEvents.resize();
    ui.flush();
    assert.equal(ui.history.scrollTop, 1300);
});

test("empty or cleared history does not move the page", () => {
    const ui = setup({ empty: true, mobile: true });
    ui.mutate();
    ui.flush();
    assert.equal(ui.page.scrollTop, 0);
    ui.history.childElementCount = 2;
    ui.followLatest();
    ui.flush();
    assert.equal(ui.page.scrollTop, 700);
});

test("a delayed programmatic scroll event does not pause a growing stream", () => {
    const ui = setup();
    ui.flush();
    ui.history.scrollHeight = 1400;
    ui.historyEvents.scroll();
    ui.mutate();
    ui.flush();
    assert.equal(ui.history.scrollTop, 1100);
});
