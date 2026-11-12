# Latest Level 1 playable build recovery

Source: user-supplied `combat-culture-gym-level-1-wear-arrivals-dev(1).html` (self-contained compiled Phaser/Vite game, ~6.7 MB, 91 embedded image data URLs).

## Verified against the compiled bundle
- Wall: left 0, right 480, top 23, bottom 95.
- Floor: left 0, right 480, top 96, bottom 257.
- Room movement bounds: left 10, right 470, top 101, bottom 247.
- Mat: left 59, right 315, top 138, bottom 226.
- Prop envelopes: stock 3.5 x 3.5 blocks, mop 1.22 x 2.1 blocks; heavy bag 1.5 x 2.5, bench 2.25 x 1.25, focus mitts/wall pads/speed bag each 1.12 x 1.12.

These values were restored in `src/garageLayout.ts` on `checkpoint/level-1-hub`.

## Still required before claiming exact parity
- Compare/extract embedded room and object images against `src/assets`; the compiled HTML is the visual reference, not the editable source.
- Reconcile HUD placement (Open Gym action), indicator placement above students' heads, door arrival animation and equipment facing with source code.
- Rebuild, run unit/browser tests, inspect rendered scene; do not deploy to production before that.

This recovery note is intentionally explicit: the unpushed local commit `ba67179` was not found on GitHub, and the HTML bundle does not restore original TypeScript source maps automatically.
