# Pretext Justify

Knuth-Plass optimal line-breaking for the Obsidian reading view. Replaces the browser's default word-wrap with typographically optimal paragraph layout.

## Features

| Feature | Description |
|---|---|
| Optimal line breaking | Shortest-path DP over feasible break candidates; minimizes accumulated paragraph badness |
| Hyphenation | Optional soft-hyphen insertion for more even spacing |
| Last-line handling | Last line left-aligned; overflow prevention via DP penalty |
| Resize responsiveness | Auto re-justifies on width change, throttled via rAF (2 paragraphs per frame) |
| Inline formatting | Preserves bold, italic, links, code — anything the reading view renders within a paragraph |
| Fully offline | All processing happens locally — no network requests, no telemetry, no analytics |

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

### Third-party code

This plugin bundles [@chenglou/pretext](https://github.com/chenglou/pretext) (MIT) for Canvas-based text measurement. See the [LICENSE](LICENSE) file for the full MIT terms.

## Configuration

| Setting | Default | Description |
|---|---|---|
| Hyphenation | On | Insert soft hyphens for more even spacing |
| Minimum spacing ratio | 0.50 | Lowest allowed word spacing as a fraction of normal space (0.30–0.90) |
| Tight penalty threshold | 0.75 | Fraction of normal space below which the algorithm penalizes tight lines (0.50–1.00) |
| Text cache size | 200 | Number of paragraphs cached to avoid remeasurement on resize (50–1000) |

## Compliance

- **No network access** — all processing is local to the device. No data is sent or received.
- **No telemetry** — no analytics, no crash reporting, no usage tracking of any kind.
- **No ads** — the plugin displays no advertisements.
- **No self-updating** — updates are handled exclusively through Obsidian's built-in plugin update mechanism.

## Development

```bash
git clone https://github.com/TYBLHQY/obsidian-pretext
cd obsidian-pretext
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/pretext-justify/`.

## License

MIT
