# Approved art audit: Levels 1 and 2

Scope: Levels 1 and 2 only. Preserve working gameplay code. **Do not use previous-build artwork as the final visual source.**

## Approved references recovered
- 12 curated reference boards: 4 environment/equipment, 6 NPC, 2 coaches.
- 216 extracted NPC animation frames: 36 each for Frank, Radish, Marshall, Pudge, Holly and Gao.
- Extracted frames are provisional and must pass visual QA; the source sheets are authoritative.

## Currently verified in this branch
- Six PNG NPC atlases and `atlas-layout.json`.
- Compact environment atlases and an older actor fallback.

## Not yet verified as uploaded game assets
- Full-resolution environment reference boards.
- Coach customization sheets and final in-game coach sprites.
- Equipment condition states, maintenance and trash/garbage-can variants.
- Country flags and Combat Culture banner.

## Integration gate
1. Transfer original approved source boards into `art-source/level-1/`, `art-source/level-2/`, `art-source/npcs/`, `art-source/coaches/` without mixing rejected revisions.
2. Convert and QA all sprites (transparent background, proper foot anchors, directional facing and scale).
3. Map every approved sprite to its in-game usage; remove legacy procedural drawing/fallbacks **only after** verified replacement.
4. Test complete Level 1 and Level 2 gameplay and visual regression before release.

This audit does not claim the full art has been uploaded or deployed.
