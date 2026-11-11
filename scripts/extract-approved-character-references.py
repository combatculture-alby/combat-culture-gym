#!/usr/bin/env python3
"""Extract candidate 48x64 character atlases from approved concept boards.

This tool is deliberately NON-DESTRUCTIVE: output goes to art-source/generated-preview.
Reference boards are NOT transparent atlases. Review previews before copying into src/assets.
Requires Pillow: python -m pip install Pillow
"""
from pathlib import Path
from PIL import Image
import argparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source' / 'approved-originals'
FILES = {
    'frank': 'Frank_ Combat Culture Gym Sprite Sheet.png',
    'radish': 'Radish Student Sprite Sheet(1).png',
    'marshall': 'Marshall Chibi Combat Character Sheet(1).png',
    'pudge': 'Pudge Student Sprite Sheet(1).png',
    'holly': 'Holly Approved (sheet says Erin).png',
    'gao': 'Gao’s Combat Gym Character Sheet(1).png',
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=ROOT / 'art-source' / 'generated-preview')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, filename in FILES.items():
        src = Image.open(SOURCE / filename).convert('RGB')
        # Preserve the whole labeled 4-direction animation section for manual
        # frame boundary inspection; no false assumption of clean sprite cells.
        # These normalized coordinates are specific to 1254x1254 concept boards.
        if src.size != (1254, 1254):
            raise ValueError(f'{filename}: expected 1254x1254, got {src.size}')
        region = src.crop((400, 100, 1220, 600))
        region.save(args.out / f'{name}-animation-reference.png')
        print(f'{name}: extracted animation reference; sprite segmentation requires review')
    print('No runtime assets modified.')

if __name__ == '__main__':
    main()
