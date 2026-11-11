# Approved artwork integration audit (Levels 1–2)

Status: **source files uploaded; runtime conversion and visual QA pending**.

## Verified reference inventory

- 19 PNGs in `art-source/approved-originals/`, plus `manifest.json`.
- `Holly Approved (sheet says Erin).png` and `Erin Student Pixel Sprite Sheet(1).png` have the same Git blob SHA. The game character is **Holly**.
- `Player Coach Approved.png` and `ChatGPT Image Nov 10, 2026, 11_04_58 PM.png` are the same source image.
- The original archive contained multiple **different** Frank reference boards. Only `Frank_ Combat Culture Gym Sprite Sheet.png` is retained in the approved-originals directory; do not assume all versions were byte-identical.

## Critical distinction: concept board versus runtime atlas

The approved student boards (Frank, Radish, Marshall, Pudge, Holly, Gao) are 1254 × 1254 PNGs containing a portrait, directional pose examples, action poses, expressions, text labels, and a dark graphic background. They are **not** 12-column × 3-row transparent atlases with 48 × 64 cells. Loading them with the existing `registerCharacterArt` coordinates would sample labels/background, not correctly isolated sprites.

Likewise, the garage, equipment, maintenance, Level 2, banner, and tileset images are illustrated asset boards. Their individual objects must be isolated, have backgrounds removed as necessary, and be scaled consistently before replacing game assets.

## Existing runtime contract (preserve gameplay)

- `src/characterArt.ts` loads `src/assets/{frank,radish,marshall,pudge,holly,gao}.png` as 48 × 64 transparent cells, arranged in 12 columns and 3 rows.
- `src/assets/atlas-layout.json` documents direction order `down,left,right,up`; `src/characterArt.ts` currently registers `down,right,left,up`. **Do not swap this without inspecting the generated transparent atlas visually.**
- `src/hubArt.ts` uses already-cropped `hub-atlas.png`, `hub-level2-atlas.png`, and `hub-services.png` with explicit pixel rectangles. Do not substitute full source boards for these.
- Keep game logic, save state, NPC interactions, and scene transitions unchanged during art replacement.

## Integration acceptance checklist

1. Extract approved character frames from the reference boards into transparent, consistently aligned atlas cells.
2. Verify each character's left/right directions and walk cycles visually before changing metadata.
3. Crop Level 1/2 equipment and service assets; add visible state variants (trash bin, equipment wear, water, supplies).
4. Replace legacy art **only after** the new frame assets are generated and dimensions validated.
5. Run `npm test`, `npm run build`, and browser smoke tests; then visually inspect Levels 1 and 2 before deploying.

This document is an audit, not a claim that game art has been replaced or deployed.
