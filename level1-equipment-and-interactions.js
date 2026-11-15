/* Consistency and interactions for the isolated Combat Culture Gym Level 1 build. */
(() => {
  'use strict';
  const bound = new WeakSet();
  const decorated = new WeakSet();
  const ART = {
    0:'approved-garage-heavy-bag',
    1:'approved-garage-garage-thai-pads',
    2:'approved-garage-garage-speed-bag',
    3:'approved-garage-jump-rope',
    4:'approved-garage-weight-bench',
    5:'approved-garage-kettlebells',
    8:'approved-garage-garage-focus-mitts',
    9:'approved-garage-dumbbells',
    10:'approved-garage-freestanding-bag',
    14:'approved-garage-bands'
  };
  const EXTRA = {...ART,3:'garage-mounted-jump-rope'};
  const WALL = new Set([1,3,8,14]);
  const BUY_MENU = /SHOP|TRAINING GEAR|ORDER|SUPPL|UPGRADE|DECORATION|EXPANSION|SEMINAR|PURCHASE|BUILD|INVENTORY|FURNITURE|CLOTHING/i;
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function activeScene() {
    return window.CC_GAME?.scene?.scenes?.find(s =>
      s.sys?.isActive?.() && s.__ccNov13Bound && s.furniturePanel &&
      typeof s.drawEquipment === 'function' && typeof s.playerRoute === 'function');
  }
  function normalizeCopies(sc) {
    if (sc.gymLevel() !== 1) return;
    const objects = sc.saveData?.extraGear || [];
    const used = new Set();
    for (const obj of objects) {
      if (obj.stored || !Number.isFinite(obj.x) || !Number.isFinite(obj.y)) continue;
      const artKey = ART[obj.i], originalKey = EXTRA[obj.i];
      if (!artKey || !sc.textures.exists(artKey)) continue;
      const sprite = sc.worldFixtures.find(v =>
        v?.texture && !used.has(v) &&
        v.texture.key === originalKey &&
        Math.abs(v.x-obj.x)<2 && Math.abs(v.y-obj.y)<2);
      if (!sprite) continue;
      used.add(sprite);
      const wall = WALL.has(obj.i);
      const ry = sc.gearBounds(obj.i).ry;
      const size = sc.garageGearArtSize(obj.i);
      const y = obj.y + (wall ? 0 : ry);
      // The original gear renderer preserves aspect and anchors non-wall art
      // at floor level y + gear bounds. Purchased copies must do the same.
      sprite.setTexture(artKey).setOrigin(.5,wall?.5:1).setPosition(obj.x,y);
      sprite.setScale(Math.min(size.w/sprite.width,size.h/sprite.height));
      sprite.setDepth(wall?2:10+y/100-.04);
      if (obj.i === 0) sprite.setFlipX(sc.saveData.heavyBagFlipped === true);
    }
  }
  function approachPoints(sc,z) {
    const bounds=z.getBounds?.(),w=Math.max(16,bounds?.width||z.width||24),
      h=Math.max(16,bounds?.height||z.height||24);
    const x=z.x,y=z.y, wall=y<101, front=wall?123:y+h/2+15,
      sideY=wall?123:Math.max(120,Math.min(202,y));
    const candidates=[
      {x,y:front},{x:x-14,y:front},{x:x+14,y:front},
      {x:x-w/2-17,y:sideY},{x:x+w/2+17,y:sideY},
      {x,y:y-h/2-15},{x:x-w/2-8,y:y-h/2-14},
      {x:x+w/2+8,y:y-h/2-14}
    ];
    return candidates.filter(p=>sc.canStand(p.x,p.y)).sort((a,b)=>
      distance(sc.player,a)-distance(sc.player,b));
  }
  function walkToInteract(sc,z,action,label) {
    if (sc.running || sc.isPlacing() || sc.furniturePanel.visible || sc.rosterPanel.visible) return;
    const choices=approachPoints(sc,z);
    for (const dest of choices) {
      if (distance(sc.player,dest)<16) { action(); return; }
      const path=sc.playerRoute(dest,true);
      if (!path?.length) continue;
      sc.clearIntent();
      sc.route=path;
      sc.__ccPendingObject={dest,action,label,elapsed:0};
      sc.say('Walking to '+label+'.');
      return;
    }
    sc.say('No clear path to '+label+'.');
  }
  function wrap(sc,obj,label='object') {
    if (decorated.has(obj) || !obj?.input || typeof obj.listeners!=='function') return;
    const handlers=obj.listeners('pointerdown');
    if (!handlers.length) return;
    decorated.add(obj);
    obj.removeAllListeners('pointerdown');
    obj.on('pointerdown',(pointer,x,y,event)=>{
      event?.stopPropagation?.();
      // Reuse the object's own gameplay handler after the character arrives.
      const deferred={stopPropagation(){}};
      walkToInteract(sc,obj,()=>handlers.forEach(fn=>fn.call(obj,pointer,x,y,deferred)),label);
    });
  }
  function attachInteractionZones(sc) {
    for (const obj of sc.worldFixtures || []) {
      if (!obj?.input || typeof obj.getBounds!=='function') continue;
      const label=(obj.texture?.key||'object').replace(/^(approved-garage-|cc-furn-|cc-l1-)/,'').replace(/-/g,' ');
      wrap(sc,obj,label);
    }
    for (const z of sc.__ccDoorControls||[]) wrap(sc,z,'the door');
  }
  function preserveNewWall(sc) {
    // Retire any still-visible obsolete brick strips. The new 480x96
    // image from the supplied "New wall.png" is installed by the user-art script.
    if (!sc.textures.exists('cc-l1-exact-original-wall-2048x682')) return;
    for (const v of sc.children.list)
      if (v.texture?.key==='cc-approved-brick-row') v.setVisible(false);
  }
  function attach(sc) {
    if (bound.has(sc)) return;
    bound.add(sc);
    // Show money inside the existing menu header subtitle. The previous
    // separately drawn text floated above the close/back controls.
    const originalMenuShell = sc.menuShell.bind(sc);
    sc.menuShell = function(title, ...args) {
      const result = originalMenuShell(title, ...args);
      const panel = args[2] || sc.furniturePanel;
      if (panel !== sc.furniturePanel || !BUY_MENU.test(String(title))) return result;
      const subtitle = sc.furniturePanel.list.find(obj =>
        typeof obj.setText === 'function' &&
        Math.abs(obj.x - 83) < 0.5 && Math.abs(obj.y - 52) < 0.5);
      if (subtitle) {
        const money = 'CASH 
    const draw=sc.drawEquipment.bind(sc);
    sc.drawEquipment=function(...args) {
      const result=draw(...args);
      normalizeCopies(sc);
      attachInteractionZones(sc);
      preserveNewWall(sc);
      return result;
    };
    sc.drawEquipment();
    const onUpdate=(_time,delta)=>{
      attachInteractionZones(sc);
      preserveNewWall(sc);
      const pending=sc.__ccPendingObject;
      if (!pending) return;
      pending.elapsed+=Math.min(delta||16,250)/1000;
      if (distance(sc.player,pending.dest)<18) {
        sc.__ccPendingObject=null;
        sc.route=[];
        pending.action();
      } else if (pending.elapsed>10 || (pending.elapsed>.6 && !sc.route?.length)) {
        sc.__ccPendingObject=null;
        sc.say('Cannot reach '+pending.label+'.');
      }
    };
    sc.events.on('update',onUpdate);
    sc.events.once('shutdown',()=>{
      sc.events.off('update',onUpdate);
      sc.__ccPendingObject=null;
    });
  }
  setInterval(()=>{
    const sc=activeScene();
    if (sc && sc.gymLevel()===1) attach(sc);
  },150);
})(); + sc.saveData.money;
        const source = String(args[0] || '').trim();
        let left = source, suffix = left ? '  |  ' : '';
        subtitle.setText(left + suffix + money);
        while (subtitle.width > 230 && left.length) {
          left = left.slice(0, -1);
          subtitle.setText(left.trimEnd() + '…' + suffix + money);
        }
      }
      return result;
    };

    // The root Build Inventory menu is created by the wall-decor module.
    // Its FURNITURE button calls openInventoryCategory('furniture'), but
    // that native method silently returns when any old placement flag is
    // still set. Clear that orphan state before opening the inventory.
    const originalOpenInventory = sc.openInventoryCategory.bind(sc);
    sc.openInventoryCategory = function(kind, ...args) {
      if (kind === 'furniture' && !sc.running) {
        if (sc.isPlacing()) sc.cancelPlacement();
        sc.buildPage = Math.max(0, sc.buildPage || 0);
      }
      const result = originalOpenInventory(kind, ...args);
      if (kind === 'furniture' && !sc.running) {
        // Do not leave the inventory hidden behind an older panel.
        sc.rosterPanel.setVisible(false);
        sc.furniturePanel.setVisible(true);
        window.CC_L1_FURNITURE_INVENTORY_OPEN = sc.furniturePanel.list.some(
          obj => typeof obj.text === 'string' &&
            obj.text.includes('FURNITURE  /  MOVE'));
      }
      return result;
    };
    // Clear stuck placement when entering the inventory root, too, so
    // opening either furniture or training gear is reliable.
    const originalOpenFurniture = sc.openFurniture.bind(sc);
    sc.openFurniture = function(which, ...args) {
      if (which === 'inventory' && sc.isPlacing()) sc.cancelPlacement();
      return originalOpenFurniture(which, ...args);
    };
    const draw=sc.drawEquipment.bind(sc);
    sc.drawEquipment=function(...args) {
      const result=draw(...args);
      normalizeCopies(sc);
      attachInteractionZones(sc);
      preserveNewWall(sc);
      return result;
    };
    sc.drawEquipment();
    const onUpdate=(_time,delta)=>{
      attachInteractionZones(sc);
      preserveNewWall(sc);
      const pending=sc.__ccPendingObject;
      if (!pending) return;
      pending.elapsed+=Math.min(delta||16,250)/1000;
      if (distance(sc.player,pending.dest)<18) {
        sc.__ccPendingObject=null;
        sc.route=[];
        pending.action();
      } else if (pending.elapsed>10 || (pending.elapsed>.6 && !sc.route?.length)) {
        sc.__ccPendingObject=null;
        sc.say('Cannot reach '+pending.label+'.');
      }
    };
    sc.events.on('update',onUpdate);
    sc.events.once('shutdown',()=>{
      sc.events.off('update',onUpdate);
      sc.__ccPendingObject=null;
    });
  }
  setInterval(()=>{
    const sc=activeScene();
    if (sc && sc.gymLevel()===1) attach(sc);
  },150);
})();