#!/usr/bin/env python3
"""Crop a real photo into a square room avatar.

Usage: python make-avatar.py <source-image> <output.jpg> [--top 0.08]

The room masks portraits into a circle, so a clean head-and-shoulders square is
enough. This is the fallback when no kie.ai key is available; the full cartoon
pipeline still wins when it runs.
"""
import sys

from PIL import Image, ImageOps


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: make-avatar.py <source> <output> [--top 0.08]", file=sys.stderr)
        return 2
    source, output = sys.argv[1], sys.argv[2]
    top_bias = 0.08
    if "--top" in sys.argv:
        try:
            top_bias = float(sys.argv[sys.argv.index("--top") + 1])
        except (IndexError, ValueError):
            pass

    image = Image.open(source).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = int(max(0, height - side) * top_bias)
    image = image.crop((left, top, left + side, top + side))
    image = ImageOps.fit(image, (512, 512), Image.LANCZOS)
    image.save(output, "JPEG", quality=88, optimize=True)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
