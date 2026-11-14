/* Level 1 visual repair. Runs only in the isolated /offline/ playtest.
   Canonical props: plain jump rope and Level 1 flat weight bench.
   Wall, garage shutter, side door and lights are independent objects.
   Do not touch production, saves, characters, or interaction targets. */
(() => {
  "use strict";
  const ROOT = "approved-garage-";
  const installed = new WeakMap();
  const sourceAliases = [
    // The flat standalone bench is the approved asset. Both the floor
    // furniture and equipment paths must point to the same image.
    [ROOT + "garage-weight-bench", ROOT + "weight-bench"],
    [ROOT + "garage-weight-bench-worn", ROOT + "weight-bench"],
    // Both the original wall item and the shop/extra-gear item previously
    // referenced a pegboard-style sprite instead of the actual jump rope.
    [ROOT + "garage-jump-rope", ROOT + "jump-rope"],
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
    // The shop/inventory can hold an existing Image after a texture is
    // replaced. Rebind those images as well as newly drawn floor props.
    for (const child of sc.children.list) {
      const key = child.texture?.key;
      const match = sourceAliases.find(([wrong]) => wrong === key);
      if (match && sc.textures.exists(match[1]) && typeof child.setTexture === "function")
        child.setTexture(match[1]);
    }
  }
  function makeWall(sc) {
    const g = sc.add.graphics().setDepth(0.28);
    // Opaque continuous wall hides all inconsistent original wall and door pixels.
    g.fillStyle(0x353137, 1).fillRect(0, 0, 480, 101);
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
    g.fillStyle(0x28282d).fillRect(0, 88, 480, 13);
    g.fillStyle(0x92878b).fillRect(0, 88, 480, 1);
    return g;
  }
  // The approved door and light crops include a few pixels from the *old*
  // brick wall along their edges. Mask those pixels in a separate canvas
  // texture, using the original wall as a pixel-for-pixel reference.
  // Keep all actual door and lamp art, native proportions and hit targets.
  function cleanNativeTexture(sc, key, x, y) {
    const sourceKey = "cc-l1-independent-" + key;
    const cleanKey = "cc-l1-edge-clean-v1-" + key;
    if (sc.textures.exists(cleanKey)) return cleanKey;
    const wallKey = "cc-l1-independent-wall";
    if (!sc.textures.exists(sourceKey) || !sc.textures.exists(wallKey)) return sourceKey;

    const source = sc.textures.get(sourceKey).getSourceImage();
    const wall = sc.textures.get(wallKey).getSourceImage();
    if (!source?.width || !source?.height || !wall?.width) return sourceKey;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", {willReadFrequently:true});
    if (!context) return sourceKey;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const wallCanvas = document.createElement("canvas");
    wallCanvas.width = wall.width;
    wallCanvas.height = wall.height;
    const wallContext = wallCanvas.getContext("2d", {willReadFrequently:true});
    if (!wallContext) return sourceKey;
    wallContext.drawImage(wall, 0, 0);
    const oldWall = wallContext.getImageData(0, 0, wall.width, wall.height).data;

    // The lamp is reused at three x positions. Pick the source-wall alignment
    // with the most matching border pixels rather than changing the lamp art.
    const positions = key === "lamp" ? [48, 212, 418] : [x];
    let bestX = positions[0], bestMatches = -1;
    const matchesAt = (left, countOnly) => {
      let matches = 0;
      for (let row = 0; row < canvas.height; row++) {
        const wy = y + row;
        if (wy < 0 || wy >= wall.height) continue;
        for (let col = 0; col < canvas.width; col++) {
          const wx = left + col;
          if (wx < 0 || wx >= wall.width) continue;
          const pixel = (row * canvas.width + col) * 4;
          const background = (wy * wall.width + wx) * 4;
          if (pixels.data[pixel + 3] < 16 || oldWall[background + 3] < 240) continue;
          // Transparent/fringe pixels were copied from this exact earlier
          // wall image. Allow small RGB differences from edge antialiasing.
          const dr = Math.abs(pixels.data[pixel] - oldWall[background]);
          const dg = Math.abs(pixels.data[pixel + 1] - oldWall[background + 1]);
          const db = Math.abs(pixels.data[pixel + 2] - oldWall[background + 2]);
          const nearEdge = Math.min(col, row, canvas.width - 1 - col,
                                    canvas.height - 1 - row) <= 6;
          if (dr <= (nearEdge ? 16 : 5) &&
              dg <= (nearEdge ? 16 : 5) &&
              db <= (nearEdge ? 16 : 5)) {
            matches++;
            if (!countOnly) pixels.data[pixel + 3] = 0;
          }
        }
      }
      return matches;
    };
    for (const candidate of positions) {
      const count = matchesAt(candidate, true);
      if (count > bestMatches) { bestMatches = count; bestX = candidate; }
    }
    if (bestMatches <= 0) return sourceKey;
    matchesAt(bestX, false);
    context.putImageData(pixels, 0, 0);
    sc.textures.addCanvas(cleanKey, canvas);
    return cleanKey;
  }
  function nativeImage(sc, key, x, y, w, h, depth) {
    const texture = "cc-l1-independent-" + key;
    if (!sc.textures.exists(texture)) return null;
    const clean = cleanNativeTexture(sc, key, x, y);
    return sc.add.image(x, y, clean).setOrigin(0, 0).setDisplaySize(w, h).setDepth(depth);
  }
  function makeGarageDoor(sc) {
    // The original independent garage door is 79 x 68 at 121,27.
    // Reuse those approved sprites at their authored coordinates; do not
    // stretch the garage entrance or change its collision geometry.
    const exterior = nativeImage(sc, "exterior-garage", 124, 36, 77, 62, .34);
    const closed = nativeImage(sc, "garage", 121, 27, 79, 68, .35);
    const frame = nativeImage(sc, "garage-frame", 121, 27, 79, 68, .36);
    const update = (phase, visible) => {
      const open = phase === "open";
      exterior?.setVisible(visible && open);
      closed?.setVisible(visible && !open);
      frame?.setVisible(visible);
    };
    return {sprites:[exterior, closed, frame].filter(Boolean), update};
  }
  function makeSideDoor(sc) {
    // The side-door opening remains 33 x 65 at 297,30.
    const exterior = nativeImage(sc, "exterior-side", 301, 36, 27, 59, .34);
    const closed = nativeImage(sc, "side", 297, 30, 33, 65, .35);
    const frame = nativeImage(sc, "side-frame", 297, 30, 33, 65, .36);
    const update = (phase, visible) => {
      const open = phase === "open";
      exterior?.setVisible(visible && open);
      closed?.setVisible(visible && !open);
      frame?.setVisible(visible);
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
    const native = sc.__ccL1Objects;
    const wall = makeWall(sc);
    const shutter = makeGarageDoor(sc);
    const side = makeSideDoor(sc);
    const lights = makeLights(sc);
    const visuals = [wall, ...shutter.sprites, ...side.sprites, ...lights];
    installed.set(sc, {visuals, shutter, side});

    // Retire the old independent architecture; keep all of its collision
    // geometry and phase logic. Previously the old sprites were layered
    // underneath the new ones, leaving trim and lamp fragments visible.
    sc.events.off("update", sc.__ccSyncDoors);
    const hideOldArchitecture = () => {
      for (const item of Object.values(native)) {
        if (Array.isArray(item)) item.forEach(sprite => sprite?.setVisible(false));
        else item?.setVisible?.(false);
      }
      for (const child of sc.children.list) {
        if (child.texture?.key === "cc-approved-brick-row")
          child.setVisible(false);
      }
    };
    const onUpdate = () => {
      const main = sc.gymLevel() === 1 &&
        (sc.saveData?.roomState?.currentRoom || "main") === "main";
      hideOldArchitecture();
      wall.setVisible(main);
      lights.forEach(light => light.setVisible(main));
      const phase = sc.dayPhase?.() || "opening";
      // Never blanket-show both door states: it previously made the
      // exterior AND closed shutter/side door visible on every frame.
      shutter.update(phase, main);
      side.update(phase, main);
    };
    onUpdate();
    sc.events.on("update", onUpdate);
    sc.events.once("shutdown", () => {
      sc.events.off("update", onUpdate);
      for (const v of visuals) if (v.active) v.destroy();
      installed.delete(sc);
    });
  }
  const poll = () => {
    const sc = currentScene();
    if (!sc || sc.gymLevel() !== 1) return;
    repairProps(sc);
    if (!installed.has(sc)) attach(sc);
  };
  setInterval(poll, 450);
  poll();
})();