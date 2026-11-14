#!/usr/bin/env python3
"""Export original embedded Level 1 pixel art into edit-ready PNGs."""
from pathlib import Path
from PIL import Image
import base64, io, json, re, zipfile

root=Path(__file__).resolve().parents[1]
html=(root/"approved-level1-parts"/"part-000.txt").read_text()
match=re.search(r"const source=\{(.*?)\};\s*const loaded=\{\};", html, re.S)
if not match:
    raise SystemExit("Cannot find embedded Level 1 native art source.")
entries=dict(re.findall(r'"([\w-]+)":"data:image/png;base64,([A-Za-z0-9+/=]+)"',match.group(1)))
names={
  "garage": "garage_closed",
  "exterior-garage": "garage_open",
  "garage-frame": "garage_frame",
  "side": "side_door_closed",
  "exterior-side": "side_door_open",
  "side-frame": "side_door_frame",
  "lamp": "ceiling_light",
  "wall": "wall_reference"
}
out=root/"exports"/"level1-editable"
out.mkdir(parents=True,exist_ok=True)
manifest=[]
for key,name in names.items():
    if key not in entries: raise SystemExit("Missing asset: "+key)
    data=base64.b64decode(entries[key])
    im=Image.open(io.BytesIO(data)).convert("RGBA")
    width,height=im.size
    for scale in [1,4,8]:
        folder=out/("original" if scale==1 else f"edit-{scale}x")
        folder.mkdir(exist_ok=True)
        output=folder/f"{name}_{width*scale}x{height*scale}.png"
        im.resize((width*scale,height*scale),Image.Resampling.NEAREST).save(output)
    manifest.append(dict(key=key,name=name,original_size=[width,height]))
readme=("Combat Culture Gym - editable native Level 1 sprite pack\n\n"
        "These are exported from the ORIGINAL PNG data embedded in the approved\n"
        "Level 1 build, NOT cropped from the screenshot.\n\n"
        "Use files in edit-8x/ to edit large, pixel-sharp images. Keep the\n"
        "pixel grid, transparency and original overall proportions.\n"
        "Files in original/ are the exact original-resolution artwork.\n"
        "edit-4x/ provides a smaller editing option.\n\n"
        "The game uses native pixel-art dimensions. Upscaling with nearest-\n"
        "neighbor makes editing easier but does not invent additional detail.\n"
        "Edited 8x PNGs can be resized down to native size for integration.\n\n"
        "The wall is supplied as REFERENCE ONLY.\n")
(out/"README.txt").write_text(readme)
(out/"manifest.json").write_text(json.dumps(manifest,indent=2))
zip_path=root/"exports"/"combat-culture-gym-level1-EDITABLE-SPRITES.zip"
with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED) as z:
    for file in out.rglob("*"):
        if file.is_file(): z.write(file,arcname=str(file.relative_to(out.parent)))
print(zip_path,zip_path.stat().st_size)
