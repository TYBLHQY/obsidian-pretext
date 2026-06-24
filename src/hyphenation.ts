/**
 * Hyphenation module ported from the Pretext justification-comparison demo.
 *
 * Three-level strategy:
 * 1. Exceptions dictionary (hand-written overrides)
 * 2. Prefix-based splitting
 * 3. Suffix-based splitting
 *
 * Words shorter than 5 characters are never hyphenated.
 */

// ---------------------------------------------------------------------------
// Exceptions dictionary — words whose hyphenation can't be derived by
// prefix/suffix rules.
// ---------------------------------------------------------------------------
const HYPHEN_EXCEPTIONS: Record<string, string[]> = {
	abbreviated: ["ab", "bre", "vi", "a", "ted"],
	abilities: ["a", "bil", "i", "ties"],
	ability: ["a", "bil", "i", "ty"],
	absorbing: ["ab", "sorb", "ing"],
	academic: ["ac", "a", "dem", "ic"],
	accidentally: ["ac", "ci", "den", "tal", "ly"],
	accommodate: ["ac", "com", "mo", "date"],
	accompanying: ["ac", "com", "pa", "ny", "ing"],
	accumulated: ["ac", "cu", "mu", "la", "ted"],
	achievement: ["achieve", "ment"],
	acknowledged: ["ac", "knowl", "edged"],
	acquisition: ["ac", "qui", "si", "tion"],
	activities: ["ac", "tiv", "i", "ties"],
	additionally: ["ad", "di", "tion", "al", "ly"],
	administrative: ["ad", "min", "is", "tra", "tive"],
	advertisement: ["ad", "ver", "tise", "ment"],
	agricultural: ["ag", "ri", "cul", "tur", "al"],
	alternatively: ["al", "ter", "na", "tive", "ly"],
	anniversary: ["an", "ni", "ver", "sa", "ry"],
	appreciation: ["ap", "pre", "ci", "a", "tion"],
	approximately: ["ap", "prox", "i", "mate", "ly"],
	architectural: ["ar", "chi", "tec", "tur", "al"],
	assassination: ["as", "sas", "si", "na", "tion"],
	associate: ["as", "so", "ci", "ate"],
	association: ["as", "so", "ci", "a", "tion"],
	atmosphere: ["at", "mo", "sphere"],
	authoritative: ["au", "thor", "i", "ta", "tive"],
	automatically: ["au", "to", "mat", "i", "cal", "ly"],
	availability: ["a", "vail", "a", "bil", "i", "ty"],
	bankruptcy: ["bank", "rupt", "cy"],
	beautiful: ["beau", "ti", "ful"],
	beginning: ["be", "gin", "ning"],
	beneficiary: ["ben", "e", "fi", "ci", "ar", "y"],
	business: ["busi", "ness"],
	cafeteria: ["caf", "e", "te", "ri", "a"],
	calculation: ["cal", "cu", "la", "tion"],
	certificate: ["cer", "tif", "i", "cate"],
	chronological: ["chron", "o", "log", "i", "cal"],
	circumstance: ["cir", "cum", "stance"],
	classification: ["clas", "si", "fi", "ca", "tion"],
	colleague: ["col", "league"],
	collective: ["col", "lec", "tive"],
	comfortable: ["com", "for", "ta", "ble"],
	commercial: ["com", "mer", "cial"],
	commission: ["com", "mis", "sion"],
	communication: ["com", "mu", "ni", "ca", "tion"],
	community: ["com", "mu", "ni", "ty"],
	comparative: ["com", "par", "a", "tive"],
	competitive: ["com", "pet", "i", "tive"],
	completely: ["com", "plete", "ly"],
	complication: ["com", "pli", "ca", "tion"],
	comprehensive: ["com", "pre", "hen", "sive"],
	compromise: ["com", "pro", "mise"],
	compulsory: ["com", "pul", "so", "ry"],
	concentration: ["con", "cen", "tra", "tion"],
	confidential: ["con", "fi", "den", "tial"],
	confirmation: ["con", "fir", "ma", "tion"],
	congratulation: ["con", "grat", "u", "la", "tion"],
	conscience: ["con", "science"],
	consequently: ["con", "se", "quent", "ly"],
	conservative: ["con", "ser", "va", "tive"],
	conspicuous: ["con", "spic", "u", "ous"],
	constitution: ["con", "sti", "tu", "tion"],
	contemporary: ["con", "tem", "po", "rar", "y"],
	controversial: ["con", "tro", "ver", "sial"],
	convenience: ["con", "ven", "ience"],
	conversation: ["con", "ver", "sa", "tion"],
	cooperation: ["co", "op", "er", "a", "tion"],
	coordinator: ["co", "or", "di", "na", "tor"],
	correspondence: ["cor", "re", "spond", "ence"],
	councilor: ["coun", "ci", "lor"],
	criticism: ["crit", "i", "cism"],
	curriculum: ["cur", "ric", "u", "lum"],
	database: ["da", "ta", "base"],
	decentralized: ["de", "cen", "tral", "ized"],
	decision: ["de", "ci", "sion"],
	definitely: ["def", "i", "nite", "ly"],
	deliberately: ["de", "lib", "er", "ate", "ly"],
	democracy: ["de", "moc", "ra", "cy"],
	department: ["de", "part", "ment"],
	dependability: ["de", "pend", "a", "bil", "i", "ty"],
	desperate: ["des", "per", "ate"],
	determination: ["de", "ter", "mi", "na", "tion"],
	development: ["de", "vel", "op", "ment"],
	dictionary: ["dic", "tion", "ar", "y"],
	differential: ["dif", "fer", "en", "tial"],
	diplomacy: ["di", "plo", "ma", "cy"],
	disappearance: ["dis", "ap", "pear", "ance"],
	disappointed: ["dis", "ap", "point", "ed"],
	discrimination: ["dis", "crim", "i", "na", "tion"],
	distinguished: ["dis", "tin", "guished"],
	distribution: ["dis", "tri", "bu", "tion"],
	diversity: ["di", "ver", "si", "ty"],
	documentation: ["doc", "u", "men", "ta", "tion"],
	domestic: ["do", "mes", "tic"],
	durability: ["du", "ra", "bil", "i", "ty"],
	economic: ["ec", "o", "nom", "ic"],
	effectively: ["ef", "fec", "tive", "ly"],
	efficiency: ["ef", "fi", "cien", "cy"],
	elementary: ["el", "e", "men", "ta", "ry"],
	eliminate: ["e", "lim", "i", "nate"],
	embarrassment: ["em", "bar", "rass", "ment"],
	encyclopedia: ["en", "cy", "clo", "pe", "di", "a"],
	environment: ["en", "vi", "ron", "ment"],
	equivalent: ["e", "quiv", "a", "lent"],
	especially: ["es", "pe", "cial", "ly"],
	essential: ["es", "sen", "tial"],
	establishment: ["es", "tab", "lish", "ment"],
	evaluation: ["e", "val", "u", "a", "tion"],
	eventually: ["e", "ven", "tu", "al", "ly"],
	exaggerated: ["ex", "ag", "ger", "a", "ted"],
	examination: ["ex", "am", "i", "na", "tion"],
	exclusively: ["ex", "clu", "sive", "ly"],
	executive: ["ex", "ec", "u", "tive"],
	existence: ["ex", "ist", "ence"],
	expectation: ["ex", "pec", "ta", "tion"],
	experimental: ["ex", "per", "i", "men", "tal"],
	explanation: ["ex", "pla", "na", "tion"],
	extensively: ["ex", "ten", "sive", "ly"],
	extraordinary: ["ex", "tra", "or", "di", "na", "ry"],
	facilitate: ["fa", "cil", "i", "tate"],
	familiarity: ["fa", "mil", "i", "ar", "i", "ty"],
	fascinating: ["fas", "ci", "na", "ting"],
	fundamental: ["fun", "da", "men", "tal"],
	furthermore: ["fur", "ther", "more"],
	geography: ["ge", "og", "ra", "phy"],
	government: ["gov", "ern", "ment"],
	grammatical: ["gram", "mat", "i", "cal"],
	gratitude: ["grat", "i", "tude"],
	guarantee: ["guar", "an", "tee"],
	harassment: ["ha", "rass", "ment"],
	hemisphere: ["hem", "i", "sphere"],
	hesitation: ["hes", "i", "ta", "tion"],
	homogeneous: ["ho", "mo", "ge", "ne", "ous"],
	honorary: ["hon", "or", "ar", "y"],
	horizontal: ["hor", "i", "zon", "tal"],
	hypothesis: ["hy", "poth", "e", "sis"],
	ideological: ["i", "de", "o", "log", "i", "cal"],
	illegitimate: ["il", "le", "git", "i", "mate"],
	illiterate: ["il", "lit", "er", "ate"],
	immediately: ["im", "me", "di", "ate", "ly"],
	immigrant: ["im", "mi", "grant"],
	independent: ["in", "de", "pend", "ent"],
	indication: ["in", "di", "ca", "tion"],
	indispensable: ["in", "dis", "pen", "sa", "ble"],
	individual: ["in", "di", "vid", "u", "al"],
	industrialization: ["in", "dus", "tri", "al", "i", "za", "tion"],
	inevitable: ["in", "ev", "i", "ta", "ble"],
	information: ["in", "for", "ma", "tion"],
	infrastructure: ["in", "fra", "struc", "ture"],
	ingredient: ["in", "gre", "di", "ent"],
	initiative: ["in", "i", "tia", "tive"],
	intellectual: ["in", "tel", "lec", "tu", "al"],
	intelligence: ["in", "tel", "li", "gence"],
	interference: ["in", "ter", "fer", "ence"],
	intermediate: ["in", "ter", "me", "di", "ate"],
	interrupted: ["in", "ter", "rupt", "ed"],
	introduction: ["in", "tro", "duc", "tion"],
	investigation: ["in", "ves", "ti", "ga", "tion"],
	irrelevant: ["ir", "rel", "e", "vant"],
	irresistible: ["ir", "re", "sist", "i", "ble"],
	journalism: ["jour", "nal", "ism"],
	justification: ["jus", "ti", "fi", "ca", "tion"],
	legislature: ["leg", "is", "la", "ture"],
	legitimate: ["le", "git", "i", "mate"],
	liberal: ["lib", "er", "al"],
	literature: ["lit", "er", "a", "ture"],
	magnificent: ["mag", "nif", "i", "cent"],
	maintenance: ["main", "te", "nance"],
	management: ["man", "age", "ment"],
	mathematics: ["math", "e", "mat", "ics"],
	meaningful: ["mean", "ing", "ful"],
	mechanical: ["me", "chan", "i", "cal"],
	medicine: ["med", "i", "cine"],
	memorandum: ["mem", "o", "ran", "dum"],
	methodology: ["meth", "od", "ol", "o", "gy"],
	military: ["mil", "i", "tar", "y"],
	miniature: ["min", "i", "a", "ture"],
	minimum: ["min", "i", "mum"],
	ministry: ["min", "is", "try"],
	miscellaneous: ["mis", "cel", "la", "ne", "ous"],
	misunderstanding: ["mis", "un", "der", "stand", "ing"],
	modification: ["mod", "i", "fi", "ca", "tion"],
	monopoly: ["mo", "nop", "o", "ly"],
	multinational: ["mul", "ti", "na", "tion", "al"],
	municipality: ["mu", "nic", "i", "pal", "i", "ty"],
	national: ["na", "tion", "al"],
	nevertheless: ["nev", "er", "the", "less"],
	nonetheless: ["none", "the", "less"],
	nourishment: ["nour", "ish", "ment"],
	obligation: ["ob", "li", "ga", "tion"],
	observation: ["ob", "ser", "va", "tion"],
	occasional: ["oc", "ca", "sion", "al"],
	occupation: ["oc", "cu", "pa", "tion"],
	official: ["of", "fi", "cial"],
	operational: ["op", "er", "a", "tion", "al"],
	opportunity: ["op", "por", "tu", "ni", "ty"],
	organization: ["or", "gan", "i", "za", "tion"],
	orientation: ["o", "ri", "en", "ta", "tion"],
	original: ["o", "rig", "i", "nal"],
	orthodox: ["or", "tho", "dox"],
	overwhelming: ["o", "ver", "whelm", "ing"],
	pamphlet: ["pam", "phlet"],
	paragraph: ["par", "a", "graph"],
	parliament: ["par", "lia", "ment"],
	participant: ["par", "tic", "i", "pant"],
	particularly: ["par", "tic", "u", "lar", "ly"],
	passionate: ["pas", "sion", "ate"],
	patience: ["pa", "tience"],
	peaceful: ["peace", "ful"],
	penetration: ["pen", "e", "tra", "tion"],
	perception: ["per", "cep", "tion"],
	performance: ["per", "form", "ance"],
	permanent: ["per", "ma", "nent"],
	perpendicular: ["per", "pen", "dic", "u", "lar"],
	perseverance: ["per", "se", "ver", "ance"],
	personality: ["per", "son", "al", "i", "ty"],
	philosophical: ["phil", "o", "soph", "i", "cal"],
	phenomenon: ["phe", "nom", "e", "non"],
	photography: ["pho", "tog", "ra", "phy"],
	phenomenal: ["phe", "nom", "e", "nal"],
	politician: ["pol", "i", "ti", "cian"],
	population: ["pop", "u", "la", "tion"],
	portion: ["por", "tion"],
	possibility: ["pos", "si", "bil", "i", "ty"],
	practically: ["prac", "ti", "cal", "ly"],
	preceding: ["pre", "ced", "ing"],
	preference: ["pref", "er", "ence"],
	preparation: ["prep", "a", "ra", "tion"],
	preservation: ["pre", "ser", "va", "tion"],
	presidential: ["pres", "i", "den", "tial"],
	principal: ["prin", "ci", "pal"],
	privilege: ["priv", "i", "lege"],
	probability: ["prob", "a", "bil", "i", "ty"],
	procedure: ["pro", "ce", "dure"],
	proclamation: ["proc", "la", "ma", "tion"],
	procrastination: ["pro", "cras", "ti", "na", "tion"],
	professional: ["pro", "fes", "sion", "al"],
	proficiency: ["pro", "fi", "cien", "cy"],
	programming: ["pro", "gram", "ming"],
	pronunciation: ["pro", "nun", "ci", "a", "tion"],
	propaganda: ["prop", "a", "gan", "da"],
	property: ["prop", "er", "ty"],
	proportional: ["pro", "por", "tion", "al"],
	prosecution: ["pros", "e", "cu", "tion"],
	protection: ["pro", "tec", "tion"],
	psychology: ["psy", "chol", "o", "gy"],
	publication: ["pub", "li", "ca", "tion"],
	qualification: ["qual", "i", "fi", "ca", "tion"],
	questionnaire: ["ques", "tion", "naire"],
	rational: ["ra", "tion", "al"],
	rebellion: ["re", "bel", "lion"],
	recession: ["re", "ces", "sion"],
	recommendation: ["rec", "om", "men", "da", "tion"],
	reconciliation: ["rec", "on", "cil", "i", "a", "tion"],
	reduction: ["re", "duc", "tion"],
	reference: ["ref", "er", "ence"],
	reflection: ["re", "flec", "tion"],
	regardless: ["re", "gard", "less"],
	registration: ["reg", "is", "tra", "tion"],
	regulate: ["reg", "u", "late"],
	relationship: ["re", "la", "tion", "ship"],
	relatively: ["rel", "a", "tive", "ly"],
	relevant: ["rel", "e", "vant"],
	religious: ["re", "li", "gious"],
	reluctant: ["re", "luc", "tant"],
	remainder: ["re", "main", "der"],
	representative: ["rep", "re", "sen", "ta", "tive"],
	reproduction: ["re", "pro", "duc", "tion"],
	republican: ["re", "pub", "li", "can"],
	reputation: ["rep", "u", "ta", "tion"],
	reservation: ["res", "er", "va", "tion"],
	resignation: ["res", "ig", "na", "tion"],
	resolution: ["res", "o", "lu", "tion"],
	resourceful: ["re", "source", "ful"],
	respectively: ["re", "spec", "tive", "ly"],
	responsibility: ["re", "spon", "si", "bil", "i", "ty"],
	restaurant: ["res", "tau", "rant"],
	restoration: ["res", "to", "ra", "tion"],
	revolution: ["rev", "o", "lu", "tion"],
	rhythmical: ["rhyth", "mi", "cal"],
	sacrifice: ["sac", "ri", "fice"],
	salary: ["sal", "ar", "y"],
	satisfaction: ["sat", "is", "fac", "tion"],
	schedule: ["sched", "ule"],
	scientific: ["sci", "en", "tif", "ic"],
	secretary: ["sec", "re", "tar", "y"],
	security: ["se", "cur", "i", "ty"],
	sensitive: ["sen", "si", "tive"],
	separately: ["sep", "a", "rate", "ly"],
	settlement: ["set", "tle", "ment"],
	significant: ["sig", "nif", "i", "cant"],
	sophisticated: ["so", "phis", "ti", "ca", "ted"],
	specialization: ["spe", "cial", "i", "za", "tion"],
	specifically: ["spe", "cif", "i", "cal", "ly"],
	spontaneous: ["spon", "ta", "ne", "ous"],
	stabilization: ["sta", "bi", "li", "za", "tion"],
	statistical: ["sta", "tis", "ti", "cal"],
	stereotype: ["ster", "e", "o", "type"],
	stimulate: ["stim", "u", "late"],
	strategy: ["strat", "e", "gy"],
	strengthened: ["strength", "ened"],
	structural: ["struc", "tur", "al"],
	subordinate: ["sub", "or", "di", "nate"],
	substantial: ["sub", "stan", "tial"],
	substitute: ["sub", "sti", "tute"],
	succeeding: ["suc", "ceed", "ing"],
	suffering: ["suf", "fer", "ing"],
	superintendent: ["su", "per", "in", "tend", "ent"],
	superiority: ["su", "pe", "ri", "or", "i", "ty"],
	supplement: ["sup", "ple", "ment"],
	surrounded: ["sur", "round", "ed"],
	surveillance: ["sur", "veil", "lance"],
	susceptible: ["sus", "cep", "ti", "ble"],
	suspicious: ["sus", "pi", "cious"],
	sustainable: ["sus", "tain", "a", "ble"],
	sympathetic: ["sym", "pa", "thet", "ic"],
	technical: ["tech", "ni", "cal"],
	technology: ["tech", "nol", "o", "gy"],
	temperature: ["tem", "per", "a", "ture"],
	temporarily: ["tem", "po", "rar", "i", "ly"],
	tendency: ["tend", "en", "cy"],
	terminology: ["ter", "mi", "nol", "o", "gy"],
	territory: ["ter", "ri", "to", "ry"],
	testimony: ["tes", "ti", "mo", "ny"],
	theoretical: ["the", "o", "ret", "i", "cal"],
	thoroughly: ["thor", "ough", "ly"],
	traditionally: ["tra", "di", "tion", "al", "ly"],
	tragedy: ["trag", "e", "dy"],
	transaction: ["trans", "ac", "tion"],
	transformation: ["trans", "for", "ma", "tion"],
	transparency: ["trans", "par", "en", "cy"],
	transportation: ["trans", "por", "ta", "tion"],
	tremendous: ["tre", "men", "dous"],
	ultimately: ["ul", "ti", "mate", "ly"],
	unanimous: ["u", "nan", "i", "mous"],
	undoubtedly: ["un", "doubt", "ed", "ly"],
	unemployment: ["un", "em", "ploy", "ment"],
	unfortunate: ["un", "for", "tu", "nate"],
	unique: ["u", "nique"],
	universal: ["u", "ni", "ver", "sal"],
	unnecessary: ["un", "nec", "es", "sar", "y"],
	unprecedented: ["un", "prec", "e", "den", "ted"],
	unquestionably: ["un", "ques", "tion", "ab", "ly"],
	utilization: ["u", "ti", "li", "za", "tion"],
	vegetable: ["veg", "e", "ta", "ble"],
	voluntary: ["vol", "un", "tar", "y"],
	western: ["west", "ern"],
	withstand: ["with", "stand"],
	wonderful: ["won", "der", "ful"],
	worldwide: ["world", "wide"],
};

// ---------------------------------------------------------------------------
// Known prefixes and suffixes for rule-based hyphenation
// ---------------------------------------------------------------------------
const PREFIXES = [
	"anti", "auto", "be", "bi", "co", "com", "con", "contra", "counter",
	"de", "dis", "down", "em", "en", "ex", "extra", "fore", "hyper",
	"il", "im", "in", "inter", "intra", "ir", "macro", "mal", "micro",
	"mid", "mis", "mono", "multi", "non", "omni", "out", "over", "para",
	"poly", "post", "pre", "pro", "pseudo", "quasi", "re", "retro",
	"semi", "step", "sub", "super", "sur", "tele", "trans", "tri",
	"ultra", "un", "under", "up",
].sort((a, b) => b.length - a.length); // longest first

const SUFFIXES = [
	"able", "age", "al", "ance", "ant", "ard", "arian", "ary", "ation",
	"dom", " edged", "en", "ence", "ent", "er", "ern", "ery", "ese",
	"esque", "est", "etic", "ful", "fy", "hood", "ial", "ian", "ible",
	"ic", "ical", "ing", "ion", "ious", "ise", "ish", "ism", "ist",
	"ite", "ity", "ive", "ize", "less", "let", "ling", "ly", "ment",
	"ness", "oid", "or", "ory", "ous", "ship", "sion", "some", "tion",
	"ture", "ty", "ure", "ward", "ware", "wise", "y",
].sort((a, b) => b.length - a.length); // longest first

// ---------------------------------------------------------------------------
// Main hyphenation entry point
// ---------------------------------------------------------------------------

/**
 * Attempt to split a single word into hyphenation points.
 * Returns an array of parts (e.g. ["ex", "ten", "sive"]),
 * or `[word]` when no hyphenation is possible.
 */
export function hyphenateWord(word: string): string[] {
	// Strip trailing punctuation for lookup
	const stripped = word.replace(/[.,;:!?"'""'--\-–—(){}[\]<>/\\@#$%^&*+=~`|]/g, "");
	if (stripped.length < 5) return [word];

	const lower = stripped.toLowerCase();

	// 1. Check exceptions dictionary
	const exception = HYPHEN_EXCEPTIONS[lower];
	if (exception) {
		// Map back to the original word (preserve capitalization)
		return mapExceptionToOriginal(word, stripped, exception);
	}

	// 2. Try known prefixes
	for (const prefix of PREFIXES) {
		if (lower.startsWith(prefix) && lower.length - prefix.length >= 3) {
			const splitAt = prefix.length;
			return [word.slice(0, splitAt), word.slice(splitAt)];
		}
	}

	// 3. Try known suffixes
	for (const suffix of SUFFIXES) {
		if (lower.endsWith(suffix) && lower.length - suffix.length >= 3) {
			const splitAt = lower.length - suffix.length;
			return [word.slice(0, splitAt), word.slice(splitAt)];
		}
	}

	// 4. Fallback: no hyphenation
	return [word];
}

/**
 * Apply hyphenation to a full paragraph text.
 * Inserts soft hyphens (­) at hyphenation points within words.
 */
export function hyphenateText(text: string): string {
	// Split on word boundaries (keep delimiters)
	return text.replace(/[^\s]+/g, (word) => {
		const parts = hyphenateWord(word);
		if (parts.length <= 1) return word;
		return parts.join("­");
	});
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map exception dictionary parts back to the original word, preserving
 * the original capitalization and any trailing punctuation.
 */
function mapExceptionToOriginal(
	original: string,
	stripped: string,
	exception: string[],
): string[] {
	const result: string[] = [];
	let pos = 0;
	for (const part of exception) {
		const match = original.slice(pos, pos + part.length);
		result.push(match);
		pos += part.length;
	}
	// Append any remaining punctuation that was stripped
	if (pos < original.length) {
		// Attach trailing punctuation to the last part
		result[result.length - 1] += original.slice(pos);
	}
	return result;
}

/**
 * Test whether a word should be hyphenated (for external use).
 */
export function canHyphenate(word: string): boolean {
	return hyphenateWord(word).length > 1;
}
