const bottomThreshold = 48;

/** Initializes automatic history scrolling and returns a callback to resume following. */
export function initializeHistoryScroll(history: HTMLElement): () => void {
    const controller = new HistoryScrollController(history);
    controller.initialize();
    return controller.followLatest;
}

class HistoryScrollController {
    private followingLatest = true;
    private framePending = false;
    private previousScrollTop: number;

    /** Captures the initial scroll position for tracking user scroll direction. */
    constructor(private readonly history: HTMLElement) {
        this.previousScrollTop = getScrollContainer(history).scrollTop;
    }

    /** Connects scroll and layout observers and schedules the initial scroll. */
    initialize(): void {
        this.observeScrollEvents();
        this.observeLayoutChanges();
        this.scheduleScroll();
    }

    /** Resumes following the latest message and schedules a scroll. */
    readonly followLatest = (): void => {
        this.followingLatest = true;
        this.scheduleScroll();
    };

    /** Queues one animation frame when nonempty history is being followed. */
    private readonly scheduleScroll = (): void => {
        if (!this.followingLatest || this.framePending || this.history.childElementCount === 0) {
            return;
        }

        this.framePending = true;
        window.requestAnimationFrame(this.scrollToLatest);
    };

    /** Scrolls to the newest content if following remains enabled when the frame runs. */
    private readonly scrollToLatest = (): void => {
        this.framePending = false;
        if (!this.followingLatest) {
            return;
        }

        const container = getScrollContainer(this.history);
        container.scrollTop = container.scrollHeight;
        this.previousScrollTop = container.scrollTop;
    };

    /** Pauses on upward scrolling and resumes when the user returns near the bottom. */
    private readonly updateFollowing = (): void => {
        const container = getScrollContainer(this.history);
        const nearBottom = isNearBottom(container);
        // Content can grow before a programmatic scroll event arrives. Pause only when scrolling upward.
        if (nearBottom || container.scrollTop < this.previousScrollTop) {
            this.followingLatest = nearBottom;
        }
        this.previousScrollTop = container.scrollTop;
    };

    /** Tracks user scrolling in both the history panel and the page. */
    private observeScrollEvents(): void {
        this.history.addEventListener("scroll", this.updateFollowing, { passive: true });
        window.addEventListener("scroll", this.updateFollowing, { passive: true });
    }

    /** Watches content growth, image loads, and resizing for changes to scroll position. */
    private observeLayoutChanges(): void {
        window.addEventListener("resize", this.scheduleScroll);
        this.history.addEventListener("load", this.scheduleScroll, true);
        const observer = new MutationObserver(this.scheduleScroll);
        observer.observe(this.history, { childList: true, characterData: true, subtree: true });
    }
}

/** Checks whether the scroll container is within the bottom-following threshold. */
function isNearBottom(container: Element): boolean {
    return container.scrollHeight - container.clientHeight - container.scrollTop <= bottomThreshold;
}

/** Selects the page on mobile layouts or the independently scrolling history panel. */
function getScrollContainer(history: HTMLElement): Element {
    if (window.getComputedStyle(history).overflowY === "visible") {
        return document.scrollingElement ?? document.documentElement;
    }

    return history;
}
