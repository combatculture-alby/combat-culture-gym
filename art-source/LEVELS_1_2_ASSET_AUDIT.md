# Level 1–2 approved artwork: verified local inventory

**Scope:** Only Levels 1 and 2. Preserve functional game code, replace all legacy visuals only after replacements are validated.

## Source art located and deduplicated
19 distinct reference PNGs were recovered from the conversation's mounted files (duplicates excluded). A local archive was assembled as `combat-culture-levels-1-2-approved-source-art.zip` (approximately 54 MB) with SHA-256 manifest.

### Characters (8 distinct reference sheets)
- Erin Student Pixel Sprite Sheet
- Female Coach Chibi Sprite Customization Sheet
- Frank_ Combat Culture Gym Sprite Sheet
- Frank’s Combat Gym Sprite Sheet (1)
- Frank’s Combat Gym Sprite Sheet (3)
- Gao’s Combat Gym Character Sheet
- Marshall Chibi Combat Character Sheet
- Pudge Student Sprite Sheet
- Radish Student Sprite Sheet

### Environment, objects, decoration (10)
- Combat Culture Gym Asset Board
- Combat Culture Gym Asset Sheet
- Combat Culture Gym Pixel Asset Sheet
- Combat Culture Gym Tileset Showcase
- Gym Equipment States Pixel Art Sprite Sheet
- Gym Maintenance Pixel Art Asset Sheet
- Level 1 Garage Gym Asset Sheet
- Pixel Art Country Flags Wall Chart
- Pixel-Art Combat Culture Gym Banner
- ChatGPT Image Nov 10, 2026, 11_04_58 PM (unclassified: inspect visually before approval)

## Already present in the game branch
- Six extracted student atlases: Frank, Radish, Marshall, Pudge, Holly, Gao.
- `src/assets/atlas-layout.json` states frame size 48×64 and 12 columns × 3 rows.
- `src/characterArt.ts` currently maps sheet columns in the order down, right, left, up, which **differs from atlas-layout.json** (down, left, right, up). This discrepancy needs image-by-image directional QA before changing mappings.

## Missing / unverified
- Original approved **male coach** customization sheet was not identifiable among the recovered named reference PNGs.
- An approved **Holly** original reference sheet was not identifiable among the recovered named reference PNGs, despite a generated atlas in the game.
- Full source PNGs in this inventory are **not yet uploaded to GitHub**; this commit records the audit only.
- No asset should be assumed final until its reference and in-game frame are visually compared.

## Next actions
1. Transfer all 19 distinct source PNGs into GitHub, retaining the manifest and marking the unclassified image for review.
2. Compare each extracted frame against its source board, fix direction and transparency.
3. Replace all legacy artwork in Level 1 and Level 2, while retaining gameplay logic.
4. Verify all interactions, persistence, and visual consistency before deploying.

**Status:** inventory complete; GitHub binary transfer pending; no game deployment claimed.
