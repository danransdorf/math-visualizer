#!/usr/bin/env python3
"""
Render all Manim scenes found in the data/proofs folder and write a manifest the app can consume.

Usage:
  python scripts/render_manim.py
  python scripts/render_manim.py --src path/to/data/proofs --out public/proofs --quality m
"""

from __future__ import annotations

import argparse
import importlib.util
import inspect
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def manim_available() -> bool:
    return importlib.util.find_spec("manim") is not None


def discover_scenes(file_path: Path) -> list[str]:
    """Return Scene subclass names defined in the given file."""
    spec = importlib.util.spec_from_file_location(file_path.stem, file_path)
    if spec is None or spec.loader is None:
        return []

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    from manim import Scene

    scenes = []
    for _, cls in inspect.getmembers(module, inspect.isclass):
        if (
            issubclass(cls, Scene)
            and cls is not Scene
            and cls.__module__ == module.__name__
        ):
            scenes.append(cls.__name__)
    return scenes


def render_scene(file_path: Path, scene_name: str, out_dir: Path, quality: str) -> tuple[Path, list[dict]]:
    """
    Render a single scene to MP4 (including section files) and return the destination of the main clip
    plus a list of section metadata dictionaries.
    The MP4 is moved into out_dir with a predictable name.
    """
    temp_media = out_dir / ".manim-tmp"
    if temp_media.exists():
        shutil.rmtree(temp_media, ignore_errors=True)
    temp_media.mkdir(parents=True, exist_ok=True)
    (temp_media / "videos").mkdir(parents=True, exist_ok=True)

    output_file = f"{file_path.stem}__{scene_name}"

    # Pre-create the sections output folder Manim expects, e.g. .manim-tmp/videos/<module>/<quality>/sections
    quality_folder = quality_to_folder(quality)
    sections_dir = temp_media / "videos" / file_path.stem / quality_folder / "sections"
    sections_dir.mkdir(parents=True, exist_ok=True)

    before = set(temp_media.rglob("*.mp4"))
    cmd = [
        sys.executable,
        "-m",
        "manim",
        str(file_path),
        scene_name,
        f"-q{quality}",
        "--disable_caching",
        "--media_dir",
        str(temp_media),
        "--output_file",
        output_file,
        "--format",
        "mp4",
        "--save_sections",
    ]

    print(f"[manim] Rendering {file_path.name}:{scene_name} ...")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise RuntimeError(
            f"Manim exited with code {result.returncode}. "
            f"Check logs above; temp media at {temp_media}."
        )

    after = set(temp_media.rglob("*.mp4"))
    new_files = sorted(after - before)

    produced = None
    section_files = []
    for path in new_files:
        if path.stem == output_file:
            produced = path
        elif "sections" in path.parts or "section" in path.stem.lower():
            section_files.append(path)
        else:
            # Ignore partial movie files or other intermediates.
            continue

    if produced is None:
        raise FileNotFoundError(f"Could not locate rendered video for {scene_name}")

    dest = out_dir / f"{output_file}.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(produced), dest)

    saved_sections = []
    if section_files:
        sections_dir = out_dir / "sections"
        sections_dir.mkdir(parents=True, exist_ok=True)
        for idx, section_path in enumerate(sorted(section_files)):
            section_label = section_path.stem
            human_name = _humanize_section(section_label, idx)
            section_dest = sections_dir / f"{output_file}__{section_label}.mp4"
            shutil.move(str(section_path), section_dest)
            saved_sections.append(
                {
                    "index": idx,
                    "id": f"{output_file}__{section_label}",
                    "name": human_name,
                    "description": human_name,
                    "file": section_dest.relative_to(out_dir.parent).as_posix(),
                    "url": "/" + section_dest.relative_to(out_dir.parent).as_posix(),
                }
            )

    return dest, saved_sections


def extract_proof_from_payload(payload: object, scene_name: str) -> dict | None:
    """
    Acceptable proof payloads:
    - { "steps": [...] }
    - { "title": "...", "description": "...", "steps": [...] }
    - { "scenes": { "<SceneName>": { ...same shape... } } }
    - [ ...steps ] (list by itself)
    """
    if isinstance(payload, list):
        return {"steps": payload}
    if not isinstance(payload, dict):
        return None

    if "scenes" in payload and isinstance(payload["scenes"], dict):
        scene_payload = payload["scenes"].get(scene_name)
        if isinstance(scene_payload, list):
            return {"steps": scene_payload}
        if isinstance(scene_payload, dict):
            return scene_payload

    if "steps" in payload and isinstance(payload["steps"], list):
        return payload

    return None


def load_proof_data(file_path: Path, scene_name: str) -> dict | None:
    """
    Look for proof JSON files near the scene:
      - data/proofs/<file>.proof.json (shared or per-scene map)
      - data/proofs/<file>__<scene>.proof.json (scene-specific)
      - data/proofs/<scene>.proof.json (scene-specific)
    """
    candidates = [
        file_path.with_suffix(".proof.json"),
        file_path.parent / f"{file_path.stem}__{scene_name}.proof.json",
        file_path.parent / f"{scene_name}.proof.json",
    ]

    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            payload = json.loads(candidate.read_text())
            proof = extract_proof_from_payload(payload, scene_name)
            if proof:
                proof["source"] = str(candidate.relative_to(PROJECT_ROOT))
                return proof
        except Exception as exc:  # noqa: BLE001
            print(f"[manim] Skipped proof file {candidate}: {exc}", file=sys.stderr)
            continue
    return None


def _humanize_section(stem: str, index: int) -> str:
    # Manim typically names sections like "section_0", "section_base_case", etc.
    cleaned = stem.replace("/", " ").replace("\\", " ")
    if cleaned.startswith("section_"):
        cleaned = cleaned[len("section_") :]
    cleaned = re.sub(r"[_\\-]+", " ", cleaned).strip()
    cleaned = cleaned if cleaned else f"Section {index + 1}"
    cleaned = cleaned.title()
    return cleaned


def quality_to_folder(flag: str) -> str:
    return {
        "l": "480p15",
        "m": "720p30",
        "h": "1080p60",
        "k": "2160p60",
    }.get(flag, "720p30")


def write_manifest(manifest_path: Path, items: list[dict], out_dir: Path) -> None:
    manifest = {"generatedAt": datetime.now().isoformat(), "items": items}
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2))
    try:
        display_path = manifest_path.relative_to(out_dir.parent)
    except ValueError:
        display_path = manifest_path
    print(f"[manim] Wrote manifest to {display_path}")


def refresh_text_only(manifest_path: Path, out_dir: Path, src_dir: Path) -> int:
    """
    Reload proof JSON for each item in an existing manifest without re-rendering videos.
    """
    if not manifest_path.exists():
        print(f"[manim] Text-only refresh skipped: manifest not found at {manifest_path}")
        return 0

    try:
        payload = json.loads(manifest_path.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[manim] Could not read manifest for text-only refresh: {exc}", file=sys.stderr)
        return 1

    items = payload.get("items", [])
    if not isinstance(items, list):
        print("[manim] Manifest items are not a list; aborting text-only refresh.", file=sys.stderr)
        return 1

    updated: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        new_item = dict(item)
        source_rel = item.get("source")
        scene_name = item.get("scene")
        if not source_rel or not scene_name:
            updated.append(new_item)
            continue
        source_path = (PROJECT_ROOT / source_rel).resolve()
        if not source_path.exists():
            print(f"[manim] Source file missing for {scene_name}: {source_path}", file=sys.stderr)
            updated.append(new_item)
            continue
        proof = load_proof_data(source_path, scene_name)
        if proof:
            new_item["proof"] = proof
        updated.append(new_item)

    write_manifest(manifest_path, updated, out_dir)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Render Manim animations to MP4.")
    parser.add_argument(
        "--src",
        type=Path,
        default=PROJECT_ROOT / "data" / "proofs",
        help="Folder containing .py files with Manim scenes.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=PROJECT_ROOT / "public" / "proofs",
        help="Output folder for rendered videos and manifest.json.",
    )
    parser.add_argument(
        "--quality",
        choices=["l", "m", "h", "k"],
        default="m",
        help="Quality flag passed to Manim (-ql, -qm, -qh, -qk).",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Override manifest path (defaults to OUT/manifest.json).",
    )
    parser.add_argument(
        "--text-only",
        action="store_true",
        help="Skip rendering videos; refresh proof text in the existing manifest using current JSON files.",
    )

    args = parser.parse_args()
    src_dir: Path = args.src
    out_dir: Path = args.out
    manifest_path: Path = args.manifest or (out_dir / "manifest.json")

    if args.text_only:
        return refresh_text_only(manifest_path, out_dir, src_dir)

    if not src_dir.exists():
        print(f"[manim] Skipping render: missing source folder {src_dir}")
        write_manifest(manifest_path, [], out_dir)
        return 0

    py_files = sorted(src_dir.glob("*.py"))
    if not py_files:
        print(f"[manim] No .py files found in {src_dir}, nothing to render.")
        write_manifest(manifest_path, [], out_dir)
        return 0

    if not manim_available():
        print(
            "[manim] Manim is not installed. Install it with `pip install manim` "
            "and rerun the build.",
            file=sys.stderr,
        )
        return 1

    manifest_items: list[dict] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    temp_media = out_dir / ".manim-tmp"

    had_errors = False

    for file_path in py_files:
        scenes = discover_scenes(file_path)
        if not scenes:
            print(f"[manim] No Scene subclasses discovered in {file_path.name}, skipping.")
            continue

        for scene_name in scenes:
            try:
                video_path, sections = render_scene(file_path, scene_name, out_dir, args.quality)
                proof = load_proof_data(file_path, scene_name)
                public_url = "/" + video_path.relative_to(out_dir.parent).as_posix()
                manifest_items.append(
                    {
                        "id": f"{file_path.stem}__{scene_name}",
                        "scene": scene_name,
                        "source": file_path.relative_to(PROJECT_ROOT).as_posix(),
                        "file": video_path.relative_to(out_dir.parent).as_posix(),
                        "url": public_url,
                        "quality": args.quality,
                        "sections": sections,
                        "proof": proof,
                    }
                )
            except Exception as exc:  # noqa: BLE001
                print(
                    f"[manim] Failed to render {file_path.name}:{scene_name} -> {exc}",
                    file=sys.stderr,
                )
                had_errors = True

    if manifest_items:
        print(f"[manim] Rendered {len(manifest_items)} video(s).")
    else:
        print("[manim] Completed without rendered videos.")

    write_manifest(manifest_path, manifest_items, out_dir)

    if temp_media.exists() and not had_errors:
        shutil.rmtree(temp_media, ignore_errors=True)

    return 1 if had_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
