# Math Visualizer

Plain JS + Vite web components for stepping through formal proofs alongside Manim animations. Proof and definition data live in `data/`, built assets in `public/`.

## Beware

This project follows **Ad-Hoc Driven Development (AHDD™)**, it is a vibe-coded tool immediately applied to studying for end-of-semester exams. Hence the curriculum will be **tailor**ed (Taylor-expanded locally) to the MFF CUNI general mathematics program.

![vibe-coded](https://img.shields.io/badge/vibe--coded-during%20exams-critical)

## Install

```bash
npm install
```

## Dev

```bash
npm run dev          # watch proof/definition JSON, rebuild manifests, start Vite
npm run dev:plain    # just Vite (no text rebuild)
```

## Build

```bash
npm run build        # render proofs (Manim), bundle definitions, then Vite build
npm run build:text   # refresh manifests only (no video renders)
```

## Data layout

- Proof sources: `data/proofs/*.py` (+ optional `*.proof.json`)
- Definition entries: `data/definitions/*.json`
- Output manifests/clips: `public/proofs/manifest.json` and `public/definitions/manifest.json`

### Tagging definitions and proofs

You can add optional taxonomy metadata to any definition or proof JSON. Either use a nested `tags` object or place the fields at the root; the build scripts normalize both.

```json
{
  "term": "Sparse Matrix",
  "tags": {
    "subjects": ["Real Analysis"],
    "chapter": "1",
    "number": "3.5.4"
  }
}
```

Keys:
- `subjects`: array of subjects/disciplines (string or array accepted)
- `chapter`: chapter/section label (string or number)
- `number`: catalogue/numbering label (e.g., "3.5.4")

Manim must be installed for video renders (`npm run build:proofs`). Text-only edits don’t require Manim (`npm run build:text` or the dev watcher).***

## Acknowledgements & Solidarity

Huge thanks to [3Blue1Brown](https://www.youtube.com/@3blue1brown) and [ManimCommunity](https://manim.community/) for maintaining [Manim](https://manim.community/), which makes math concepts feel alive.

I also want to send support and best wishes to the community in light of the recent malicious attacks they’ve been dealing with. Open source edu projects are public goods, wishing you smooth recovery.
