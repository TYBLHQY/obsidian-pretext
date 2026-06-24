/**
 * Knuth-Plass optimal line-breaking algorithm.
 *
 * Ported from the Pretext justification-comparison demo:
 * https://github.com/chenglou/pretext
 *
 * The algorithm enumerates all feasible break positions (word boundaries
 * and soft hyphens), builds a graph with edges weighted by a "badness"
 * cost function, and finds the shortest path through the DP recurrence:
 *   dp[j] = min over i<j of dp[i] + badness(i, j)
 *
 * The badness function combines:
 *   - Cubic stretch/shrink ratio (Knuth-style)
 *   - River penalty (when spaces exceed 150% of normal)
 *   - Tight spacing penalty (when spaces are below 65% of normal)
 *   - Hyphen penalty (small constant for hyphenated breaks)
 */

import type {
	BreakCandidate,
	JustifiedLine,
	JustifiedSegment,
} from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Measure the width of a single space character in a given font.
 * Uses an offscreen canvas and caches results per font string.
 */
const _spaceCache = new Map<string, number>();

/**
 * Clear all internal measurement caches. Called on plugin unload
 * and when the user changes cache size settings.
 */
export function clearJustificationCaches(): void {
	_spaceCache.clear();
	_hyphenCache.clear();
}

export function measureSpaceWidth(font: string): number {
	const cached = _spaceCache.get(font);
	if (cached !== undefined) return cached;

	const ctx = activeDocument.createElement("canvas").getContext("2d");
	if (!ctx) {
		// fallback: typical space width ≈ 0.25 × font-size
		const size = parseFloat(font);
		const fallback = isNaN(size) ? 4 : size * 0.25;
		_spaceCache.set(font, fallback);
		return fallback;
	}
	ctx.font = font;
	const width = ctx.measureText(" ").width;
	_spaceCache.set(font, width);
	return width;
}

/**
 * Measure the width of a hyphen character in a given font.
 * Uses an offscreen canvas and caches results per font string.
 */
const _hyphenCache = new Map<string, number>();

export function measureHyphenWidth(font: string): number {
	const cached = _hyphenCache.get(font);
	if (cached !== undefined) return cached;

	const ctx = activeDocument.createElement("canvas").getContext("2d");
	if (!ctx) {
		const fallback = 5;
		_hyphenCache.set(font, fallback);
		return fallback;
	}
	ctx.font = font;
	const width = ctx.measureText("-").width;
	_hyphenCache.set(font, width);
	return width;
}

// ---------------------------------------------------------------------------
// Break candidate enumeration
// ---------------------------------------------------------------------------

/**
 * Enumerate all feasible break positions in the prepared text.
 *
 * Break candidates are placed at:
 *   - Index 0 (paragraph start)
 *   - After each space character
 *   - After each soft hyphen (&shy;, ­)
 *   - At the end of the paragraph (sentinel)
 */
export function enumerateBreakCandidates(
	segments: string[],
): BreakCandidate[] {
	const candidates: BreakCandidate[] = [{ segIndex: 0, isSoftHyphen: false }];
	const n = segments.length;

	for (let i = 0; i < n; i++) {
		const text = segments[i];
		if (!text) continue;

		if (text === "­") {
			// Soft hyphen: break is possible after this segment
			if (i + 1 < n) {
				candidates.push({ segIndex: i + 1, isSoftHyphen: true });
			}
		} else if (text.trim().length === 0 && i + 1 < n) {
			// Space: break is possible after the space
			candidates.push({ segIndex: i + 1, isSoftHyphen: false });
		}
	}

	// Sentinel: end of paragraph
	candidates.push({ segIndex: n, isSoftHyphen: false });

	return candidates;
}

// ---------------------------------------------------------------------------
// Line info
// ---------------------------------------------------------------------------

interface LineInfo {
	wordWidth: number;
	spaceCount: number;
	endsWithHyphen: boolean;
}

/**
 * Compute the metrics for a line spanning from break candidate `fromIdx`
 * to break candidate `toIdx`.
 */
function getLineInfo(
	fromIdx: number,
	toIdx: number,
	candidates: BreakCandidate[],
	segments: string[],
	widths: Float64Array | number[],
	hyphenWidth: number,
): LineInfo {
	const from = candidates[fromIdx].segIndex;
	const to = candidates[toIdx].segIndex;
	const endsWithHyphen = candidates[toIdx].isSoftHyphen;

	let wordWidth = 0;
	let spaceCount = 0;

	for (let si = from; si < to; si++) {
		const text = segments[si];
		if (!text) continue;
		if (text === "­") continue; // soft hyphens: zero width

		if (text.trim().length === 0) {
			spaceCount++;
		} else {
			wordWidth += widths[si];
		}
	}

	// Trailing space doesn't contribute to justification
	if (to > from) {
		const lastSeg = segments[to - 1];
		if (lastSeg && lastSeg.trim().length === 0) {
			spaceCount--;
		}
	}

	// Add hyphen width if break is at a soft hyphen
	if (endsWithHyphen) {
		wordWidth += hyphenWidth;
	}

	return { wordWidth, spaceCount, endsWithHyphen };
}

// ---------------------------------------------------------------------------
// Badness function
// ---------------------------------------------------------------------------

/**
 * Compute the cost (badness) of a line.
 *
 * The cost combines multiple terms:
 *   - Core: cubic stretch/shrink ratio (|ratio|³ × 1000)
 *   - River penalty: heavy cost when spaces exceed 150% of normal
 *   - Tight penalty: heavy cost when spaces are below 65% of normal
 *   - Hyphen penalty: small constant for hyphenated breaks
 *
 * Returns 1e8 for infeasible lines (overflow, spaces too tight).
 */
function lineBadness(
	info: LineInfo,
	isLastLine: boolean,
	maxWidth: number,
	normalSpaceWidth: number,
	minSpacingRatio: number,
	tightThreshold: number,
): number {
	// Last line: left-aligned (not justified). Penalise overflow.
	if (isLastLine) {
		if (info.wordWidth > maxWidth) return 1e8;
		if (info.spaceCount === 0) return 0;

		const naturalWidth = info.wordWidth + info.spaceCount * normalSpaceWidth;
		if (naturalWidth <= maxWidth) return 0; // fits naturally

		// Must squeeze to fit. Penalty proportional to squeeze amount.
		const usedSpace = (maxWidth - info.wordWidth) / info.spaceCount;
		const ratio = (normalSpaceWidth - usedSpace) / normalSpaceWidth;
		return ratio * ratio * 100;
	}

	// No spaces (single word): penalize based on slack
	if (info.spaceCount <= 0) {
		const slack = maxWidth - info.wordWidth;
		if (slack < 0) return 1e8;
		return slack * slack * 10;
	}

	// Compute the justified space width for each inter-word gap
	const justifiedSpace = (maxWidth - info.wordWidth) / info.spaceCount;
	if (justifiedSpace < 0) return 1e8; // overflow

	// Reject if spaces would be narrower than 40% of normal
	if (justifiedSpace < normalSpaceWidth * minSpacingRatio) return 1e8;

	// Core badness: cube of the deviation from normal
	const ratio = (justifiedSpace - normalSpaceWidth) / normalSpaceWidth;
	const absRatio = Math.abs(ratio);
	const badness = absRatio * absRatio * absRatio * 1000;

	// River penalty: spaces exceed 150% of normal → creates rivers
	const riverExcess = justifiedSpace / normalSpaceWidth - 1.5;
	const riverPenalty =
		riverExcess > 0
			? 5000 + riverExcess * riverExcess * 10000
			: 0;

	// Tight penalty: spaces tighter than the configured threshold → cramped
	const aTightThreshold = normalSpaceWidth * tightThreshold;
	const tightPenalty =
		justifiedSpace < aTightThreshold
			? 3000 +
				(aTightThreshold - justifiedSpace) *
					(aTightThreshold - justifiedSpace) *
					10000
			: 0;

	// Hyphen penalty: small constant to prefer word breaks over hyphens
	const hyphenPenalty = info.endsWithHyphen ? 50 : 0;

	return badness + riverPenalty + tightPenalty + hyphenPenalty;
}

// ---------------------------------------------------------------------------
// Optimal layout (Knuth-Plass DP)
// ---------------------------------------------------------------------------

/**
 * Compute the optimal line breaks for a paragraph using the Knuth-Plass
 * dynamic programming algorithm.
 *
 * @param segments     Array of text segments from Pretext preparation.
 * @param widths       Array of pixel widths parallel to `segments`.
 * @param maxWidth     The target line width in pixels.
 * @param normalSpaceWidth  Measured width of a single space in the font.
 * @param hyphenWidth  Measured width of a hyphen character in the font.
 * @param minSpacingRatio  Minimum allowed word spacing as fraction of normal.
 * @param tightThreshold   Fraction of normal space below which tight penalty applies.
 * @returns Array of JustifiedLine objects.
 */
export function computeOptimalLayout(
	segments: string[],
	widths: Float64Array | number[],
	maxWidth: number,
	normalSpaceWidth: number,
	hyphenWidth: number,
	minSpacingRatio: number,
	tightThreshold: number,
): JustifiedLine[] {
	const n = segments.length;
	if (n === 0) return [];

	const candidates = enumerateBreakCandidates(segments);
	const numCandidates = candidates.length;

	// ----- DP: shortest path -----
	const dp = new Float64Array(numCandidates).fill(Infinity);
	const prev = new Int32Array(numCandidates).fill(-1);
	dp[0] = 0;

	for (let j = 1; j < numCandidates; j++) {
		const isLast = j === numCandidates - 1;

		// Walk backwards from j-1 to find the best predecessor
		for (let i = j - 1; i >= 0; i--) {
			if (dp[i] === Infinity) continue;

			const info = getLineInfo(
				i,
				j,
				candidates,
				segments,
				widths,
				hyphenWidth,
			);

			// Pruning: if natural width (with normal spaces) exceeds 2× maxWidth,
			// earlier starts will only add more words → even wider → never feasible
			const totalWidth = info.wordWidth + info.spaceCount * normalSpaceWidth;
			if (totalWidth > maxWidth * 2) break;

			const bad = lineBadness(
				info,
				isLast,
				maxWidth,
				normalSpaceWidth,
				minSpacingRatio,
				tightThreshold,
			);
			const total = dp[i] + bad;
			if (total < dp[j]) {
				dp[j] = total;
				prev[j] = i;
			}
		}
	}

	// ----- Backtrace: recover break points -----
	const breakIndices: number[] = [];
	let cur = numCandidates - 1;
	while (cur > 0) {
		if (prev[cur] === -1) {
			cur--;
			continue;
		}
		breakIndices.push(cur);
		cur = prev[cur];
	}
	breakIndices.reverse();

	// ----- Build lines from break points -----
	const lines: JustifiedLine[] = [];
	let fromCandidate = 0;

	for (let bi = 0; bi < breakIndices.length; bi++) {
		const toCandidate = breakIndices[bi];
		const from = candidates[fromCandidate].segIndex;
		const to = candidates[toCandidate].segIndex;
		const endsWithHyphen = candidates[toCandidate].isSoftHyphen;
		const isLast = toCandidate === numCandidates - 1;

		// Build segments array for this line
		const lineSegments: JustifiedSegment[] = [];
		for (let si = from; si < to; si++) {
			const text = segments[si];
			if (!text) continue;
			if (text === "­") continue; // skip soft hyphen in rendered output

			const width = widths[si];
			const isSpace = text.trim().length === 0;
			lineSegments.push({ text, width, isSpace });
		}

		// Append visible hyphen for soft-hyphen breaks
		if (endsWithHyphen) {
			lineSegments.push({
				text: "-",
				width: hyphenWidth,
				isSpace: false,
			});
		}

		// Strip trailing spaces
		while (
			lineSegments.length > 0 &&
			lineSegments[lineSegments.length - 1].isSpace
		) {
			lineSegments.pop();
		}

		// Compute natural line width
		let lineWidth = 0;
		for (const seg of lineSegments) {
			lineWidth += seg.width;
		}

		lines.push({
			segments: lineSegments,
			lineWidth,
			maxWidth,
			isLast,
			endsWithHyphen,
			fromSegIndex: from,
			toSegIndex: to,
		});

		fromCandidate = toCandidate;
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Greedy justified layout (baseline fallback)
// ---------------------------------------------------------------------------

/**
 * A simple greedy justified layout that fills each line to maxWidth without
 * lookahead. Useful as a fallback when the DP is not needed, or for
 * quantifying the improvement of the optimal algorithm.
 *
 * @param segments     Array of text segments from Pretext preparation.
 * @param widths       Array of pixel widths parallel to `segments`.
 * @param maxWidth     The target line width in pixels.
 * @param hyphenWidth  Measured width of a hyphen character.
 * @returns Array of JustifiedLine objects.
 */
export function computeGreedyLayout(
	segments: string[],
	widths: Float64Array | number[],
	maxWidth: number,
	hyphenWidth: number,
): JustifiedLine[] {
	const lines: JustifiedLine[] = [];
	const n = segments.length;

	let si = 0;
	while (si < n) {
		const lineSegments: JustifiedSegment[] = [];
		let lineWidth = 0;
		let endsWithHyphen = false;
		const siStart = si;

		// Fill the line greedily
		while (si < n) {
			const text = segments[si];
			if (!text) {
				si++;
				continue;
			}

			if (text === "­") {
				// Check if breaking here would still fit
				const nextSeg = segments[si + 1];
				const nextWidth =
					nextSeg !== undefined ? widths[si + 1] : 0;
				if (lineWidth > 0 && lineWidth + hyphenWidth + nextWidth > maxWidth) {
					// Break before the next word; this line ends with hyphen
					lineSegments.push({
						text: "-",
						width: hyphenWidth,
						isSpace: false,
					});
					lineWidth += hyphenWidth;
					endsWithHyphen = true;
					si++;
					break;
				}
				// Skip soft hyphen in measurement, continue accumulating
				si++;
				continue;
			}

			const isSpace = text.trim().length === 0;
			const width = widths[si];

			if (lineWidth + width > maxWidth && !isSpace && lineSegments.length > 0) {
				// Word doesn't fit → break the line here
				break;
			}

			lineSegments.push({ text, width, isSpace });
			lineWidth += width;
			si++;
		}

		// Strip trailing spaces
		while (
			lineSegments.length > 0 &&
			lineSegments[lineSegments.length - 1].isSpace
		) {
			const removed = lineSegments.pop();
			if (removed) lineWidth -= removed.width;
		}

		const isLast = si >= n;

		lines.push({
			segments: lineSegments,
			lineWidth,
			maxWidth,
			isLast,
			endsWithHyphen,
			fromSegIndex: siStart,
			toSegIndex: si,
		});
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

/**
 * Compute quality metrics for a set of justified lines.
 */
export function computeMetrics(
	lines: JustifiedLine[],
	normalSpaceWidth: number,
): {
	avgDeviation: number;
	maxDeviation: number;
	riverCount: number;
	lineCount: number;
} {
	let totalDeviation = 0;
	let maxDeviation = 0;
	let riverCount = 0;
	let measuredLines = 0;

	for (const line of lines) {
		if (line.isLast || line.segments.length === 0) continue;

		// Only measure truly justified lines
		const spaces = line.segments.filter((s) => s.isSpace);
		if (spaces.length === 0) continue;

		const wordWidth = line.segments.reduce(
			(sum, s) => (s.isSpace ? sum : sum + s.width),
			0,
		);
		const justifiedSpace = (line.maxWidth - wordWidth) / spaces.length;

		if (justifiedSpace <= 0) continue;

		const deviation =
			Math.abs(justifiedSpace - normalSpaceWidth) / normalSpaceWidth;
		totalDeviation += deviation;
		maxDeviation = Math.max(maxDeviation, deviation);
		if (justifiedSpace > normalSpaceWidth * 1.5) riverCount++;
		measuredLines++;
	}

	return {
		avgDeviation: measuredLines > 0 ? totalDeviation / measuredLines : 0,
		maxDeviation,
		riverCount,
		lineCount: lines.length,
	};
}
