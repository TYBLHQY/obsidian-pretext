/** A single word/space/hyphen segment within a justified line. */
export interface JustifiedSegment {
	text: string;
	width: number;
	isSpace: boolean;
}

/** A single justified line produced by the algorithm. */
export interface JustifiedLine {
	segments: JustifiedSegment[];
	lineWidth: number;
	maxWidth: number;
	isLast: boolean;
	endsWithHyphen: boolean;
	/** Index range into the original prepared-text segments array. */
	fromSegIndex: number;
	toSegIndex: number;
}

/** A break candidate during the DP. */
export interface BreakCandidate {
	segIndex: number;
	isSoftHyphen: boolean;
}

/** Metrics about inter-word spacing quality. */
export interface QualityMetrics {
	avgDeviation: number;
	maxDeviation: number;
	riverCount: number;
	lineCount: number;
	layoutMs: number;
}
