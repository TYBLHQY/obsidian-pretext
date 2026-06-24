---
name: release
description: >-
  Release workflow for the Pretext Justify Obsidian plugin. Create version tags,
  trigger the GitHub Actions release pipeline, and verify the published release.
  Trigger when asked to release, publish, cut a release, bump version, or create
  a GitHub release for this plugin.
---

# Release workflow — Pretext Justify

This project uses the [official Obsidian plugin release template](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions).

## Trigger a release

```bash
# Optional: bump version (updates manifest.json + versions.json)
npm version patch      # 1.0.0 → 1.0.1
npm version minor      # 1.0.0 → 1.1.0
npm version major      # 1.0.0 → 2.0.0

# Or manually edit manifest.json, then update versions.json:
# node version-bump.mjs  (reads version from package.json)

# Commit and push
git add manifest.json versions.json
git commit -m "chore: bump version to x.y.z"
git push origin main

# Tag and trigger release
git tag x.y.z
git push origin x.y.z
```

Push the tag — GitHub Actions automatically:
1. Checks out the repository
2. Installs dependencies (`npm install`)
3. Builds (`npm run build`)
4. Creates a GitHub Release with `main.js`, `manifest.json`, `styles.css`

## Verify

```bash
gh release view <tag> --repo TYBLHQY/obsidian-pretext --json tagName,name,url
gh run list --repo TYBLHQY/obsidian-pretext --limit 1
```

## Version management

| File | Role |
|------|------|
| `manifest.json` | Plugin version + minimum Obsidian version |
| `package.json` | npm version (must match manifest) |
| `versions.json` | Maps each plugin version → minAppVersion (for Obsidian's update system) |
| `version-bump.mjs` | Helper: syncs manifest.json + versions.json from package.json |

The `versions.json` file tells Obsidian which plugin version works with which Obsidian build.
When bumping `minAppVersion`, all previous version entries remain — only add the new one.

## Before release checklist

- [ ] `npm run build` passes
- [ ] `manifest.json` version matches `package.json` version
- [ ] `versions.json` has the new version entry
- [ ] CHANGES / README up to date (if needed)
- [ ] Changes tested in Obsidian (copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/pretext-justify/`)
