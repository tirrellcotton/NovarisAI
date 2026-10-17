const bottomThreshold = 48;

export function initializeHistoryScroll(history: HTMLElement): () => void {
    let followingLatest = true;
    let framePending = false;
    let previousScrollTop = getScrollContainer(history).scrollTop;

    const scheduleScroll = (): void => {
        if (!followingLatest || framePending || history.childElementCount === 0) {
            return;
        }

        framePending = true;
        window.requestAnimationFrame(() => {
            framePending = false;
            if (followingLatest) {
                const container = getScrollContainer(history);
                container.scrollTop = container.scrollHeight;
                previousScrollTop = container.scrollTop;
            }
        });
    };

    const updateFollowing = (): void => {
        const container = getScrollContainer(history);
        const nearBottom = container.scrollHeight - container.clientHeight - container.scrollTop <= bottomThreshold;
        // Content can grow before a programmatic scroll event arrives. Pause only when scrolling upward.
        if (nearBottom || container.scrollTop < previousScrollTop) {
            followingLatest = nearBottom;
        }
        previousScrollTop = container.scrollTop;
    };

    history.addEventListener("scroll", updateFollowing, { passive: true });
    window.addEventListener("scroll", updateFollowing, { passive: true });
    window.addEventListener("resize", scheduleScroll);
    history.addEventListener("load", scheduleScroll, true);

    const observer = new MutationObserver(scheduleScroll);
    observer.observe(history, { childList: true, characterData: true, subtree: true });
    scheduleScroll();

    return () => {
        followingLatest = true;
        scheduleScroll();
    };
}

function getScrollContainer(history: HTMLElement): Element {
    if (window.getComputedStyle(history).overflowY === "visible") {
        return document.scrollingElement ?? document.documentElement;
    }

    return history;
}
