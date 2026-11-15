/* Combat Culture Gym /offline/ Level 1 equipment behavior.
   Mounted training equipment: passive class XP bonuses, no click interaction.
   Floor training equipment: keep click-to-approach and equipment action menus.
   Inventory actions still allow moving, storing, selling wall gear. */
(() => {
  'use strict';
  const configured = new WeakSet();
  const MOUNTED = new Map([
    [1, 'Thai Pads'],
    [2, 'Speed Bag'],
    [3, 'Jump Rope'],
    [8, 'Focus Mitts'],
    [14, 'Resistance Bands']
  ]);
  const MOUNTED_NAMES = new Set([...MOUNTED.values()].map(n => n.toLowerCase()));
  function scene() {
    return window.CC_GAME?.scene?.scenes?.find(sc =>
      sc.sys?.isActive?.() && sc.gymLevel?.() === 1 &&
      sc.__ccNov13Bound && typeof sc.drawEquipment === 'function' &&
      typeof sc.addFixtureInteraction === 'function' &&
      typeof sc.installedGearForStat === 'function');
  }
  function visibleInstalled(sc, index) {
    return Boolean(sc.saveData.ownedGear?.[index]) &&
      !sc.saveData.gearStored?.[index] &&
      (sc.saveData.roomState?.gearRooms?.[index] || 'main') === 'main';
  }
  function mountedAt(sc, x, y, label = '') {
    if (y > 102 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const normalized = String(label).trim().toLowerCase();
    for (const [index, name] of MOUNTED) {
      if (!visibleInstalled(sc, index) || !sc.isWallGear(index)) continue;
      if (normalized && name.toLowerCase() !== normalized) continue;
      const pos = sc.wallGearPosition(index);
      if (!pos) continue;
      const bounds = sc.gearBounds(index);
      const w = Math.max(18, bounds.rx * 2 + 8);
      const h = Math.max(20, bounds.ry * 2 + 10);
      if (Math.abs(x - pos.x) <= w / 2 && Math.abs(y - pos.y) <= h / 2)
        return true;
    }
    return false;
  }
  function attach(sc) {
    if (configured.has(sc)) return;
    configured.add(sc);

    // Native floor fixture hit zones are created through this method.
    // Suppress only the five installed wall training items. Other fixtures,
    // including doors, bulletin board, utilities and floor gear, stay usable.
    const addFixture = sc.addFixtureInteraction.bind(sc);
    sc.addFixtureInteraction = function(x, y, width, height, name, description, action) {
      if (sc.gymLevel() === 1 &&
          MOUNTED_NAMES.has(String(name).toLowerCase()) &&
          mountedAt(sc, x, y, name)) return;
      return addFixture(x, y, width, height, name, description, action);
    };

    // Clicking the blank wall around a mounted item must not open the
    // base equipment panel through the game's fallback canvas handler.
    const useGearAt = sc.useGearAt.bind(sc);
    sc.useGearAt = function(x, y) {
      if (sc.gymLevel() === 1 && mountedAt(sc, x, y)) return true;
      return useGearAt(x, y);
    };

    const openGearStation = sc.openGearStation.bind(sc);
    sc.openGearStation = function(index, ...args) {
      if (sc.gymLevel() === 1 && MOUNTED.has(index) &&
          visibleInstalled(sc, index) && sc.isWallGear(index)) return;
      return openGearStation(index, ...args);
    };

    // The existing installedGearForStat() is the class XP bonus source:
    // it counts placed, non-stored original gear and extra purchased copies.
    // Do NOT award bonuses every frame or on click. That would farm stats.
    const installedGearForStat = sc.installedGearForStat.bind(sc);
    sc.installedGearForStat = function(stat, ...args) {
      return installedGearForStat(stat, ...args);
    };

    // This view is for testing, not an extra bonus or saved stat source.
    sc.__ccEquipmentBehavior = {
      mountedGear: [...MOUNTED.values()],
      bonusForStat(stat) { return sc.installedGearForStat(stat); },
      isMountedClick(x, y) { return mountedAt(sc, x, y); }
    };

    // Rebuild only the fixture hit zones (the scene itself manages cleanup).
    // Floor heavy bags, kettlebells and dumbbells keep their existing
    // openGearStation / approach interactions and placeholder animations.
    sc.drawEquipment();
    sc.events.once('shutdown', () => configured.delete(sc));
  }
  const timer = setInterval(() => {
    const sc = scene();
    if (sc) attach(sc);
  }, 150);
})();