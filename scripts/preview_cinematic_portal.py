"""
Render frames from the built .blend, headless.

Proof rather than trust. The build script reports object and keyframe counts,
but counts cannot tell you whether the shell opens the right way, whether the
sections still read as one ring while they move, or whether the machine is
visible underneath when they do. Only looking can.

Deliberately separate from the build: rendering has nothing to do with
producing the asset, and a build step that quietly needs a camera and a light
is a build step that breaks the moment someone renders it differently.
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(HERE, "assets", "blender", "portal-cinematic.blend")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/portal-preview"
FRAMES = [int(f) for f in (sys.argv[2].split(",") if len(sys.argv) > 2 else [0, 165, 260, 330, 450])]

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene

# The portal faces -Y in Blender after the Z-up conversion, so the camera sits
# on -Y looking back at it, level with the ring's centre.
bpy.ops.object.camera_add(location=(0, -4.6, 0.94), rotation=(math.radians(90), 0, 0))
sc.camera = bpy.context.active_object
sc.camera.data.lens = 45

bpy.ops.object.light_add(type="AREA", location=(2.4, -3.2, 2.8))
key = bpy.context.active_object
key.data.energy = 900
key.data.size = 5
bpy.ops.object.light_add(type="AREA", location=(-3.0, -2.4, 0.6))
fill = bpy.context.active_object
fill.data.energy = 260
fill.data.size = 6

for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        sc.render.engine = engine
        break
    except TypeError:
        continue
print(f"[preview] engine {sc.render.engine}", flush=True)

sc.render.resolution_x = 720
sc.render.resolution_y = 480
sc.render.image_settings.file_format = "PNG"
sc.render.film_transparent = False

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
for f in FRAMES:
    sc.frame_set(f)
    sc.render.filepath = f"{OUT}-{f:04d}.png"
    bpy.ops.render.render(write_still=True)
    print(f"[preview] frame {f} -> {sc.render.filepath}", flush=True)
