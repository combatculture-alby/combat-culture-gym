/* User-edited Level 1 training equipment (2026-11-14).
   Sprite atlas retains transparent boundaries; all seven crops are from
   the user's uploads. The old source art remains for everything else. */
(() => {
  "use strict";
  const atlas = new Image();
  atlas.decoding = "async";
  atlas.src = "./level1-updated-equipment-atlas.png?v=20261115-clean-equipment";
  const frames = [
    { name:"bands",       x:0,   y:0,   w:93,  h:128, keys:["approved-garage-bands"] },
    { name:"bag-worn",    x:96,  y:0,   w:81,  h:128, keys:["approved-garage-heavy-bag-worn"] },
    { name:"bag",         x:179, y:0,   w:81,  h:128, keys:["approved-garage-heavy-bag"] },
    { name:"rope",        x:262, y:0,   w:72,  h:128, keys:[
      "approved-garage-jump-rope", "approved-garage-garage-jump-rope",
      "garage-mounted-jump-rope", "approved-garage-garage-mounted-jump-rope"
    ] },
    { name:"bench-worn",  x:0,   y:130, w:128, h:63, keys:[
      "approved-garage-garage-weight-bench-worn", "approved-garage-weight-bench-worn"
    ] },
    { name:"bench",       x:130, y:130, w:128, h:61, keys:[
      "approved-garage-garage-weight-bench", "approved-garage-weight-bench"
    ] },
    { name:"kettlebells", x:260, y:130, w:128, h:53, keys:["approved-garage-kettlebells"] }
  ];
  // Test/QA can inspect these exact mapped source dimensions.
  window.CC_L1_UPLOADED_EQUIPMENT = frames.map(({name,w,h,keys})=>({name,w,h,keys}));
  let registered = false;
  let reportedError = false;
  function currentScene() {
    return window.CC_GAME?.scene?.scenes?.find(s =>
      s.sys?.isActive?.() && s.gymLevel?.() === 1 &&
      s.__ccNov13Bound && s.textures && typeof s.drawEquipment === "function");
  }
  function install(sc) {
    if (registered || !atlas.complete || !atlas.naturalWidth) return;
    const tm = sc.textures;
    // Crop into individual canvases so each drawing path keeps its
    // original Phaser texture key, normal/worn state, collision and size.
    const replacements = frames.map(frame => {
      const canvas = document.createElement("canvas");
      canvas.width = frame.w;
      canvas.height = frame.h;
      const ctx = canvas.getContext("2d", {willReadFrequently:false});
      if (!ctx) throw new Error("Cannot create equipment canvas");
      ctx.clearRect(0,0,frame.w,frame.h);
      ctx.drawImage(atlas,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
      return {frame,canvas};
    });
    for (const {frame,canvas} of replacements) {
      for (const key of frame.keys) {
        if (tm.exists(key)) tm.remove(key);
        tm.addImage(key,canvas);
      }
    }
    registered = true;
    // Rebuild original placements, duplicate purchases, worn states,
    // menu icons and any mounted ropes against the new textures.
    sc.drawEquipment();
    for (const child of sc.children.list) {
      if (child.texture?.key && child.setTexture &&
          replacements.some(({frame})=>frame.keys.includes(child.texture.key))) {
        child.setTexture(child.texture.key);
      }
    }
    window.CC_L1_EQUIPMENT_READY = true;
    window.dispatchEvent(new Event("cc-l1-equipment-ready"));
  }
  function poll() {
    if (registered) return;
    if (atlas.complete && !atlas.naturalWidth) {
      if (!reportedError) {
        console.error("Updated equipment atlas failed to load");
        reportedError = true;
      }
      return;
    }
    const sc = currentScene();
    if (!sc) return;
    try { install(sc); }
    catch (err) {
      if (!reportedError) console.error("Cannot install updated equipment",err);
      reportedError = true;
    }
  }
  const timer = setInterval(() => {
    poll();
    if (registered) clearInterval(timer);
  },100);
  atlas.addEventListener("load",poll);
})();