/**
 * DOM renderer for Knuth-Plass justified text.
 *
 * Takes a reading-view paragraph, measures its text via Pretext,
 * computes optimal breaks via the Knuth-Plass DP, and replaces
 * the paragraph with justified line elements.
 *
 * Handles inline formatting (bold, italic, links, etc.) by using
 * DOM Range-based extraction on a clone of the original element,
 * preserving child node structure in each justified line.
 */

import { prepareWithSegments } from "@chenglou/pretext";
import type { PreparedTextWithSegments } from "@chenglou/pretext";
import { hyphenateText } from "./hyphenation";
import {
	computeOptimalLayout,
	computeGreedyLayout,
	measureSpaceWidth,
	measureHyphenWidth,
	clearJustificationCaches,
} from "./justification";
import type { JustifiedLine } from "./types";

// ---------------------------------------------------------------------------
// Plugin settings used by the renderer
// ---------------------------------------------------------------------------

export interface JustifySettings {
	/** Enable/disable hyphenation */
	hyphenate: boolean;
	/** Use greedy algorithm as fallback */
	greedyFallback: boolean;
	/** Minimum word spacing as a fraction of normal space width (0.3–0.9) */
	minSpacingRatio: number;
	/** Tight penalty threshold as a fraction of normal space width (0.5–1.0) */
	tightPenaltyThreshold: number;
	/** Minimum paragraph width in px below which justification is skipped */
	minWidth: number;
	/** Maximum entries in the prepared-text cache (50–1000) */
	maxCacheEntries: number;
}

export const DEFAULT_SETTINGS: JustifySettings = {
	hyphenate: true,
	greedyFallback: true,
	minSpacingRatio: 0.5,
	tightPenaltyThreshold: 0.75,
	minWidth: 100,
	maxCacheEntries: 200,
};

// ---------------------------------------------------------------------------
// Soft hyphen character
// ---------------------------------------------------------------------------

const SHY = "­";

// ---------------------------------------------------------------------------
// Cache for Pretext-prepared text (avoid re-measuring on resize)
// ---------------------------------------------------------------------------

interface PrepareCacheEntry {
	prepared: PreparedTextWithSegments;
	font: string;
	text: string;
}

const _prepareCache = new Map<string, PrepareCacheEntry>();
let _prepareCacheMaxSize = 200;

/**
 * Set the maximum number of prepared-text cache entries.
 * Also clears the cache if the new limit is lower than the current size.
 */
export function setPrepareCacheMaxSize(size: number): void {
	_prepareCacheMaxSize = Math.max(50, Math.min(1000, size));
	if (_prepareCache.size > _prepareCacheMaxSize) {
		let toDelete = _prepareCache.size - _prepareCacheMaxSize;
		for (const key of _prepareCache.keys()) {
			_prepareCache.delete(key);
			if (--toDelete <= 0) break;
		}
	}
}

function getOrPrepare(
	text: string,
	font: string,
): PreparedTextWithSegments {
	const key = `${font}\x00${text}`;
	const cached = _prepareCache.get(key);
	if (cached) return cached.prepared;

	const prepared = prepareWithSegments(text, font);
	_prepareCache.set(key, { prepared, font, text });

	// Evict oldest entries when cache grows too large
	const maxSize = _prepareCacheMaxSize;
	if (_prepareCache.size > maxSize) {
		let toDelete = _prepareCache.size - maxSize;
		for (const key of _prepareCache.keys()) {
			_prepareCache.delete(key);
			if (--toDelete <= 0) break;
		}
	}

	return prepared;
}

export function clearPrepareCache(): void {
	_prepareCache.clear();
}

// ---------------------------------------------------------------------------
// Measure space and hyphen width with caching
// ---------------------------------------------------------------------------

interface FontMetrics {
	normalSpaceWidth: number;
	hyphenWidth: number;
}

const _fontMetricsCache = new Map<string, FontMetrics>();

function getFontMetrics(font: string): FontMetrics {
	const cached = _fontMetricsCache.get(font);
	if (cached) return cached;
	const metrics: FontMetrics = {
		normalSpaceWidth: measureSpaceWidth(font),
		hyphenWidth: measureHyphenWidth(font),
	};
	_fontMetricsCache.set(font, metrics);
	return metrics;
}

export function clearFontMetricsCache(): void {
	_fontMetricsCache.clear();
	clearJustificationCaches();
}

// ---------------------------------------------------------------------------
// Insert soft hyphens into DOM text nodes
// ---------------------------------------------------------------------------

/**
 * Walk text nodes inside `root` and insert soft hyphens (&shy;) at
 * permissible hyphenation points within words.
 */
function insertHyphenationPoints(root: HTMLElement): void {
	const textNodes: Text[] = [];
	const walker = root.ownerDocument.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT,
	);
	let node: Text | null;
	while ((node = walker.nextNode() as Text | null)) {
		textNodes.push(node);
	}

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const parts = text.split(/(\s+)/);
		const hyphenated = parts.map((p) => {
			if (/^\s+$/.test(p)) return p;
			return hyphenateText(p.replace(/[­]/g, ""));
		});
		textNode.textContent = hyphenated.join("");
	}
}

// ---------------------------------------------------------------------------
// Build segment &rarr; global char position mapping
// ---------------------------------------------------------------------------

/**
 * Build an array where segPositions[i] = the global character position
 * of segment i in the full prepared text. The last entry is the total
 * text length.
 */
function buildSegPositions(segments: string[]): Uint32Array {
	const pos = new Uint32Array(segments.length + 1);
	let p = 0;
	for (let i = 0; i < segments.length; i++) {
		pos[i] = p;
		p += segments[i]?.length ?? 0;
	}
	pos[segments.length] = p;
	return pos;
}

// ---------------------------------------------------------------------------
// Extract a character range from a DOM tree as a DocumentFragment
// ---------------------------------------------------------------------------

/**
 * Walk text nodes in `root` and clone the content covering characters
 * from `startChar` to `endChar` (exclusive) as a DocumentFragment.
 *
 * Uses `range.cloneContents()` to NOT mutate the original tree, so
 * multiple extractions can be performed on the same root.
 */
function cloneCharRange(
	root: HTMLElement,
	startChar: number,
	endChar: number,
): DocumentFragment {
	const doc = root.ownerDocument;
	const range = doc.createRange();

	let pos = 0;
	let started = false;

	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node: Text | null;
	while ((node = walker.nextNode() as Text | null)) {
		const len = node.textContent?.length ?? 0;
		const nextPos = pos + len;

		if (!started && nextPos > startChar) {
			range.setStart(node, startChar - pos);
			started = true;
		}
		if (started && nextPos >= endChar) {
			range.setEnd(node, endChar - pos);
			break;
		}
		pos = nextPos;
	}

	return range.cloneContents();
}

// ---------------------------------------------------------------------------
// Clean up soft hyphens in a fragment
// ---------------------------------------------------------------------------

/**
 * For a non-hyphenated line: remove all soft hyphens.
 * For a hyphenated line: replace the LAST soft hyphen with a visible
 * hyphen character, then remove any remaining soft hyphens.
 */
function cleanupHyphensInFragment(
	frag: DocumentFragment,
	endsWithHyphen: boolean,
): void {
	if (endsWithHyphen) {
		let lastShyNode: Text | null = null;
		let lastShyOffset = -1;

		const walker = frag.ownerDocument.createTreeWalker(
			frag,
			NodeFilter.SHOW_TEXT,
		);
		let node: Text | null;
		while ((node = walker.nextNode() as Text | null)) {
			const idx = node.textContent?.lastIndexOf(SHY) ?? -1;
			if (idx >= 0) {
				lastShyNode = node;
				lastShyOffset = idx;
			}
		}

		if (lastShyNode && lastShyOffset >= 0) {
			const full = lastShyNode.textContent ?? "";
			lastShyNode.textContent =
				full.slice(0, lastShyOffset) + "-" + full.slice(lastShyOffset + 1);
		}

		removeSoftHyphens(frag);
	} else {
		removeSoftHyphens(frag);
	}
}

function removeSoftHyphens(root: Node): void {
	const walker = (root.ownerDocument ?? activeDocument).createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT,
	);
	let node: Text | null;
	while ((node = walker.nextNode() as Text | null)) {
		const text = node.textContent ?? "";
		if (text.indexOf(SHY) >= 0) {
			node.textContent = text.replace(new RegExp(SHY, "g"), "");
		}
	}
}

// ---------------------------------------------------------------------------
// Main entry point: justify a single paragraph element
// ---------------------------------------------------------------------------

/**
 * Justify a single paragraph element using the Knuth-Plass algorithm.
 * Replaces the element with a container of justified line divs.
 *
 * @returns The new container element, or null if justification was skipped.
 */
export function justifyParagraph(
	p: HTMLElement,
	settings: JustifySettings,
	font: string,
): HTMLElement | null {
	const maxWidth = p.getBoundingClientRect().width;

	// Account for padding
	const pStyle = getComputedStyle(p);
	const padLeft = parseFloat(pStyle.paddingLeft ?? "0");
	const padRight = parseFloat(pStyle.paddingRight ?? "0");
	const contentWidth = maxWidth - padLeft - padRight;

	// 1. Clone the element and insert soft hyphens
	const clone = p.cloneNode(true) as HTMLElement;
	if (settings.hyphenate) {
		insertHyphenationPoints(clone);
	}

	// 2. Get text content from hyphenated clone
	const hyphenatedText = clone.textContent ?? "";
	if (hyphenatedText.trim().length === 0) { return null; }

	// 3. Measure font metrics & prepare text with Pretext
	let normalSpaceWidth, hyphenWidth;
	try {
		const metrics = getFontMetrics(font);
		normalSpaceWidth = metrics.normalSpaceWidth;
		hyphenWidth = metrics.hyphenWidth;
	} catch(e) {
		console.error("PJ: font metrics failed", e);
		return null;
	}

	let prepared;
	try {
		prepared = getOrPrepare(hyphenatedText, font);
	} catch(e) {
		console.error("PJ: prepare failed", e);
		return null;
	}
	const segs = prepared.segments;
	const widths = prepared.widths;

	// 4. Compute optimal layout
	let lines: JustifiedLine[];
	try {
		lines = computeOptimalLayout(
			segs,
			widths,
			contentWidth,
			normalSpaceWidth,
			hyphenWidth,
			settings.minSpacingRatio,
			settings.tightPenaltyThreshold,
		);
	} catch {
		if (settings.greedyFallback) {
			lines = computeGreedyLayout(segs, widths, contentWidth, hyphenWidth);
		} else {
			return null;
		}
	}

	if (lines.length === 0) return null;

	// 5. Build segment &rarr; character-position map
	const segPos = buildSegPositions(segs);

	// 6. Render justified lines
	const doc = p.ownerDocument;
	const container = doc.createElement("div");
	container.className = "pretext-container";

	// Copy margins from original paragraph so layout doesn't jump
	container.style.marginTop = pStyle.marginTop;
	container.style.marginBottom = pStyle.marginBottom;

	// Copy padding so the content area matches the contentWidth used by the DP algorithm
	container.style.paddingLeft = pStyle.paddingLeft;
	container.style.paddingRight = pStyle.paddingRight;

	for (const line of lines) {
		const lineDiv = doc.createElement("div");
		lineDiv.className = "pretext-line";

		// Character range for this line
		const startChar = segPos[line.fromSegIndex];
		const endChar = segPos[line.toSegIndex];

		// Clone DOM content for this character range
		const frag = cloneCharRange(clone, startChar, endChar);

		// Clean up soft hyphens (replace break-hyphen with visible '-')
		if (frag.childNodes.length > 0) {
			cleanupHyphensInFragment(frag, line.endsWithHyphen);
		}

		// If line ends with a hyphenated break and no visible hyphen
		// was produced, append one.
		if (line.endsWithHyphen) {
			let hasVisibleHyphen = false;
			const tw = doc.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
			let tn: Text | null;
			while ((tn = tw.nextNode() as Text | null)) {
				if ((tn.textContent ?? "").endsWith("-")) {
					hasVisibleHyphen = true;
					break;
				}
			}
			if (!hasVisibleHyphen) {
				frag.append(doc.createTextNode("-"));
			}
		}

		// Apply justification: word-spacing
		const spaces = line.segments.filter((s) => s.isSpace);
		if (spaces.length > 0) {
			const wordWidth = line.segments.reduce(
				(sum, s) => (s.isSpace ? sum : sum + s.width),
				0,
			);

			if (line.isLast) {
				// Last line: left-aligned (not justified).
				// Only squeeze if natural width overflows, and only as
				// much as needed (clamped by minSpacingRatio).
				const naturalWidth = wordWidth + spaces.length * normalSpaceWidth;
				const overflow = naturalWidth - line.maxWidth;
				if (overflow > 0.5) {
					const minSpace = normalSpaceWidth * settings.minSpacingRatio;
					const squeezePerGap = overflow / spaces.length;
					const targetSpace = normalSpaceWidth - squeezePerGap;
					const clamped = Math.max(minSpace, targetSpace);
					const ws = clamped - normalSpaceWidth;
					if (Math.abs(ws) > 0.01) {
						lineDiv.style.wordSpacing = `${ws}px`;
					}
				}
			} else {
				// Non-last lines: fully justified to fill maxWidth
				let justifiedSpace = (line.maxWidth - wordWidth) / spaces.length;
				if (justifiedSpace < normalSpaceWidth * settings.minSpacingRatio) {
					justifiedSpace = normalSpaceWidth * settings.minSpacingRatio;
				}
				const wordSpacing = justifiedSpace - normalSpaceWidth;
				if (Math.abs(wordSpacing) > 0.01) {
					lineDiv.style.wordSpacing = `${wordSpacing}px`;
				}
			}

		}

		lineDiv.append(frag);
		container.append(lineDiv);
	}

	p.replaceWith(container);
	return container;
}

// ---------------------------------------------------------------------------
// Revert
// ---------------------------------------------------------------------------

/**
 * Check whether an element has been justified by this plugin.
 */
export function isJustified(el: HTMLElement): boolean {
	return el.classList.contains("pretext-container");
}

/**
 * Revert a justified container back to a normal paragraph,
 * preserving its children.
 */
export function revertToParagraph(
	container: HTMLElement,
): HTMLParagraphElement {
	const doc = container.ownerDocument;
	const p = doc.createElement("p");
	while (container.firstChild) {
		p.append(container.firstChild);
	}
	container.replaceWith(p);
	return p;
}
