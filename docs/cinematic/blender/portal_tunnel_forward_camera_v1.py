"""
PORTAL TUNNEL — FORWARD CAMERA FIX

Replaces the camera animation with a single monotonic run down the tunnel
axis. Geometry, materials and the beauty lighting are untouched.

WHAT WAS WRONG

The V10 CameraAction was not a forward move at all. Sampled every frame, its Y
position reverses 45 times in 89 steps:

    f1  y=3.654   f15 y=2.012   f30 y=0.252     travelling forward
    f45 y=5.132                                 jumps back past its own start
    f60 y=-2.281                                forward again
    f75 y=2.231   f90 y=6.743                   ends further out than it began

and the focal length is animated too, oscillating across ninety distinct values
between 24mm and 28mm. Those two together are exactly the reported symptom:
the tunnel appearing to grow, shrink, grow again, and finally retreat to a
distant circle. It was never a website problem — the video layer animates
opacity only, with no transform and no scale.

THE GEOMETRY, MEASURED

    portal ring   Y  -0.36 ..  1.53
    tunnel        Y   1.91 .. 13.76
    black core    Y   8.45

The camera is rotated 90 degrees about X, so its -Z faces +Y: forward is
INCREASING Y. The run therefore starts just inside the mouth and ends just
short of the core, where the core fills the frame and becomes the cover for
the handoff.

WHY EVERY FRAME IS KEYED

The path is baked per frame with LINEAR interpolation rather than left to a
handful of Bezier keys. Bezier handles between sparse keys can overshoot, and
an overshoot on this axis is a reversal — the precise failure being fixed. A
baked linear curve cannot move backwards between two increasing values.
"""

import os
import math
import bpy

BLEND = "/Users/SarthakSethi/portal_cinematic_tunnel_beauty.blend"

# Measured from the scene, not guessed.
TUNNEL_Y_START = 1.910
BLACK_CORE_Y = 8.45
TUNNEL_Z_CENTRE = 0.94

# Just inside the mouth, to just short of the core.
Y_FROM = TUNNEL_Y_START + 0.20
Y_TO = BLACK_CORE_Y - 0.35
LENS = 28.0


def log(m):
    print(f"[fwd] {m}", flush=True)


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    cam = scene.camera
    log(f"camera={cam.name} frames={scene.frame_start}-{scene.frame_end}")

    # Clear the old action outright. Editing it in place would leave whichever
    # of its keys happened not to be overwritten.
    if cam.animation_data:
        cam.animation_data_clear()
    if cam.data.animation_data:
        cam.data.animation_data_clear()
    log("cleared previous camera + lens animation")

    """
    Fixed everywhere except the travel axis.

    Height, lateral position, orientation and focal length are all constant, so
    nothing but distance down the tunnel can change. The rotation is exactly a
    quarter turn rather than the original 1.583 radians, which was half a degree
    off axis and put a slight drift on a shot that should be dead straight.
    """
    cam.location = (0.0, Y_FROM, TUNNEL_Z_CENTRE)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
    cam.data.lens = LENS

    f0, f1 = scene.frame_start, scene.frame_end
    span = max(1, f1 - f0)

    for f in range(f0, f1 + 1):
        u = (f - f0) / span
        """
        A gently accelerating run, never a decelerating one.

        u**1.2 has a derivative that only increases, so the camera speeds up
        slightly as it goes and at no point slows, stops or reverses. It also
        picks up where the live approach leaves off — that shot is accelerating
        into the ring, and matching its sense of momentum is what keeps the
        crossing feeling like one continuous movement.
        """
        p = u ** 1.2
        y = Y_FROM + (Y_TO - Y_FROM) * p

        cam.location = (0.0, y, TUNNEL_Z_CENTRE)
        cam.keyframe_insert(data_path="location", frame=f)

    # Force linear on every key: no handle can then carry the curve backwards.
    act = cam.animation_data.action if cam.animation_data else None
    if act:
        curves = []
        if hasattr(act, "fcurves"):
            curves = list(act.fcurves)
        else:
            for layer in getattr(act, "layers", []):
                for strip in getattr(layer, "strips", []):
                    for bag in getattr(strip, "channelbags", []):
                        curves.extend(bag.fcurves)
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
            fc.update()
        log(f"baked {len(curves)} fcurves to LINEAR")

    # ---- verify before saving: the whole point is monotonicity ----
    dg = bpy.context.evaluated_depsgraph_get()
    ys, lenses = [], set()
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        dg.update()
        ys.append(cam.matrix_world.translation.y)
        lenses.add(round(cam.data.lens, 3))
    deltas = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
    reversals = sum(1 for d in deltas if d <= 0)
    log(f"Y {ys[0]:.3f} -> {ys[-1]:.3f}  reversals={reversals}  lens={lenses}")
    if reversals:
        raise RuntimeError(f"camera still reverses on {reversals} frames")

    for f in (1, 30, 60, 90):
        scene.frame_set(f)
        dg.update()
        log(f"  f{f:3d} y={cam.matrix_world.translation.y:.3f}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    log(f"saved {BLEND}")
    print("FORWARD CAMERA FIX COMPLETE", flush=True)


if __name__ == "__main__":
    main()
