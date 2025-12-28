#!/usr/bin/env python3
"""
Aggregate definition JSON files from data/definitions into a manifest the app can consume.

Each source file may be:
- a single object representing one definition
- an array of definition objects
- an object with an "items" array of definition objects

Each definition object should include at least:
  - term: display name
  - definition: description text
Optional fields:
  - id, notation, alsoKnownAs, example, animation (url/file/quality/sections)

If id is missing, one is derived from the filename plus index.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from render_manim import _humanize_section, discover_scenes, manim_available, render_scene

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _as_list(value) -> list[str]:
    """Normalize a string/iterable into a list of trimmed, non-empty strings."""
    if not value:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, Iterable):
        items: list[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                items.append(text)
        return items
    return []


def normalize_tags(entry: dict) -> dict:
    """
    Collect optional taxonomy metadata for a definition.

    Supported inputs (all optional):
      - tags: { subjects, chapter, number/numbering }
      - subjects/subject at the root
      - chapter at the root
      - number/numbering/label at the root
    """
    tags = entry.get("tags", {}) if isinstance(entry, dict) else {}
    tags_dict = tags if isinstance(tags, dict) else {}

    subjects = (
        tags_dict.get("subjects")
        or tags_dict.get("subject")
        or entry.get("subjects")
        or entry.get("subject")
    )
    chapter = tags_dict.get("chapter") or entry.get("chapter")
    number = (
        tags_dict.get("number")
        or tags_dict.get("numbering")
        or entry.get("number")
        or entry.get("numbering")
        or entry.get("label")
    )

    normalized = {}
    subject_list = _as_list(subjects)
    if subject_list:
        normalized["subjects"] = list(dict.fromkeys(subject_list))  # dedupe, keep order
    if chapter is not None:
        chapter_str = str(chapter).strip()
        if chapter_str:
            normalized["chapter"] = chapter_str
    if number is not None:
        number_str = str(number).strip()
        if number_str:
            normalized["number"] = number_str
    return normalized


def load_items_from_file(path: Path) -> list[dict]:
    try:
        payload = json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[definitions] Skipped {path}: {exc}")
        return []

    if isinstance(payload, dict) and "items" in payload and isinstance(payload["items"], list):
        items = payload["items"]
    elif isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = [payload]
    else:
        return []

    normalized: list[dict] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        entry = dict(item)
        if "id" not in entry or not entry["id"]:
            entry["id"] = f"{path.stem}__{idx}"
        if "term" not in entry or not entry["term"]:
            entry["term"] = entry.get("title", "Definition")
        animation = entry.get("animation")
        if isinstance(animation, dict):
            if "url" not in animation and animation.get("file"):
                animation["url"] = "/" + str(animation["file"]).lstrip("/")
            sections = animation.get("sections")
            if isinstance(sections, list):
                for section in sections:
                    if isinstance(section, dict) and "url" not in section and section.get("file"):
                        section["url"] = "/" + str(section["file"]).lstrip("/")
        tags = normalize_tags(entry)
        if tags:
            entry["tags"] = tags
        normalized.append(entry)
    return normalized


def write_manifest(manifest_path: Path, items: Iterable[dict], out_dir: Path) -> None:
    manifest = {"generatedAt": datetime.now().isoformat(), "items": list(items)}
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2))
    try:
        display_path = manifest_path.relative_to(out_dir.parent)
    except ValueError:
        display_path = manifest_path
    print(f"[definitions] Wrote manifest to {display_path}")


def load_existing_manifest(manifest_path: Path) -> dict[str, dict]:
    """Reuse animation metadata from a previous manifest so dev builds keep links."""
    if not manifest_path.exists():
        return {}
    try:
        payload = json.loads(manifest_path.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[definitions] Skipped existing manifest {manifest_path}: {exc}")
        return {}

    items = payload.get("items")
    if not isinstance(items, list):
        return {}

    animations: dict[str, dict] = {}
    for entry in items:
        if not isinstance(entry, dict):
            continue
        anim = entry.get("animation")
        def_id = entry.get("id")
        if anim and def_id:
            animations[str(def_id)] = anim
    if animations:
        print(f"[definitions] Reusing animation metadata for {len(animations)} definition(s).")
    return animations


def render_definition_animations(src_dir: Path, out_dir: Path, quality: str) -> tuple[dict[str, dict], bool]:
    """
    Render Manim scenes for definition files placed in data/definitions.

    Rules:
    - For each <id>.py file in src_dir, render every Scene subclass.
    - Output goes under public/definitions (mirrors proof output for UI consistency).
    - Returns (animations, had_errors). animations is { id: { url, quality, sections, name } } for the first scene
      in the file. Additional scenes are exposed as sections.
    """

    if not src_dir.exists():
        return {}

    if not manim_available():
        print("[definitions] Manim not installed; skipping definition animations.")
        return {}, True

    out_dir.mkdir(parents=True, exist_ok=True)
    temp_media = out_dir / ".manim-tmp"

    results: dict[str, dict] = {}
    had_errors = False
    py_files = sorted(src_dir.glob("*.py"))
    for file_path in py_files:
        scenes = discover_scenes(file_path)
        if not scenes:
            print(f"[definitions] No Scene subclasses in {file_path.name}, skipping.")
            continue

        main_clip = None
        section_entries: list[dict] = []

        for idx, scene_name in enumerate(scenes):
            try:
                video_path, sections = render_scene(file_path, scene_name, out_dir, quality)
            except Exception as exc:  # noqa: BLE001
                print(f"[definitions] Failed to render {file_path.name}:{scene_name}: {exc}")
                had_errors = True
                continue

            public_url = "/" + video_path.relative_to(out_dir.parent).as_posix()
            if idx == 0:
                main_clip = {
                    "url": public_url,
                    "file": video_path.relative_to(out_dir.parent).as_posix(),
                    "quality": quality,
                    "name": _humanize_section(scene_name, idx),
                }
            # Treat each scene after the first as a section; also include Manim's own sections
            section_entries.append(
                {
                    "index": idx,
                    "id": f"{file_path.stem}__{scene_name}",
                    "name": _humanize_section(scene_name, idx),
                    "description": _humanize_section(scene_name, idx),
                    "file": video_path.relative_to(out_dir.parent).as_posix(),
                    "url": public_url,
                }
            )
            # Append saved sections from render_scene (per-Scene sections)
            for sec in sections:
                section_entries.append(sec)

        if main_clip:
            results[file_path.stem] = {
                **main_clip,
                "sections": sorted(section_entries, key=lambda s: s.get("index", 0)),
            }

    if temp_media.exists():
        shutil.rmtree(temp_media, ignore_errors=True)

    return results, had_errors


def attach_definition_animation(def_entry: dict, animations: dict[str, dict], *, force: bool = False) -> dict:
    """Attach rendered animation metadata to a definition entry if available."""
    if not isinstance(def_entry, dict):
        return def_entry
    entry = dict(def_entry)
    def_id = str(entry.get("id") or "")
    anim = animations.get(def_id)
    if anim and (force or "animation" not in entry or not entry.get("animation")):
        entry["animation"] = anim
    return entry


def main() -> int:
    parser = argparse.ArgumentParser(description="Bundle definition JSON files into a manifest.")
    parser.add_argument(
        "--src",
        type=Path,
        default=PROJECT_ROOT / "data" / "definitions",
        help="Folder containing definition JSON files.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=PROJECT_ROOT / "public" / "definitions",
        help="Output folder for definitions manifest.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Override manifest path (defaults to OUT/manifest.json).",
    )

    parser.add_argument(
        "--render-animations",
        action="store_true",
        help="Render Manim animations for definition .py files in the source folder.",
    )
    parser.add_argument(
        "--quality",
        choices=["l", "m", "h", "k"],
        default="m",
        help="Quality flag for definition animations (-ql, -qm, -qh, -qk).",
    )

    args = parser.parse_args()
    src_dir: Path = args.src
    out_dir: Path = args.out
    manifest_path: Path = args.manifest or (out_dir / "manifest.json")

    if not src_dir.exists():
        print(f"[definitions] Missing source folder {src_dir}, writing empty manifest.")
        write_manifest(manifest_path, [], out_dir)
        return 0

    files = sorted(src_dir.glob("*.json"))
    if not files:
        print(f"[definitions] No JSON files found in {src_dir}, writing empty manifest.")
        write_manifest(manifest_path, [], out_dir)
        return 0

    animations: dict[str, dict] = {}
    render_errors = False
    existing_manifest_anims = load_existing_manifest(manifest_path)
    animations.update(existing_manifest_anims)

    force_attach = False
    if args.render_animations:
        if not manim_available():
            print(
                "[definitions] Manim is not installed. Install it with `pip install manim` and rerun the build.",
                file=sys.stderr,
            )
            return 1
        freshly_rendered, render_errors = render_definition_animations(src_dir, out_dir, args.quality)
        animations.update(freshly_rendered)
        force_attach = True

    items: list[dict] = []
    for path in files:
        raw_items = load_items_from_file(path)
        for item in raw_items:
            items.append(attach_definition_animation(item, animations, force=force_attach))

    write_manifest(manifest_path, items, out_dir)
    return 1 if render_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
