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


def _as_list(value) -> list[str]:
    """Normalize a string/iterable into a list of trimmed, non-empty strings."""
    if not value:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    try:
        iterator = iter(value)
    except TypeError:
        return []
    items: list[str] = []
    for item in iterator:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            items.append(text)
    return items


def normalize_tags(entry: dict | None) -> dict:
    """
    Collect optional taxonomy metadata for a proof or manifest item.

    Supported inputs (all optional):
      - tags: { subjects, chapter, number/numbering }
      - subjects/subject at the root
      - chapter at the root
      - number/numbering/label at the root
    """
    if not entry or not isinstance(entry, dict):
        return {}

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


def normalize_claims(payload: dict | None) -> list[dict]:
    """
    Normalize claim entries so multiple proofs can live under one theorem.

    Supported fields per claim (all optional):
      - id: stable identifier, defaults to letters (a), (b), ...
      - label: display label, defaults to f"({id})"
      - scene/animation/variant: name of the Manim Scene that visualizes this claim
      - statement: text of the specific claim
      - steps: proof steps for the claim
    """
    if not payload or not isinstance(payload, dict):
        return []
    raw_claims = payload.get("claims")
    if not isinstance(raw_claims, list):
        return []

    claims: list[dict] = []
    for idx, entry in enumerate(raw_claims):
        if not isinstance(entry, dict):
            continue
        claim_id = str(
            entry.get("id")
            or entry.get("label")
            or chr(ord("a") + idx)
        ).strip()
        if not claim_id:
            claim_id = chr(ord("a") + idx)
        label = entry.get("label") or f"({claim_id})"
        steps = entry.get("steps")
        normalized = {
            "id": claim_id,
            "label": label,
            "scene": entry.get("scene") or entry.get("animation") or entry.get("variant"),
            "statement": entry.get("statement") or "",
            "steps": steps if isinstance(steps, list) else [],
        }
        claims.append(normalized)
    return claims


def load_proof_payload(file_path: Path) -> tuple[dict | None, Path | None]:
    """
    Load the first matching proof JSON payload for the given Manim file.
    """
    candidates = [
        file_path.with_suffix(".proof.json"),
        file_path.parent / f"{file_path.stem}.proof.json",
    ]

    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            payload = json.loads(candidate.read_text())
            return payload, candidate
        except Exception as exc:  # noqa: BLE001
            print(f"[manim] Failed to read proof file {candidate}: {exc}", file=sys.stderr)
    return None, None


def pick_claim_for_scene(claims: list[dict], scene_name: str, scene_index: int) -> dict | None:
    """
    Choose the best matching claim for the given Scene.
    Priority:
      1) Explicit scene/animation match
      2) Claim id matches scene name
      3) Claim in the same positional order as the scene
    """
    for claim in claims:
        if not isinstance(claim, dict):
            continue
        scene_ref = (claim.get("scene") or "").strip()
        if scene_ref and scene_ref == scene_name:
            return claim
    for claim in claims:
        cid = str(claim.get("id") or "").strip()
        if cid and cid == scene_name:
            return claim
    if 0 <= scene_index < len(claims):
        return claims[scene_index]
    return claims[0] if claims else None


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
                tags = normalize_tags(proof)
                if tags:
                    proof["tags"] = tags
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
    grouped: dict[str, list[dict]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        src = item.get("source")
        grouped.setdefault(src, []).append(item)

    for source_rel, group_items in grouped.items():
        if not source_rel:
            updated.extend(group_items)
            continue
        source_path = (PROJECT_ROOT / source_rel).resolve()
        if not source_path.exists():
            print(f"[manim] Source file missing: {source_path}", file=sys.stderr)
            updated.extend(group_items)
            continue

        proof_payload, proof_source_path = load_proof_payload(source_path)
        claims = normalize_claims(proof_payload)
        theorem_id = (
            str(proof_payload.get("id")).strip()
            if isinstance(proof_payload, dict) and proof_payload.get("id")
            else (
                str(proof_payload.get("tags", {}).get("number")).strip()
                if isinstance(proof_payload, dict)
                else ""
            )
        ) or source_path.stem

        for scene_index, item in enumerate(group_items):
            if not isinstance(item, dict):
                continue
            new_item = dict(item)
            scene_name = item.get("scene")
            proof_for_scene = extract_proof_from_payload(proof_payload, scene_name) if proof_payload else None
            selected_claim = pick_claim_for_scene(claims, scene_name, scene_index)
            steps = []
            if selected_claim and isinstance(selected_claim.get("steps"), list):
                steps = selected_claim["steps"]
            elif proof_for_scene and isinstance(proof_for_scene.get("steps"), list):
                steps = proof_for_scene["steps"]

            proof = {
                "title": (proof_for_scene or {}).get("title") or (proof_payload or {}).get("title"),
                "description": (proof_for_scene or {}).get("description") or (proof_payload or {}).get("description"),
                "statement": (proof_for_scene or {}).get("statement") or (proof_payload or {}).get("statement") or "",
                "steps": steps,
                "claims": [
                    {
                        "id": claim.get("id"),
                        "label": claim.get("label"),
                        "scene": claim.get("scene"),
                        "statement": claim.get("statement"),
                    }
                    for claim in claims
                ] or [{"id": "main", "label": "main"}],
                "activeClaimId": (selected_claim or {}).get("id", "main"),
                "theoremId": theorem_id,
            }

            new_item["proof"] = proof
            new_item["theoremId"] = theorem_id
            if proof_source_path:
                new_item["proofSource"] = proof_source_path.relative_to(PROJECT_ROOT).as_posix()
            tags = normalize_tags(proof)
            if tags:
                new_item["tags"] = tags
            updated.append(new_item)

    updated = attach_claim_animation_links(updated)
    write_manifest(manifest_path, updated, out_dir)
    return 0


def attach_claim_animation_links(items: list[dict]) -> list[dict]:
    """
    For each theorem (grouped by theoremId), attach animation IDs to claims and
    ensure every item carries the full claim list.
    """
    grouped: dict[str, list[dict]] = {}
    for item in items:
        theorem_id = (
            item.get("theoremId")
            or (item.get("proof") or {}).get("theoremId")
            or item.get("id")
        )
        grouped.setdefault(theorem_id, []).append(item)

    for group_items in grouped.values():
        claim_map: dict[str, dict] = {}

        # Collect claim metadata across variants.
        for item in group_items:
            proof = item.get("proof") or {}
            claims = proof.get("claims") or []
            if not claims:
                active_id = proof.get("activeClaimId") or "main"
                claims = [{"id": active_id, "label": active_id}]
            for claim in claims:
                cid = str(claim.get("id") or "main")
                stored = claim_map.setdefault(cid, {"id": cid})
                for key in ("label", "statement", "scene"):
                    if claim.get(key) and not stored.get(key):
                        stored[key] = claim[key]

        # Attach animation IDs for the claim that this item renders.
        for item in group_items:
            proof = item.get("proof") or {}
            active_id = str(proof.get("activeClaimId") or "main")
            entry = claim_map.setdefault(active_id, {"id": active_id})
            entry.setdefault("label", f"({active_id})")
            entry["animationId"] = item.get("id")

        claims_list = sorted(claim_map.values(), key=lambda c: c.get("id", ""))
        for item in group_items:
            proof = item.get("proof") or {}
            proof["claims"] = claims_list
            item["proof"] = proof

    return items


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
        proof_payload, proof_source_path = load_proof_payload(file_path)
        claims = normalize_claims(proof_payload)
        theorem_id = (
            str(proof_payload.get("id")).strip()
            if isinstance(proof_payload, dict) and proof_payload.get("id")
            else (
                str(proof_payload.get("tags", {}).get("number")).strip()
                if isinstance(proof_payload, dict)
                else ""
            )
        ) or file_path.stem

        scenes = discover_scenes(file_path)
        if not scenes:
            print(f"[manim] No Scene subclasses discovered in {file_path.name}, skipping.")
            continue

        for scene_index, scene_name in enumerate(scenes):
            try:
                video_path, sections = render_scene(file_path, scene_name, out_dir, args.quality)
                proof_for_scene = extract_proof_from_payload(proof_payload, scene_name) if proof_payload else None
                selected_claim = pick_claim_for_scene(claims, scene_name, scene_index)
                steps = []
                if selected_claim and isinstance(selected_claim.get("steps"), list):
                    steps = selected_claim["steps"]
                elif proof_for_scene and isinstance(proof_for_scene.get("steps"), list):
                    steps = proof_for_scene["steps"]

                proof = {
                    "title": (proof_for_scene or {}).get("title") or (proof_payload or {}).get("title"),
                    "description": (proof_for_scene or {}).get("description") or (proof_payload or {}).get("description"),
                    "statement": (proof_for_scene or {}).get("statement") or (proof_payload or {}).get("statement") or "",
                    "steps": steps,
                    "claims": [
                        {
                            "id": claim.get("id"),
                            "label": claim.get("label"),
                            "scene": claim.get("scene"),
                            "statement": claim.get("statement"),
                        }
                        for claim in claims
                    ] or [{"id": "main", "label": "main"}],
                    "activeClaimId": (selected_claim or {}).get("id", "main"),
                    "theoremId": theorem_id,
                }
                public_url = "/" + video_path.relative_to(out_dir.parent).as_posix()
                tags = normalize_tags(proof)
                item = {
                    "id": f"{file_path.stem}__{scene_name}",
                    "scene": scene_name,
                    "source": file_path.relative_to(PROJECT_ROOT).as_posix(),
                    "file": video_path.relative_to(out_dir.parent).as_posix(),
                    "url": public_url,
                    "quality": args.quality,
                    "sections": sections,
                    "proof": proof,
                    "theoremId": theorem_id,
                }
                if proof_source_path:
                    item["proofSource"] = proof_source_path.relative_to(PROJECT_ROOT).as_posix()
                if tags:
                    item["tags"] = tags
                manifest_items.append(item)
            except Exception as exc:  # noqa: BLE001
                print(
                    f"[manim] Failed to render {file_path.name}:{scene_name} -> {exc}",
                    file=sys.stderr,
                )
                had_errors = True

    manifest_items = attach_claim_animation_links(manifest_items)

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
