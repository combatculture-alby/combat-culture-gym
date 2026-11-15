/* Combat Culture Gym: exact sprites extracted from the user's approved
   November 10 male/female customization sheets.
   Isolated /offline/ Level 1 build only; doesn't alter the production game.
   Character animation frames: 3 rows (idle/walk/run), 4 directions, 3 frames.
   Hairstyle/clothing artwork options will be a later asset pass. */
(() => {
  'use strict';
  const KEY = 'cc-l1-approved-coach-preset-v1';
  const ASSETS = {
    male: {texture:'cc-l1-approved-coach-male',src:'./level1-approved-coach-male.png?v=source-sheet-20261114'},
    female: {texture:'cc-l1-approved-coach-female',src:'./level1-approved-coach-female.png?v=source-sheet-20261114'}
  };
  const images = {};
  for (const [gender,asset] of Object.entries(ASSETS)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = asset.src;
    images[gender] = img;
  }
  const configured = new WeakSet();
  const dirs=['down','right','left','up'];
  const anims=['idle','walk','run'];
  const getPreset = () => {
    try {
      const p=localStorage.getItem(KEY);
      return p==='female' || p==='legacy' ? p : 'male';
    } catch { return 'male'; }
  };
  let preset=getPreset();
  function setPreset(mode) {
    if (!['male','female','legacy'].includes(mode)) return;
    preset=mode;
    try {localStorage.setItem(KEY,mode);} catch {}
    // Every active scene must use the same source, including other rooms.
    for (const sc of window.CC_GAME?.scene?.scenes || []) {
      if (sc.sys?.isActive?.() && sc.coach?.image && mode!=='legacy') apply(sc);
    }
  }
  function addTexture(sc, gender) {
    const asset=ASSETS[gender],img=images[gender],tm=sc.textures;
    if(tm.exists(asset.texture)) return true;
    if(!img.complete || img.naturalWidth!==576 || img.naturalHeight!==192) return false;
    tm.addImage(asset.texture,img);
    const texture=tm.get(asset.texture);
    for(let row=0;row<3;row++) for(let d=0;d<4;d++) for(let f=0;f<3;f++) {
      const name=anims[row]+'-'+dirs[d]+'-'+f;
      texture.add(name,0,(d*3+f)*48,row*64,48,64);
    }
    return true;
  }
  function apply(sc) {
    if (preset==='legacy' || !sc.coach?.image || !sc.coach?.body) return;
    if(!addTexture(sc,preset)) return;
    const key=ASSETS[preset].texture,coach=sc.coach;
    if(coach.image.texture?.key!==key) {
      coach.studentArt=null;
      coach.artActor=null;
      coach.approvedCoach=true;
      coach.frame=-1;
      coach.image.setTexture(key,'idle-down-0').setDisplaySize(43,57).setOrigin(.5,.9).setFlipX(false);
    }
    coach.approvedCoach=true;
    window.CC_L1_COACH_DIAGNOSTICS={
      selected:preset,texture:key,source:ASSETS[preset].src,
      sheetDimensions:[images[preset].naturalWidth,images[preset].naturalHeight],
      originalUserArt:true,frames:36
    };
  }
  function drawPresetMenu(sc) {
    if(sc.running) return;
    sc.clearIntent();
    sc.menuShell('YOUR COACH','APPROVED COACH SPRITES FROM YOUR SHEETS.',()=>sc.openBuildHub());
    const panel=sc.furniturePanel;
    for(const [gender,x] of [['male',158],['female',322]]) {
      if(!addTexture(sc,gender)) continue;
      const preview=sc.add.image(x,135,ASSETS[gender].texture,'idle-down-0')
        .setDisplaySize(65,88);
      panel.add(preview);
      panel.add(sc.add.text(x,186,gender.toUpperCase(),{
        fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#f2e3c9'
      }).setOrigin(.5));
      sc.panelButton(panel,gender.toUpperCase()+(preset===gender?'  ✓':''),
        x-70,203,140,27,()=>{setPreset(gender);apply(sc);drawPresetMenu(sc)},
        preset===gender,0x42646b);
    }
    panel.add(sc.add.text(87,75,'IDLE / WALK / RUN: 4 DIRECTIONS',{
      fontFamily:'Arial',fontSize:'10px',color:'#c9d7d7'
    }));
    panel.add(sc.add.text(87,242,'Hair, clothing & action variants are not extracted yet.',{
      fontFamily:'Arial',fontSize:'9px',color:'#b5c4c6'
    }));
  }
  function attach(sc) {
    if(configured.has(sc) || !sc.coach?.image) return;
    configured.add(sc);
    apply(sc);
    // Coach wardrobe is the native customization entrypoint. We keep its
    // original method intact but show the two source-accurate sprite presets
    // in Level 1; no replacement character art is generated.
    if(sc.gymLevel?.()===1 && typeof sc.openCoachWardrobe==='function') {
      sc.__ccOriginalCoachWardrobe=sc.openCoachWardrobe.bind(sc);
      sc.openCoachWardrobe=()=>drawPresetMenu(sc);
      // Preserve the entire Build menu and its original actions, adding
      // a fifth option so female selection is actually reachable.
      if(typeof sc.openBuildHub==='function' && typeof sc.panelButton==='function') {
        sc.__ccOriginalBuildHub=sc.openBuildHub.bind(sc);
        sc.openBuildHub=()=>{
          if(sc.running || sc.isPlacing()) return;
          sc.clearIntent();
          sc.menuShell('BUILD MODE','BUY, PLACE, MOVE, STORE OR SELL ITEMS.');
          const rows=[
            ['TRAINING GEAR',()=>sc.openGearShop()],
            ['FURNITURE',()=>sc.openFurniture('shop')],
            ['DECORATIONS',()=>window.dispatchEvent(new Event('cc-open-decorations'))],
            ['INVENTORY / MOVE / SELL',()=>sc.openFurniture('inventory')],
            ['YOUR COACH',()=>sc.openCoachWardrobe()]
          ];
          rows.forEach(([label,fn],index)=>
            sc.panelButton(sc.furniturePanel,label,84,76+index*34,310,29,fn,false,0x42646b));
          sc.buildMode=false;
        };
      }
    }
    sc.events?.once?.('shutdown',()=>configured.delete(sc));
  }
  function poll() {
    if(!window.CC_GAME?.scene?.scenes?.length) return;
    for(const sc of window.CC_GAME.scene.scenes) {
      if(!sc.sys?.isActive?.() || !sc.coach?.image) continue;
      if(!addTexture(sc,'male') || !addTexture(sc,'female')) continue;
      if(!configured.has(sc)) attach(sc);
      if(preset!=='legacy') apply(sc);
    }
  }
  const checker=setInterval(poll,180);
  poll();
  window.CC_L1_APPROVED_COACHES={getPreset:()=>preset,setPreset,assets:ASSETS};
})();