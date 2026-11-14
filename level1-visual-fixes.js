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
  function makeGarageDoor(sc) {
    const g = sc.add.graphics().setDepth(0.32);
    const update = phase => {
      g.clear();
      const open = phase === "open";
      // Framing and track (open and closed share exactly the same bounds).
      g.fillStyle(0x1c2328).fillRect(65, 17, 185, 70);
      g.fillStyle(0x4a535b).fillRect(69, 20, 177, 64);
      if (open) {
        g.fillStyle(0x121e23).fillRect(71, 25, 173, 57);
        g.fillStyle(0x283439).fillRect(75, 28, 165, 2);
        g.fillStyle(0x11191f).fillRect(75, 36, 165, 46);
        // Raised shutter is contained inside the door opening.
        for (let y = 20; y < 35; y += 5) {
          g.fillStyle(0xa8a5a5).fillRect(71, y, 173, 4);
          g.fillStyle(0x635e62).fillRect(71, y + 4, 173, 1);
        }
      } else {
        for (let y = 21; y < 82; y += 7) {
          g.fillStyle((Math.floor(y / 7) % 2) ? 0xb4aeb0 : 0xaaa5a8).fillRect(71, y, 173, 6);
          g.fillStyle(0x646167).fillRect(71, y + 6, 173, 1);
          g.fillStyle(0xd5cdd0, .55).fillRect(74, y + 1, 167, 1);
        }
      }
      g.fillStyle(0x1b242a).fillRect(65, 17, 5, 70).fillRect(245, 17, 5, 70);
      g.fillStyle(0x7d878b).fillRect(67, 19, 1, 64).fillRect(247, 19, 1, 64);
      g.fillStyle(0x171e23).fillRect(63, 84, 189, 4);
      g.fillStyle(0xb3a7a8).fillRect(69, 85, 177, 1);
    };
    return { sprite: g, update };
  }
  function makeSideDoor(sc) {
    const frame = sc.add.graphics().setDepth(0.29);
    frame.fillStyle(0x28262d).fillRect(293, 16, 46, 73);
    frame.fillStyle(0x897d84).fillRect(295, 18, 42, 70);
    frame.fillStyle(0x201f25).fillRect(298, 20, 36, 65);
    let door;
    if (sc.textures.exists(ROOT + "side-door-approved")) {
      door = sc.add.image(316, 52, ROOT + "side-door-approved")
        .setDisplaySize(33, 65).setDepth(0.33);
    } else {
      door = sc.add.graphics().setDepth(0.33);
      door.fillStyle(0xb1a5aa).fillRect(300, 21, 32, 64);
      door.fillStyle(0x494149).fillRect(302, 23, 28, 60);
      door.fillStyle(0xaca0a5).fillCircle(325, 56, 2);
    }
    return [frame, door];
  }
  function makeLights(sc) {
    const lights = [];
    for (const x of [33, 450]) {
      if (sc.textures.exists(ROOT + "ceiling-strip-light")) {
        lights.push(sc.add.image(x, 12, ROOT + "ceiling-strip-light")
          .setDisplaySize(55, 15).setDepth(0.44));
      } else {
        const g = sc.add.graphics().setDepth(0.44);
        g.fillStyle(0x1d2830).fillRect(x - 28, 6, 56, 12);
        g.fillStyle(0xe9d6a5).fillRect(x - 24, 9, 48, 5);
        lights.push(g);
      }
    }
    return lights;
  }
  function attach(sc) {
    if (sc.gymLevel() !== 1) return;
    const phase = sc.dayPhase?.() || "opening";
    const wall = makeWall(sc);
    const shutter = makeGarageDoor(sc);
    const doors = makeSideDoor(sc);
    const lights = makeLights(sc);
    shutter.update(phase);
    const visuals = [wall, shutter.sprite, ...doors, ...lights];
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