#!/usr/bin/env python3
"""Generate the static still frames of the OctoBot animations (AB#3444).

`mm-octobot` (shared-ui) shows a still image instead of the animated WebP when the user prefers
reduced motion or the host forces stills. The still is the first frame of each animation, saved as
a small optimised PNG next to the WebP:

    projects/meshmakers/shared-ui/assets/octobot/{sm,md,lg}/octo_<animation>.webp      (source, copied)
    projects/meshmakers/shared-ui/assets/octobot/{sm,md,lg}/octo_<animation>_still.png (generated)

Usage (from src/frontend-libraries):

    python3 scripts/octobot/generate-octobot-stills.py

Requires Pillow (`pip install pillow`). The generated PNGs are committed; re-run the script only
when the WebPs change.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'projects' / 'meshmakers' / 'shared-ui' / 'assets' / 'octobot'
SIZES = ('sm', 'md', 'lg')
ANIMATIONS = ('idle', 'blink', 'look', 'swim', 'thinking', 'wave')


def main() -> None:
    for size in SIZES:
        for animation in ANIMATIONS:
            source = ROOT / size / f'octo_{animation}.webp'
            target = ROOT / size / f'octo_{animation}_still.png'
            with Image.open(source) as image:
                image.seek(0)
                frame = image.convert('RGBA')
                # Pixel art with a handful of colours: a palette PNG keeps it tiny and lossless.
                frame.quantize(colors=16, method=Image.Quantize.FASTOCTREE).save(target, optimize=True)
            print(f'{target.relative_to(ROOT)}: {target.stat().st_size} bytes')


if __name__ == '__main__':
    main()
