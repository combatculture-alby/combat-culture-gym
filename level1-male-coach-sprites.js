/* User-edited male coach movement sprites for Combat Culture Gym's isolated /offline/ Level 1 playtest.
   This deliberately does not modify the game's minified bundle, production scene, saves, students,
   female coach, or existing non-movement animations. Move frames only are replaced. */
(() => {
  'use strict';
  const ATLAS_URL = './level1-male-movement-atlas.png?v=male-frames-20261115';
  const KEY = 'cc-user-male-movement-20261115';
  const FRAME_WIDTH = 60, FRAME_HEIGHT = 114, COLUMNS = 8, FRAMES = 32;
  const frames = {
    idle: {down:[0,1],up:[2,3],left:[4,5],right:[6,7]},
    walk: {down:[8,9,10],up:[11,12,13],left:[14,15,16],right:[17,18,19]},
    run:  {down:[20,21,22],up:[23,24,25],left:[26,27,28],right:[29,30,31]}
  };
  const patched = new WeakSet();
  const atlas = new Image();
  let loaded = false;
  atlas.decoding = 'async';
  atlas.onload = () => {
    if (atlas.naturalWidth !== FRAME_WIDTH * COLUMNS ||
        atlas.naturalHeight !== FRAME_HEIGHT * 4) {
      console.error('Male coach atlas dimensions do not match the frame map');
      return;
    }
    loaded = true;
    scan();
  };
  atlas.onerror = () => console.error('Could not load user-edited male coach atlas:', ATLAS_URL);
  atlas.src = ATLAS_URL;

  function ensureTexture(sc) {
    if (sc.textures.exists(KEY)) return true;
    if (!loaded) return false;
    const texture = sc.textures.addImage(KEY, atlas);
    for (let i=0; i<FRAMES; i++)
      texture.add(String(i), 0,
        (i%COLUMNS)*FRAME_WIDTH, Math.floor(i/COLUMNS)*FRAME_HEIGHT,
        FRAME_WIDTH, FRAME_HEIGHT);
    return true;
  }

  function attach(sc) {
    const coach = sc.coach;
    if (!coach || patched.has(coach) || !coach.approvedCoach || !ensureTexture(sc)) return;
    const original = coach.image;
    const movement = sc.add.image(0,0,KEY,'0')
      .setOrigin(.5,1)
      .setDisplaySize(35,64);
    // Existing body collision, navigation, depth sorting, shadow, and position are kept.
    coach.body.add(movement);
    patched.add(coach);
    const animate = coach.animate.bind(coach);
    const sprint = sc.input?.keyboard?.addKey?.('SHIFT');
    let lastFrame = -1;
    coach.animate = function(pose, dt) {
      const result = animate(pose, dt);
      const supported = coach.approvedCoach && (pose === 'idle' || pose === 'walk' || pose === 'run');
      original.setVisible(!supported);
      movement.setVisible(supported);
      if (!supported) return result;
      const action = pose === 'walk' && sprint?.isDown ? 'run' : pose;
      const direction = coach.facing === 'side'
        ? (coach.left ? 'left' : 'right')
        : (coach.facing === 'up' ? 'up' : 'down');
      const sequence = frames[action][direction];
      const fps = action === 'idle' ? 2 : action === 'run' ? 11 : 8;
      const index = sequence[Math.floor(coach.elapsed * fps) % sequence.length];
      if (index !== lastFrame) { movement.setFrame(String(index)); lastFrame = index; }
      // Pixel-align the sprite to the same subpixel origin as the old character.
      movement.setPosition(Math.round(coach.body.x)-coach.body.x,
                           Math.round(coach.body.y)-coach.body.y);
      return result;
    };
    coach.animate(coach.pose || 'idle', 0);
    sc.events.once('shutdown', () => {
      coach.animate = animate;
      if (original.active) original.setVisible(true);
      if (movement.active) movement.destroy();
    });
    window.CC_L1_MALE_COACH = {
      source: ATLAS_URL, frameCount: FRAMES, displaySize: [35,64],
      patched: true, scene: sc.scene?.key || sc.sys?.settings?.key || 'unknown',
      status: '32 user-supplied idle/walk/run frames; activity art unchanged'
    };
  }
  function scan() {
    if (!loaded) return;
    for (const sc of window.CC_GAME?.scene?.scenes || []) {
      if (!sc.sys?.isActive?.() || !sc.coach?.body || !sc.coach?.image) continue;
      // Only the player-controlled default male coach, not NPCs or seminar presenters.
      if (sc.coach.approvedCoach) attach(sc);
    }
  }
  setInterval(scan, 120);
  scan();
})();