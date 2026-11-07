# Combat Culture Gym — Game Design (v0.1)

Status: preproduction approved; prototype implementation pending.

## Vision
A cozy, original 2D martial arts gym management/life-simulation browser game. One connected gym world with Class Rush, Pad Work and Coach Says as activities. Emphasize community and visible student growth over spreadsheet management.

## Confirmed decisions
- Hybrid time: free exploration has no countdown; activities advance time; player ends the day.
- Flexible classes: start with one Beginner Boxing class per day; unlock slots later.
- Student interactions optional but rewarding; no friendship decay.
- Recruitment: reputation-driven arrivals plus special referrals and events.
- Gym customization: movable equipment within valid zones, preset structural expansions (later release).
- Character customization: skin tone, hairstyle, hair color, outfit (later release).
- Visual direction: original modern-retro pixel RPG, top-down three-quarter perspective, warm wood, teal mats, red accents.
- Hybrid art: representative sprites plus placeholders.
- Class Rush controls: keyboard movement and click/tap-to-move with obstacle avoidance.
- Initial player character: user's chibi reference (red headband, black hair, black hoodie with orange tiger, red/gold Muay Thai shorts, barefoot). Original supplied expressions may be used for dialogue portraits; playable sprite will be adapted separately.

## Prototype 0.1 scope
One compact gym, one controllable owner, four recurring placeholder students (Alex, Maya, Jordan, Sam), one Beginner Boxing class per day, 3-person class capacity, 60-second Class Rush, three request types (technique correction, equipment assistance, station transition), basic dialogue, money, reputation, student skills, end-of-day report, autosave and five consecutive playable days.

Starting tuning values (not final): $100, reputation 0, four students with rotating attendance, one daily class.

## Daily loop
Explore/open gym → scheduled student arrival → optional conversations → start class → Class Rush → results/rewards → optional conversations → close gym → autosave and next day.

## Class Rush
WASD/arrows for movement, E/Space for nearby interaction; click/tap target for automatic movement and interaction upon arrival. Three request types; visible patience; successful requests improve class quality; missed requests reduce bonus but never block progression. Prototype test duration 45–60 seconds. No nested minigames during Class Rush.

## Students
Persistent identity, appearance, attendance, striking, technique, morale and friendship. Friendship and skills are separate. Optional interactions unlock stories and modest rewards; no daily relationship penalties.

## Future, not v0.1
Pad Work, Coach Says, avatar creator, equipment placement, expansions, assistant coaches, fighter competitions, deeper relationships, additional disciplines, music and full mobile UX. All share one game state.

## Art targets to validate
32x32 tile grid; approximately 24x32 or 32x40 character sprite; four-direction idle/walk; 480x270 internal resolution as an experiment, not a locked constraint. Pixel-crisp rendering and readable UI.

## Success criteria
Responsive navigation and interactions; coherent class start/finish; student identity is recognizable; money and progress persist after reload; five in-game days playable without critical errors; Class Rush is enjoyable enough to repeat.
