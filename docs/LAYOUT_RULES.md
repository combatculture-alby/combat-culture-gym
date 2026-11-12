# Combat Culture Gym layout rules

These rules apply to every room. Use them for room art, item definitions, build mode, movement, and layout review. Apply them to Level 1 first.

## 1. One block system

Use a shared block unit across the game. Define each item's visible width and height, floor footprint or wall coverage, and orientation in that unit. Convert blocks to pixels through a shared scale. Camera zoom can change how large the room reads on screen while preserving the relationships between objects.

One block is **24 game pixels**. The coach's visible standing height is about **2.2 blocks**. Use the approved larger-props scale for Level 1. The canonical width and height envelopes are in `GARAGE_ASSET_BLOCKS` in `src/garageLayout.ts`. Preserve sprite aspect ratios within those envelopes. A sprite that cannot fill an envelope needs correctly proportioned replacement art.

| Asset | Width × height in blocks |
|---|---:|
| Coach | 1.2 × 2.2 |
| Side door | 1.5 × 3 |
| Garage shutter | 5 × 3.25 |
| Folding desk | 4.4 × 2.5 |
| Supply shelf | 3.75 × 3.75 |
| Water cooler | 0.95 × 2.5 |
| Broom | 1.45 × 2.5 |
| Bulletin board | 2.8 × 1.9 |
| Individual mat tile | 1 × 1 |

## 2. Hard room boundaries and registered surfaces

Every playable room has hard boundaries. Register the upper wall band as wall, the walkable floor as floor, and the training mat as a distinct region of walkable floor. Keep these regions aligned with the room art. Players and NPCs stay within walkable space, with passage through designated entrances and exits.

## 3. Surface-specific placement

Each item declares where it can go. Posters and other wall-mounted items need enough unoccupied wall blocks. Mat-only equipment must fit entirely within the mat region. Floor items need enough valid floor blocks for their full footprint. Apply the same checks when placing, moving, or rotating an item.

## 4. Collision for items and characters

Every item and character has collision geometry appropriate to what it occupies. Floor items use their ground footprint, wall items occupy wall space, and characters use a footprint around their feet. Enforce boundaries and collision for both the player and NPCs during movement and routing. A character can pass in front of a wall poster. A character cannot walk through furniture or another character. Validate placement so objects cannot clip through each other or block required access.

## 5. Everything moves except the doors

The garage shutter and pedestrian door are fixed. Every other placeable item is movable in build mode, including the reception desk, bulletin board, broom, shelf, and cooler. Interactive items keep their function after a move. Their sprite, collision, click target, and walking approach follow the new placement. Save and restore that placement. A valid placement leaves a reachable approach for any item the player or students need to use.

## 6. Size the room and props for the chibi characters

Judge the scale with the coach visible in the room. Give props enough visual presence to read alongside the chibi characters. Keep doors, work surfaces, and equipment logically proportioned to each other. Reduce dead space through room dimensions, placement, and framing. Keep enough clearance for movement and interactions. Individual puzzle tiles can be small while the training area stays large enough for class.

## Review before layout work proceeds

Review the actual playable scene with the coach next to the side door, desk, and utility items. Verify legal surfaces, hard boundaries, collision for both the player and NPCs, and that moved fixtures remain reachable, interactive, and correctly placed after reload.

## 7. Straight-on artwork

Use front-facing or orthographic sprites for room props and equipment. Exclude three-quarter and isometric sprites from playable layouts. Replace angled artwork while preserving the item's gameplay and saved state.
