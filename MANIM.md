# Manim build pipeline

This project renders Manim scenes at build time and exposes the resulting videos to the UI.

## Requirements

- Python 3
- [Manim Community](https://docs.manim.community/) installed in your environment (e.g. `pip install manim`)

## Workflow

1) Place your Manim `.py` files in `data/proofs/`. Every `Scene` subclass discovered in each file will be rendered. You can (and should) split proofs across multiple files as the library grows—one proof per file keeps things tidy.
2) Render videos:
   - Fast path (used by `npm run build`): `npm run build:proofs` (alias: `npm run render:manim`)
   - Custom quality or paths: `python3 scripts/render_manim.py --quality h` (options: `l`, `m`, `h`, `k`, plus `--src`/`--out`)
   - Text-only refresh (reuse existing videos): `npm run build:proofs:text` or `python3 scripts/render_manim.py --text-only`
3) Build the app: `npm run build` runs the renderer first and then `vite build`.

Outputs:

- Videos land in `public/proofs/*.mp4`.
- A manifest at `public/proofs/manifest.json` lists the generated clips; the web component reads this file at runtime.
- There are starter scenes at `data/proofs/demo_scene.py` and `data/proofs/limit_uniqueness_v2.py` you can render to validate your environment.
  - Both walk a uniqueness-of-limits proof; the second has slightly different pacing. Use them as templates for adding more files.

Notes:

- If there are no `.py` files, the renderer writes an empty manifest and exits without error.
- If `.py` files exist but Manim is missing, the render step fails so you know to install the dependency.
- Sections: call `self.next_section("Title")` inside your Manim `Scene` to mark steps. The renderer uses `--save_sections` and publishes each section clip plus the full video. The UI uses these sections to sync the formal proof text (left) and the animation playback (right) as you click through steps.
- The renderer filters out partial movie files; you should see one full clip per scene and a clip per declared section (not one per animation frame).
- If you hit a rendering error, try deleting the temp folder the renderer creates (`rm -rf public/proofs/.manim-tmp`) and rerun `npm run build:proofs`.

## Adding formal proof text for each scene (one file per proof scales best)

The UI can display scene-specific formal steps that you author in JSON files. Place one of the following next to your Manim source, then rerun `npm run build:proofs`:

- `data/proofs/<file>.proof.json` (applies to all scenes in the file, or use a `scenes` map)
- `data/proofs/<file>__<Scene>.proof.json` (scene-specific)
- `data/proofs/<Scene>.proof.json` (scene-specific)

Accepted shapes:

```json
{
  "title": "Uniqueness of Limits",
  "description": "Optional summary",
  "steps": [
    { "title": "Statement", "statement": "...", "justification": "...", "insight": "..." },
    { "title": "Contradiction setup", "statement": "...", "justification": "...", "insight": "..." }
  ]
}
```

Or a file-scoped map:

```json
{
  "scenes": {
    "MyScene": { "title": "My proof", "steps": [ ... ] },
    "AnotherScene": { "steps": [ ... ] }
  }
}
```

The manifest will embed the proof data per scene, and the web component will show those steps on the left while the matching section clips play on the right. If no proof file is found, the app falls back to a default example proof. Keeping one proof per `.py` file makes large libraries easier to manage.
