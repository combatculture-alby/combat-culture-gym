/* Level 1 visual repair. Runs only in the isolated /offline/ playtest.
   Canonical props: plain jump rope and Level 1 flat weight bench.
   Wall, garage shutter, side door and lights are independent objects.
   Do not touch production, saves, characters, or interaction targets. */
(() => {
  "use strict";
  const ROOT = "approved-garage-";
  const installed = new WeakMap();
  const sourceAliases = [
    [ROOT + "garage-weight-bench", ROOT + "weight-bench"],
    [ROOT + "garage-mounted-jump-rope", ROOT + "jump-rope"],
    ["garage-mounted-jump-rope", ROOT + "jump-rope"]
  ];

  function currentScene() {
    return window.CC_GAME?.scene?.scenes?.find(
      s => s.sys?.isActive?.() && s.furniturePanel && typeof s.gymLevel === "function"
        && typeof s.drawEquipment === "function"
    );
  }
  function repairProps(sc) {
    let changed = false;
    for (const [wrong, correct] of sourceAliases) {
      if (!sc.textures.exists(correct)) continue;
      const image = sc.textures.get(correct).getSourceImage();
      const old = sc.textures.exists(wrong) ? sc.textures.get(wrong).getSourceImage() : null;
      if (old === image) continue;
      if (sc.textures.exists(wrong)) sc.textures.remove(wrong);
      sc.textures.addImage(wrong, image);
      changed = true;
    }
    if (changed) sc.drawEquipment();
  }
  function makeWall(sc) {
    const g = sc.add.graphics().setDepth(0.12);
    // Opaque continuous wall hides all inconsistent original wall and door pixels.
    g.fillStyle(0x353137, 1).fillRect(0, 0, 480, 94);
    g.fillStyle(0x26252b, 1).fillRect(0, 0, 480, 9);
    g.fillStyle(0x655f64, 1).fillRect(0, 9, 480, 78);
    // Individual small bricks: same offsets, dimensions and mortar for the full width.
    const brickW = 20, brickH = 8;
    const tones = [0x696469, 0x746e73, 0x615d61, 0x7b7579];
    for (let row = 0, y = 11; y < 88; row++, y += brickH) {
      const offset = row % 2 ? -10 : 0;
      for (let x = offset; x < 480; x += brickW) {
        const tone = tones[(row * 7 + Math.floor((x + 10) / brickW) * 3 + 128) % tones.length];
        g.fillStyle(0x302c32).fillRect(x, y, brickW, brickH);
        g.fillStyle(tone).fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
        g.fillStyle(0xa29a9d, .28).fillRect(x + 2, y + 1, brickW - 4, 1);
        g.fillStyle(0x27262b, .18).fillRect(x + 1, y + brickH - 2, brickW - 2, 1);
      }
    }
    // Continuous footing: no exposed strips of the underlying asset.
    g.fillStyle(0x28282d).fillRect(0, 88, 480, 6);
    g.fillStyle(0x92878b).fillRect(0, 88, 480, 1);
    return g;
  }
  function nativeImage(sc, key, x, y, w, h, depth) {
    const texture = "cc-l1-independent-" + key;
    if (!sc.textures.exists(texture)) return null;
    return sc.add.image(x, y, texture).setOrigin(0, 0).setDisplaySize(w, h).setDepth(depth);
  }
  function makeGarageDoor(sc) {
    // The original independent garage door is 79 x 68 at 121,27.
    // Reuse those approved sprites at their authored coordinates; do not
    // stretch the garage entrance or change its collision geometry.
    const exterior = nativeImage(sc, "exterior-garage", 124, 36, 77, 62, .34);
    const closed = nativeImage(sc, "garage", 121, 27, 79, 68, .35);
    const frame = nativeImage(sc, "garage-frame", 121, 27, 79, 68, .36);
    const update = phase => {
      const open = phase === "open";
      exterior?.setVisible(open);
      closed?.setVisible(!open);
    };
    return {sprites:[exterior, closed, frame].filter(Boolean), update};
  }
  function makeSideDoor(sc) {
    // The side-door opening remains 33 x 65 at 297,30.
    const exterior = nativeImage(sc, "exterior-side", 301, 36, 27, 59, .34);
    const closed = nativeImage(sc, "side", 297, 30, 33, 65, .35);
    const frame = nativeImage(sc, "side-frame", 297, 30, 33, 65, .36);
    const update = phase => {
      const open = phase === "open";
      exterior?.setVisible(open);
      closed?.setVisible(!open);
    };
    return {sprites:[exterior, closed, frame].filter(Boolean), update};
  }
  function makeLights(sc) {
    // Original independent lamp positions and native 44 x 19 proportions.
    return [48, 212, 418].map(x =>
      nativeImage(sc, "lamp", x, 0, 44, 19, .44)
    ).filter(Boolean);
  }
  function attach(sc) {
    if (sc.gymLevel() !== 1 || !sc.__ccL1Objects) return;
    const phase = sc.dayPhase?.() || "opening";
    const wall = makeWall(sc);
    const shutter = makeGarageDoor(sc);
    const side = makeSideDoor(sc);
    const lights = makeLights(sc);
    shutter.update(phase);
    side.update(phase);
    const visuals = [wall, ...shutter.sprites, ...side.sprites, ...lights];
    installed.set(sc, {visuals, shutter, phase});
    const onUpdate = () => {
      const state = installed.get(sc);
      if (!state) return;
      const main = sc.gymLevel() === 1 && (sc.saveData?.roomState?.currentRoom || "main") === "main";
      for (const v of state.visuals) v.setVisible(main);
      if (!main) return;
      const nextPhase = sc.dayPhase?.() || "opening";
      if (state.phase !== nextPhase) {
        state.phase = nextPhase;
        state.shutter.update(nextPhase);
        side.update(nextPhase);
      }
    };
    sc.events.on("update", onUpdate);
    sc.events.once("shutdown", () => {
      sc.events.off("update", onUpdate);
      for (const v of visuals) if (v.active) v.destroy();
      installed.delete(sc);
    });
  }
  const poll = () => {
    const sc = currentScene();
    if (!sc) return;
    repairProps(sc);
    if (!installed.has(sc)) attach(sc);
  };
  setInterval(poll, 450);
  poll();
})();