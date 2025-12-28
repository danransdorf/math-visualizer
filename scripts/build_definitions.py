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
from datetime import datetime
from pathlib import Path
from typing import Iterable

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

    items: list[dict] = []
    for path in files:
        items.extend(load_items_from_file(path))

    write_manifest(manifest_path, items, out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
