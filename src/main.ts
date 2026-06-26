import { Plugin } from "obsidian";
import {
  justifyParagraph,
  isJustified,
  revertToParagraph,
  clearPrepareCache,
  clearFontMetricsCache,
  setPrepareCacheMaxSize,
  type JustifySettings,
} from "./renderer";
import { clearCache as clearPretextCache } from "@chenglou/pretext";
import { PretextJustifySettingTab, DEFAULT_SETTINGS } from "./settings";

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class PretextJustifyPlugin extends Plugin {
  settings: JustifySettings = { ...DEFAULT_SETTINGS };

  /** Track justified elements for resize re-justification. */
  private _justified = new Map<
    HTMLElement,
    {
      originalFont: string;
      contentWidth: number;
      originalChildren: Node[];
      justifiedAt: number;
    }
  >();

  /** Paragraphs awaiting async justification (rAF-paced, 2 per frame). */
  private _pending = new Set<HTMLElement>();
  private _processingRAF: number | null = null;
  private _scrollRAF: number | null = null;

  private _resizeObserver: ResizeObserver | null = null;

  /** After a file switch, delay processing by this long (ms) so the raw DOM
   *  can settle and we avoid visible raw→justified jumping. */
  private _fileSwitchDebounce: number | null = null;

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async onload(): Promise<void> {
    await this.loadSettings();

    // Apply cache limit from settings
    setPrepareCacheMaxSize(this.settings.maxCacheEntries);

    this.addSettingTab(new PretextJustifySettingTab(this.app, this));

    // Markdown post-processor — runs on every rendered section
    this.registerMarkdownPostProcessor((el) => {
      this._processSection(el);
    });

    // File-switch debounce: let the new note's DOM settle before justifying
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        // Discard stale pending paragraphs from the previous file
        this._pending.clear();

        if (this._fileSwitchDebounce !== null) {
          window.clearTimeout(this._fileSwitchDebounce);
        }
        this._fileSwitchDebounce = window.setTimeout(() => {
          this._fileSwitchDebounce = null;
          this._observePreviewViews();
          this._scanForMissedParagraphs();
          this._scheduleProcessing();
        }, 150);
      }),
    );

    // Resize handling
    this._resizeObserver = new ResizeObserver(() => {
      this._rejustifyAll();
    });

    this.app.workspace.onLayoutReady(() => {
      this._observePreviewViews();

      // Scroll catch-up: rAF-throttled for near-zero latency.
      this.registerDomEvent(
        this.app.workspace.containerEl,
        "scroll",
        this._onScroll,
        { capture: true },
      );
    });
  }

  onunload(): void {
    if (this._processingRAF !== null) {
      window.cancelAnimationFrame(this._processingRAF);
      this._processingRAF = null;
    }
    if (this._scrollRAF !== null) {
      window.cancelAnimationFrame(this._scrollRAF);
      this._scrollRAF = null;
    }
    if (this._fileSwitchDebounce !== null) {
      window.clearTimeout(this._fileSwitchDebounce);
      this._fileSwitchDebounce = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._pending.clear();
    this._revertAll();
    this._justified.clear();
    clearPrepareCache();
    clearFontMetricsCache();
    clearPretextCache();
  }

  // ------------------------------------------------------------------
  // Settings persistence
  // ------------------------------------------------------------------

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<JustifySettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    setPrepareCacheMaxSize(this.settings.maxCacheEntries);
  }

  // ------------------------------------------------------------------
  // Refresh
  // ------------------------------------------------------------------

  /** Re-justify every tracked element (used after settings change). */
  refresh(): void {
    const entries = Array.from(this._justified.entries());

    if (entries.length > 0) {
      this._justified.clear();
      for (const [el, info] of entries) {
        if (!el.isConnected) continue;

        const doc = el.ownerDocument;
        const parent = el.parentElement;
        if (!doc || !parent) continue;

        const freshP = doc.createElement("p");
        freshP.replaceChildren(
    ...info.originalChildren.map((n) => n.cloneNode(true)),
  );
        parent.replaceChild(freshP, el);

        this._pending.add(freshP);
      }
      this._scheduleProcessing();
    } else {
      this._scanForMissedParagraphs();
    }
  }

  // ------------------------------------------------------------------
  // Scroll handler (rAF-throttled)
  // ------------------------------------------------------------------

  private _onScroll = (): void => {
    if (this._scrollRAF !== null) return;

    this._scrollRAF = window.requestAnimationFrame(() => {
      this._scrollRAF = null;
      this._scanForMissedParagraphs();
      this._scheduleProcessing();
    });
  };

  // ------------------------------------------------------------------
  // Async paragraph processing (rAF-paced, 2 per frame)
  // ------------------------------------------------------------------

  private _scheduleProcessing(): void {
    if (this._fileSwitchDebounce !== null) return; // wait for file-settle window
    if (this._processingRAF !== null) return;
    if (this._pending.size === 0) return;

    this._processingRAF = window.requestAnimationFrame(() => {
      this._processingRAF = null;
      this._processBatch();
    });
  }

  /** Process up to 2 paragraphs per rAF to keep the main thread responsive.
   *  Font resolution is deferred to here so paragraphs queued before the
   *  font/layout is ready will still be processed once it stabilises. */
  private _processBatch(): void {
    let count = 0;
    const BATCH = 2;
    const now = Date.now();
    const retryLater: HTMLElement[] = [];

    for (const p of this._pending) {
      if (count >= BATCH) break;
      this._pending.delete(p);

      if (!p.isConnected) continue;

      const font = getFontString(p);
      if (!font) {
        // Font / layout not ready yet — retry next frame
        retryLater.push(p);
        continue;
      }

      this._justifyOneParagraph(p, font, now);
      count++;
    }

    // Re-queue paragraphs that were unprocessable this frame
    for (const p of retryLater) this._pending.add(p);

    if (this._pending.size > 0) {
      this._scheduleProcessing();
    }
  }

  // ------------------------------------------------------------------
  // Post-processing
  // ------------------------------------------------------------------

  private _processSection(el: HTMLElement): void {
    const paragraphs: HTMLElement[] = [];

    if (el.tagName === "P" && !el.closest(".pretext-container") && !el.closest(".callout")) {
      paragraphs.push(el);
    }
    el.querySelectorAll("p").forEach((p) => {
      if (p.closest(".pretext-container")) return;
      if (p.closest(".callout")) return;
      paragraphs.push(p);
    });

    if (paragraphs.length === 0) return;

    for (const p of paragraphs) {
      if (this._justified.has(p)) continue;
      if (this._pending.has(p)) continue;

      // Visibility check only — font resolution is deferred to _processBatch
      if (!isElementVisible(p)) continue;

      this._pending.add(p);
    }

    this._scheduleProcessing();
  }

  /** Justify a single paragraph and track it. */
  private _justifyOneParagraph(
    p: HTMLElement,
    font: string,
    now: number,
  ): void {
    const origChildren = Array.from(p.childNodes);
    const container = this._justifyInternal(p, font);
    if (container) {
      this._justified.set(container, {
        originalFont: font,
        contentWidth: container.getBoundingClientRect().width,
        originalChildren: origChildren,
        justifiedAt: now,
      });
    }
  }

  /**
   * Internal: justify a paragraph element and return the new container,
   * or null if justification was skipped.
   */
  private _justifyInternal(p: HTMLElement, font: string): HTMLElement | null {
    const w = p.getBoundingClientRect().width;
    if (w < this.settings.minWidth) return null;

    try {
      return justifyParagraph(p, this.settings, font);
    } catch (e) {
      console.error("Pretext Justify: error justifying paragraph", e);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Re-justify on resize
  // ------------------------------------------------------------------

  private _rejustifyAll(): void {
    if (this._justified.size === 0) return;

    const now = Date.now();
    const entries = Array.from(this._justified.entries());
    this._justified.clear();

    for (const [el, info] of entries) {
      if (!el.isConnected) continue;

      const currentWidth = el.getBoundingClientRect().width;
      if (Math.abs(currentWidth - info.contentWidth) < 2) {
        // Width hasn't changed meaningfully — keep the entry but update
        // contentWidth to avoid drift from sub-threshold accumulation
        // (e.g. slow panel drag that never moves >2 px in one step).
        this._justified.set(el, { ...info, contentWidth: currentWidth });
        continue;
      }

      const doc = el.ownerDocument;
      const parent = el.parentElement;
      if (!doc || !parent) continue;

      const freshP = doc.createElement("p");
      freshP.replaceChildren(
    ...info.originalChildren.map((n) => n.cloneNode(true)),
  );
      parent.replaceChild(freshP, el);

      // Justify visible paragraphs immediately so viewport content
      // updates in real-time during resize.  Off-screen paragraphs
      // queue for the 2/frame rAF pipeline — reverted paragraphs from
      // multiple _rejustifyAll cycles accumulate at the tail of
      // _pending; deferring prevents under-viewport paragraphs from
      // being pushed behind.
      if (isElementVisible(freshP)) {
        const font = getFontString(freshP);
        if (font) {
          this._justifyOneParagraph(freshP, font, now);
        } else {
          this._pending.add(freshP);
        }
      } else {
        this._pending.add(freshP);
      }
    }

    this._scheduleProcessing();
    this._scanForMissedParagraphs();
  }

  private _scanForMissedParagraphs(): void {
    // Prune stale entries (elements recycled by Obsidian's virtual scrolling)
    for (const [el] of this._justified) {
      if (!el.isConnected) this._justified.delete(el);
    }

    // Catch orphaned containers: elements that were temporarily detached by
    // Obsidian's virtual scrolling and have since been reattached, but are no
    // longer tracked in _justified (e.g. because a _rejustifyAll pass skipped
    // them while they were disconnected).  Revert them to <p> and re-justify.
    this._reclaimOrphanedContainers();

    this._observePreviewViews();

    const previewViews = Array.from(
      this.app.workspace.containerEl.querySelectorAll<HTMLElement>(
        ".markdown-preview-view",
      ),
    );
    for (const view of previewViews) {
      this._processSection(view);
    }
  }

  /**
   * Find .pretext-container elements that exist in the DOM but are not tracked
   * in _justified.  These are orphaned by Obsidian's DOM recycling: the element
   * was detached, reattached later, but _justified no longer knows about it.
   *
   * We revert them to <p> and add to _pending so they get re-justified at the
   * current container width.
   */
  private _reclaimOrphanedContainers(): void {
    const containers = Array.from(
      this.app.workspace.containerEl.querySelectorAll<HTMLElement>(
        ".pretext-container",
      ),
    );
    for (const container of containers) {
      if (this._justified.has(container)) continue;
      if (!container.isConnected) continue;

      const doc = container.ownerDocument;
      const parent = container.parentElement;
      if (!doc || !parent) continue;

      // Move content from .pretext-line children into a new <p>,
      // preserving inline formatting (bold, italic, etc.).
      const freshP = doc.createElement("p");
      const lines = container.querySelectorAll<HTMLElement>(".pretext-line");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        while (line.firstChild) {
          freshP.appendChild(line.firstChild);
        }
      }

      parent.replaceChild(freshP, container);
      this._pending.add(freshP);
    }
  }

  /** Ensure ResizeObserver tracks all preview-view elements for width changes. */
  private _observePreviewViews(): void {
    const views = Array.from(
      this.app.workspace.containerEl.querySelectorAll<HTMLElement>(
        ".markdown-preview-view",
      ),
    );
    for (const view of views) {
      this._resizeObserver?.observe(view);
    }
  }

  // ------------------------------------------------------------------
  // Revert all
  // ------------------------------------------------------------------

  private _revertAll(): void {
    for (const [el] of this._justified) {
      if (!el.isConnected) continue;
      if (isJustified(el)) {
        revertToParagraph(el);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a CSS font string suitable for Canvas `measureText` from an element.
 */
function getFontString(el: HTMLElement): string | null {
  const doc = el.ownerDocument;
  if (!doc) return null;
  const style = doc.defaultView?.getComputedStyle(el);
  if (!style) return null;

  // Walk up the DOM tree if the computed font is empty (can happen on initial render)
  if (!style.font) {
    let parent = el.parentElement;
    while (parent) {
      const ps = doc.defaultView?.getComputedStyle(parent);
      if (ps?.font) return ps.font;
      parent = parent.parentElement;
    }
  }
  return style.font;
}

/**
 * Quick visibility check: true if any part of the element's bounding box
 * intersects the viewport.
 */
function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom >= 0 && rect.top <= activeWindow.innerHeight;
}
