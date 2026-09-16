"""
Validate the built portal against the brief, in Blender.

Measured from the .blend at specific frames rather than inferred from the
script that wrote it: a build script reporting its own intentions back is not
a check, and three of the defects in this asset were things the counts said
were fine.
"""
import math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "assets", "blender", "portal-cinematic.blend"))
sc = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()


def bounds(frame, predicate=lambda o: True):
    sc.frame_set(frame)
    dg.update()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in bpy.data.objects:
        if o.type != "MESH" or not predicate(o):
            continue
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi


def rnd(v):
    return tuple(round(x, 4) for x in v)


print("=" * 62)
for f in (0, 450):
    lo, hi = bounds(f)
    print(f"portal bounds @{f:3d}  min {rnd(lo)}  max {rnd(hi)}  size {rnd(hi - lo)}")

# Shell final transform, measured as displacement from its resting pose.
sc.frame_set(0); dg.update()
rest = {o.name: o.matrix_world.translation.copy()
        for o in bpy.data.objects if o.name.startswith("SHELL_SEG_")}
sc.frame_set(450); dg.update()
R = 0.9475
worst_r = worst_deg = 0.0
for o in sorted(bpy.data.objects, key=lambda x: x.name):
    if not o.name.startswith("SHELL_SEG_"):
        continue
    d = (o.matrix_world.translation - rest[o.name]).length
    deg = abs(math.degrees(o.rotation_euler.z))
    worst_r = max(worst_r, d / R * 100)
    worst_deg = max(worst_deg, deg)
print(f"shell final: max displacement {worst_r:.2f}% of radius, max rotation {worst_deg:.2f} deg")

for nm in ("MechanicalRing_A", "MechanicalRing_B"):
    o = bpy.data.objects.get(nm)
    print(f"{nm} final rotation: {math.degrees(o.rotation_euler.z):+.2f} deg")

def radii(o, ev_dg, y_limit=None):
    """
    True radii from the ring axis, taken from VERTICES.

    bound_box was used first and gave two false failures: it is an
    axis-aligned box, so its corners on a curved sector sit well inside the
    sector's real inner radius, and the checks reported the shell obstructing a
    channel it was nowhere near. A curved solid has to be measured by its
    actual geometry.
    """
    ev = o.evaluated_get(ev_dg)
    me = ev.to_mesh()
    out = []
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        if y_limit is None or abs(w.y) < y_limit:
            out.append(math.hypot(w.x, w.z - 0.94))
    ev.to_mesh_clear()
    return out


# Does anything cross the energy channel once it has ignited?
sc.frame_set(270); dg.update()
emit_max = max(r for o in bpy.data.objects if o.name.startswith("EMIT_") for r in radii(o, dg))
shell_min = min(r for o in bpy.data.objects if o.name.startswith("SHELL_SEG_") for r in radii(o, dg))
print(f"@270 energy channel outer {emit_max:.4f}, nearest shell edge {shell_min:.4f} -> "
      f"{'CLEAR' if shell_min > emit_max else 'OBSTRUCTED'}")

# Clear bore for the camera at frame 450.
sc.frame_set(450); dg.update()
bore = min(
    (r for o in bpy.data.objects if o.type == "MESH" for r in radii(o, dg, y_limit=1.2)),
    default=0.0,
)
print(f"@450 clear bore radius {bore:.4f} ({bore / R * 100:.1f}% of portal radius)")

# Nothing may jump at the end.
a, _ = bounds(449)
b, _ = bounds(450)
print(f"frame 449->450 bounds delta {(b - a).length:.6f} (0 = no jump)")
print("=" * 62)
