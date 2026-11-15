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
    [ROOT + "weight-bench", ROOT + "garage-weight-bench"],
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
  // Load the actual 2048 x 682 image supplied by the user. Do not
  // substitute the old 480 x 96 embedded/cropped wall PNG.
  const ORIGINAL_WALL = "./level1-original-wall.png?v=native-single-wall-20261115";
  const userSources = { ...(window.CC_L1_USER_IMAGES || {}), wall: ORIGINAL_WALL };
  const userImages = {};
  for (const [key, source] of Object.entries(userSources)) {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    userImages[key] = image;
  }
  const ready = () =>
    ["wall","lamp","garage_closed","garage_open","side_closed","side_open"]
      .every(key => userImages[key]?.complete && userImages[key]?.naturalWidth > 0) &&
    userImages.wall.naturalWidth === 2048 && userImages.wall.naturalHeight === 682;

  function place(sc, key, x, y, w, h, depth) {
    const texture = key === "wall" ? "cc-l1-exact-original-wall-2048x682" : "cc-l1-user-edited-v1-" + key;
    if (!sc.textures.exists(texture))
      sc.textures.addImage(texture, userImages[key]);
    return sc.add.image(x,y,texture).setOrigin(0,0)
      .setDisplaySize(w,h).setDepth(depth);
  }
  function makeWall(sc) {
    // Replace the game's ORIGINAL wall sprite in place. Earlier versions
    // stacked a second wall image on top of the old sprite, which led to
    // mismatched brick layers and hard-to-debug render order.
    const wall = sc.__ccL1Objects?.wall;
    const img = userImages.wall;
    if (!wall || img.naturalWidth !== 2048 || img.naturalHeight !== 682)
      throw new Error("Level 1 native wall or the exact user image is missing");
    const targetWidth = 480, targetHeight = 96;
    // Keep original brick proportions; the supplied image has more vertical
    // artwork than the fixed 480x96 game wall can show. Show its TOP 410
    // source rows at uniform scale rather than squeezing 682 rows into 96.
    // This retains the actual first brick row and full 2048px source width.
    const visibleSourceHeight = Math.round(img.naturalWidth * targetHeight / targetWidth);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Wall canvas is unavailable");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, img.naturalWidth, visibleSourceHeight,
      0, 0, targetWidth, targetHeight);
    const textureKey = "cc-l1-native-user-wall-20261115";
    if (sc.textures.exists(textureKey)) sc.textures.remove(textureKey);
    sc.textures.addImage(textureKey, canvas);
    wall.setTexture(textureKey).setOrigin(0,0).setPosition(0,0)
      .setDisplaySize(targetWidth,targetHeight).setDepth(0.34).setVisible(true);
    wall.setName("cc-original-wall-replaced-with-user-png");

    window.CC_L1_WALL_DIAGNOSTICS = {
      filename: "New wall.png",
      source: ORIGINAL_WALL,
      sourceWidth: img.naturalWidth, sourceHeight: img.naturalHeight,
      visibleSourceRect: [0,0,img.naturalWidth,visibleSourceHeight],
      sourceSpriteReplaced: true,
      spriteIdentityPreserved: sc.__ccL1Objects.wall === wall,
      textureKey: wall.texture.key,
      renderWidth: wall.displayWidth, renderHeight: wall.displayHeight,
      activeWallSprites: sc.children.list.filter(obj =>
        obj.visible && obj.texture &&
        /(?:independent-wall|original-wall|user-wall|approved-brick-row)/.test(obj.texture.key)).length
    };
    return wall;
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
    // Native wall remains scene-owned and is not a disposable overlay.
    const visuals = [...shutter.sprites, ...side.sprites, ...lights];
    installed.set(sc, {visuals, shutter, side});

    // Retire the old independent architecture; keep all of its collision
    // geometry and phase logic. Previously the old sprites were layered
    // underneath the new ones, leaving trim and lamp fragments visible.
    sc.events.off("update", sc.__ccSyncDoors);
    const hideOldArchitecture = () => {
      for (const item of Object.values(native)) {
        if (item === wall) continue;
        if (Array.isArray(item)) item.forEach(sprite => sprite?.setVisible(false));
        else item?.setVisible?.(false);
      }
      // Some legacy previews also render independently created brick
      // strips. Retire all known old wall keys, even if added later.
      const oldWalls = new Set([
        "cc-approved-brick-row",
        "cc-l1-independent-wall",
        "cc-l1-user-edited-v1-wall",
        "cc-l1-exact-original-wall-2048x682"
      ]);
      for (const child of sc.children.list) {
        if (child !== wall && oldWalls.has(child.texture?.key))
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
    // Keep the game's canvas hidden until Phaser has drawn an entire frame
    // containing the replacement wall/doors/lights. CSS is injected in <head>
    // by the isolated preview build, before any original game code runs.
    const reveal = () => {
      document.documentElement.classList.add("cc-l1-ready");
      document.documentElement.classList.remove("cc-l1-loading");
    };
    const revealAfterEquipment = () => {
      if (sc.game?.events?.once) sc.game.events.once("postrender", reveal);
      else requestAnimationFrame(() => requestAnimationFrame(reveal));
    };
    if (window.CC_L1_EQUIPMENT_READY === true) revealAfterEquipment();
    else window.addEventListener("cc-l1-equipment-ready", revealAfterEquipment, {once:true});
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
  setInterval(poll, 100);
  poll();
})();