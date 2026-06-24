# Pretext Justify

Knuth-Plass optimal line-breaking for the Obsidian reading view. Replaces the browser's default word-wrap with typographically optimal paragraph layout.

## Quick Start

1. Install the plugin from Community Plugins in Obsidian (search "Pretext Justify").
2. Toggle **Enable justification** in the plugin settings (enabled by default).
3. Open any note in reading view — paragraphs re-render with optimal line breaks.

## Features

| Feature | Description |
|---|---|
| Optimal line breaking | Shortest-path DP over feasible break candidates; minimizes accumulated paragraph badness |
| Hyphenation | Optional soft-hyphen insertion for more even spacing |
| Last-line handling | Last line left-aligned; overflow prevention via DP penalty |
| Resize responsiveness | Auto re-justifies on width change, throttled via rAF (2 paragraphs per frame) |
| Inline formatting | Preserves bold, italic, links, code — anything the reading view renders within a paragraph |
| Settings | Toggle, hyphenation, minimum spacing ratio, tight penalty threshold |

## How it works

The plugin uses a dynamic programming algorithm developed by Donald Knuth and Michael Plass for TeX. It enumerates all feasible break positions (word boundaries and soft hyphens), builds a graph where each edge is weighted by a "badness" cost, and finds the shortest path through:

```
dp[j] = min over i<j of dp[i] + badness(i, j)
```

The badness function combines:

- **Cubic stretch/shrink ratio** — the core Knuth cost, proportional to |ratio|³
- **River penalty** — heavy cost when inter-word spacing exceeds 150% of normal, preventing visual "rivers" of white space
- **Tight penalty** — cost when spacing drops below the configured threshold, avoiding cramped lines
- **Hyphen penalty** — small constant that prefers natural word breaks over hyphenated ones

For the last line, the algorithm penalizes break choices whose natural width (word text + normal spaces) exceeds the container, favoring solutions where the last line fits without compression.

The plugin uses [Pretext](https://github.com/chenglou/pretext) for text measurement via Canvas API, and preserves DOM structure by extracting character ranges from a clone of the original paragraph — inline formatting survives the transformation.

## Configuration

| Setting | Default | Description |
|---|---|---|
| Enable justification | On | Master toggle |
| Hyphenation | On | Insert soft hyphens for more even spacing |
| Minimum spacing ratio | 0.50 | Lowest allowed word spacing as a fraction of normal space (0.30–0.90) |
| Tight penalty threshold | 0.75 | Fraction of normal space below which the algorithm penalizes tight lines (0.50–1.00) |

## Development

```bash
git clone https://github.com/your-username/obsidian-pretext-justify
cd obsidian-pretext-justify
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/pretext-justify/`.

## License

MIT
