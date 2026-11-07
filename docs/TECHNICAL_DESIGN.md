# Combat Culture Gym — Technical Design (initial)

## Stack
Phaser 3 + TypeScript + Vite; GitHub source control; static browser deployment planned. No repository implementation existed at document creation.

## Architecture
Scenes for gym, Class Rush and UI; plain data/state systems for schedule, students, economy, and persistence. Minigames mutate shared state only through explicit reward transactions. Keep rendering separate from game data.

## Input
Keyboard: WASD/arrows move, E/Space interact. Pointer: click/tap reachable destination or student; grid-based obstacle-aware pathfinding. Cancel path on direct keyboard movement. Use simple collision footprints independent of art dimensions.

## Saving
Versioned JSON schema in localStorage for prototype; validate on load and support migrations. Save on day completion and committed reward events. Never award Class Rush rewards twice when reloading during a class. Export/import planned before public release. Explain local data clearing risk to players.

## Art pipeline
User-supplied chibi reference artwork is the source for initial gym owner appearance and dialogue expressions. Adapt to original 4-direction pixel sprites; do not directly shrink high-resolution illustrations and call them pixel sprites. Start with placeholder environment assets. Keep raw source art separate from runtime optimized sprites.

## Quality gates
TypeScript/build checks; test state transitions and save schema; manual keyboard/pointer navigation and browser smoke tests before marking milestones complete.
