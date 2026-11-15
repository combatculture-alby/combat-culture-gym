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

  // These six user-edited originals replace every previous Level 1 overlay,
  // sprite frame, and color-matching crop. Images are rendered at native size.
  const userSources = window.CC_L1_USER_IMAGES || {};
  const userImages = {};
  for (const [key, source] of Object.entries(userSources)) {
    const image = new Image();
    image.src = source;
    userImages[key] = image;
  }
  const ready = () =>
    ["wall","lamp","garage_closed","garage_open","side_closed","side_open"]
      .every(key => userImages[key]?.complete && userImages[key]?.naturalWidth > 0);

  function place(sc, key, x, y, w, h, depth) {
    const texture = "cc-l1-user-edited-v1-" + key;
    if (!sc.textures.exists(texture))
      sc.textures.addImage(texture, userImages[key]);
    return sc.add.image(x,y,texture).setOrigin(0,0)
      .setDisplaySize(w,h).setDepth(depth);
  }
  function makeWall(sc) {
    return place(sc, "wall", 0, 0, 480, 96, 0.28);
  }
  function makeGarageDoor(sc) {
    const closed = place(sc,"garage_closed",121,27,79,68,0.35);
    const open = place(sc,"garage_open",121,27,79,68,0.35);
    const update = (phase, visible) => {
      const isOpen = phase === "open";
      open.setVisible(visible && isOpen);
      closed.setVisible(visible && !isOpen);
    };
    return {sprites:[closed,open],update};
  }
  function makeSideDoor(sc) {
    const closed = place(sc,"side_closed",297,30,33,65,0.35);
    const open = place(sc,"side_open",297,30,33,65,0.35);
    const update = (phase,visible) => {
      const isOpen = phase === "open";
      open.setVisible(visible && isOpen);
      closed.setVisible(visible && !isOpen);
    };
    return {sprites:[closed,open],update};
  }
  function makeLights(sc) {
    return [48,212,418].map(x=>place(sc,"lamp",x,0,44,19,0.44));
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
    if (!ready()) return;
    if (!installed.has(sc)) attach(sc);
  };
  setInterval(poll, 450);
  poll();
})();