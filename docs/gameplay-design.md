# Combat Culture Gym: Core Gameplay Design (v1)

## Vision
A cozy, replayable martial arts gym life and management game. Daily gathering, cleaning, decorating, crafting, and spending time in the gym are as important as teaching classes. Student progression is a long-term supporting system, not an end condition. Placeholder graphics are acceptable until the core loop is enjoyable.

## Daily loop
- Explore the gym and collect visible resources. Cleaning is optional, never a mandatory daily tax.
- Review students and their individual goals.
- Simulate up to TWO classes per day. Players choose which students attend, subject to class capacity.
- Play up to TWO optional minigames per day; each individual minigame is playable only once that day.
- Buy, craft, place, salvage, and rearrange equipment and decorations.
- Close the gym to advance the day. No activity is required to close.

## Student attributes
Four stats, 0-100: Striking, Speed, Strength, Conditioning. Each has independent training XP and increasingly expensive thresholds. No stat is permanently capped by class selection; reaching 100 is not a win condition.

## Simulated classes
- Boxing: Striking + Speed
- Muay Thai: Striking + Strength
- Grappling: Strength + Conditioning
- HIIT: Speed + Conditioning

Classes award XP to BOTH listed stats for participating students. Class outcomes are simulated, not minigames.

## Equipment
Two relevant items per stat:
- Striking: Heavy Bag, Thai Pads
- Speed: Speed Bag, Jump Rope
- Strength: Weight Bench, Kettlebells
- Conditioning: Treadmill, Assault Bike

Equipment improves XP earned from classes that train the matching stat. First item improves effectiveness; second item should improve training capacity or unlock a meaningful utility, not unbounded stacking. Equipment must be visibly placed in the gym and used by students over time.

## Minigames
- Class Rush: +XP toward one chosen stat (not restricted to a scheduled class)
- Defense: Speed XP
- Bag Work: Strength XP
- Pad Work: Striking XP
- Sparring (rename Competition): Conditioning XP
- Agility Training (rename Strength & Conditioning): XP toward one chosen stat

Bonuses should be modest relative to classes, optional, and granted once per day. Minigame difficulty primarily influences money/reputation, not stat XP.

## Progression and balance
Start with a tunable XP curve, not direct +1 stat per activity. Early stat gains should be noticeable, midgame slower, and advanced training significantly slower. Simulate 30-100 days to tune. Students have evolving goals and relationships; maxing a stat does not end the game. Equipment, expansions, customization, student interactions, and gathering are long-term motivators.

## Gathering and crafting
- World objects can be picked up directly with clear visual/audio feedback.
- Materials have persistent inventory counts and meaningful uses in furniture, equipment, and decoration recipes.
- Resource sources: cleaning finds, deliveries, salvage, and eventually outdoor exploration.
- Respawn gradually; avoid repetitive mandatory chores.
- Players can spend entire days collecting, arranging, and decorating without training.

## Development order
1. Stabilize hub, working roster, panel/input behavior, no overlapping menus.
2. Implement student stats, XP, goals, class scheduling and simulated outcomes.
3. Implement equipment effects and minigame XP rewards with daily limits.
4. Implement tangible pickups, inventory, salvage, crafting, and furniture placement.
5. Student behavior, facility expansion, relationships, events, art/UI polish.

## Compatibility
Preserve existing saves under combat-culture-gym-v1. Migrate older student skills/equipment gracefully; never wipe progress. Keep gameplay and save schemas testable.
