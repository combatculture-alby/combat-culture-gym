# Living Gym playtest

PR #27 builds on the world and builder changes in PR #26. The existing GitHub Pages workflow previews #26. The separate Living Gym playtest builds #27 with `VITE_ISOLATE_SAVE=1` and a starter room with a heavy bag, kettlebells, a bench and building supplies.

## Design and compatibility

- Kept the inherited 480 × 330 canvas and 480 × 270 menu layout. Phaser fits the full canvas to the available screen.
- Five original character atlases use integer-pixel drawing, mirrored side profiles, distinct front and back frames, and directional walking and activity poses. The gym room artwork is baked once per game session.
- Footprints drive placement and navigation. Ambient students reserve destinations and use only matching equipment. They replan around actors, pause in menus and Build, and face the coach during a conversation. Ambient routines never award XP or change the save.
- The production build still uses `combat-culture-gym-v1`. The playtest uses its own key and starts independently. Actors can recover from older furniture layouts that cover their spawn, and newly valid item coordinates survive reloads.
- Build, Roster, Rotate, Store and Cancel have on-screen controls. Placement checks the snapped footprint before writing. The single-key save reset was removed.

## Verification

Run `npm test` with Node 22.18+ for navigation regression tests, then `npm run build` for TypeScript and the production bundle.

Browser smoke checks cover walking to the board, teaching a scheduled class, saving and reloading the payout and class count, arrow-key placement, buying gear into inventory, on-screen placement, advancing the day, and entering and exiting Bag Work. The original minigame art remains in the arcade scenes. Real-device Safari and extended minigame and crowded-room playtesting are production release checks.
