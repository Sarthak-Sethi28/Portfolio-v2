"""
Build the cinematic portal in Blender.

Run headless:
    ./.blender-venv/bin/python scripts/build_cinematic_portal.py

This is real Blender (bpy 5.0.1, blender-v5.0-release), not a Three.js
approximation. The pipeline is Blender -> .blend -> animated .glb -> R3F, and
the animation baked here is the authority; React only plays it.

WHAT IT BUILDS

The generated asset is the ACTIVE portal: the detailed red/black/gold machine.
It is imported untouched and hidden underneath a DORMANT SHELL of large
segmented stone sections — the plain ring the day homepage shows. Nothing about
the arrival hints that there is a machine in there, because the machine is
physically occluded rather than merely unlit.

The shell then opens, and what is revealed was always there.

    PORTAL_ROOT
      PORTAL_ACTIVE      the imported machine, untouched
      SHELL              14 radial sections, beveled, genuinely thick
      MECH_INNER         concentric layer, rotates one way
      MECH_OUTER         concentric layer, rotates the other
      EMISSIVE           12 separately addressable red arcs
      INDICATORS         small green markers

WEIGHT

The shell sections do not fly away. Each one withdraws along its own radius by
a few percent of the ring, tilts a little, and sinks back in Z — the motion of
a bank vault, not of debris. Heavy things move a short distance slowly and
their mass is read from how reluctantly they start, so every shell curve is
eased at both ends and the sections are staggered rather than released
together.

ONE LIMITATION, STATED PLAINLY

glTF animation can only carry translation, rotation, scale and morph weights.
It CANNOT carry animated material properties, so the ignition travelling round
the ring is not exported as emission keyframes — it cannot be. The emissive
arcs are therefore separate named objects animated by SCALE, which does export,
and their emission strength is left for R3F to drive by name. Anything else
would be a lie about what is in the file.
"""

import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

# ---------------------------------------------------------------- paths
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GLB = os.path.join(HERE, "assets", "blender", "base_basic_pbr.glb")
OUT_GLB = os.path.join(HERE, "public", "models", "portal-cinematic.glb")
OUT_BLEND = os.path.join(HERE, "assets", "blender", "portal-cinematic.blend")

# ---------------------------------------------------------------- timeline
FPS = 30
F_END = 450

# Provisional beats, in frames. These are placeholders until the real timing
# arrives; every value the animation uses is named here so retiming is a change
# to this block and nothing else.
F_HOLD_END = 120      # dormant, nothing moves
F_SHELL_OPEN = 210    # the shell withdraws
F_MECH_START = 190    # layers begin counter-rotating, overlapping the opening
F_IGNITE_START = 240  # light begins travelling the ring
F_IGNITE_END = 330
F_FULL = 360          # full power, held to the end

SHELL_SECTIONS = 14
EMISSIVE_ARCS = 12
INDICATORS = 10


def log(msg):
    print(f"[portal] {msg}", flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start = 0
    sc.frame_end = F_END


def ring_plane(e):
    """
    Stand a group up into the ring's plane.

    The glTF importer converts Y-up to Z-up, so the asset arrives lying in
    Blender's XZ plane with its thickness along Y — measured, not assumed:
    the bounding box comes back 1.895 wide, 0.715 deep, 1.879 tall. Everything
    built here is authored flat in XY because that is the sane plane to lay out
    an annulus in, and then the whole group is tipped up to meet the asset.

    Tipping the PARENT rather than each piece matters: children keep their own
    local axes, so a section's local Z rotation is still a spin about the ring's
    axis and its local XY offset is still radial. Had each piece been rotated
    individually, every offset and twist below would need rewriting in world
    space, which is how sign errors get in.
    """
    e.rotation_euler = (math.radians(90), 0, 0)
    return e


def empty(name, parent=None, location=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    e.empty_display_size = 0.15
    e.location = location
    bpy.context.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


def arc_solid(name, r_in, r_out, a0, a1, depth, steps=10):
    """
    An annular sector with real thickness, built vertex by vertex.

    Not a boolean of two cylinders: booleans on this many sections produce
    degenerate geometry at the seams often enough that the export becomes a
    lottery, and the result cannot be beveled cleanly. Laying the ring of
    vertices down directly gives quads all the way round, which bevel and
    normals both like.
    """
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()

    half = depth / 2.0
    front_in, front_out, back_in, back_out = [], [], [], []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        c, s = math.cos(a), math.sin(a)
        front_in.append(bm.verts.new((c * r_in, s * r_in, half)))
        front_out.append(bm.verts.new((c * r_out, s * r_out, half)))
        back_in.append(bm.verts.new((c * r_in, s * r_in, -half)))
        back_out.append(bm.verts.new((c * r_out, s * r_out, -half)))

    for i in range(steps):
        bm.faces.new((front_in[i], front_out[i], front_out[i + 1], front_in[i + 1]))
        bm.faces.new((back_in[i + 1], back_out[i + 1], back_out[i], back_in[i]))
        bm.faces.new((front_out[i], back_out[i], back_out[i + 1], front_out[i + 1]))
        bm.faces.new((back_in[i], back_in[i + 1], front_in[i + 1], front_in[i]))
    # Cap the two radial ends, so each section is a closed solid and reads as a
    # cut stone rather than as a shell with open sides.
    bm.faces.new((front_in[0], front_out[0], back_out[0], back_in[0]))
    bm.faces.new((back_in[steps], back_out[steps], front_out[steps], front_in[steps]))

    bm.normal_update()
    bm.to_mesh(me)
    bm.free()

    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)

    # A real chamfer on every arris. Without it the sections read as cut from
    # paper however thick they actually are, because nothing catches a highlight
    # along the edges.
    bev = ob.modifiers.new("Bevel", "BEVEL")
    bev.width = min(depth * 0.06, (r_out - r_in) * 0.06)
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(35)
    return ob


def material(name, base, rough=0.6, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m


def key(ob, path, frame, value, index=-1):
    if index >= 0:
        getattr(ob, path)[index] = value
    else:
        setattr(ob, path, value)
    ob.keyframe_insert(data_path=path, frame=frame, index=index)


def action_fcurves(action):
    """
    Every fcurve in an action, on Blender 5 or earlier.

    Blender 4.4 introduced slotted actions and 5.0 finished the job:
    `action.fcurves` is gone, and curves now live under
    layers -> strips -> channelbags. Both shapes are handled because the
    version of bpy that pip resolves is not something this script controls.
    """
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


def ease(ob):
    """Heavy things start and stop reluctantly."""
    if not (ob.animation_data and ob.animation_data.action):
        return
    for fc in action_fcurves(ob.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN_OUT"


# ---------------------------------------------------------------- build
def main():
    if not os.path.exists(SRC_GLB):
        log(f"ERROR: source asset not found at {SRC_GLB}")
        sys.exit(1)

    reset()
    log(f"Blender {bpy.app.version_string}")

    # ---- the active machine, imported and left alone ----
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC_GLB)
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    log(f"imported {len(imported)} objects ({len(meshes)} meshes)")

    root = empty("PORTAL_ROOT")
    active = empty("PORTAL_ACTIVE", root)

    # Measure rather than assume. Every dimension below is derived from the
    # asset's own bounding box, so a re-export at another size still builds a
    # shell that fits it.
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    size = hi - lo
    centre = (hi + lo) / 2.0
    R = size.x / 2.0
    # Thickness is the asset's Y after the Z-up conversion. Reading size.z here
    # took the ring's HEIGHT instead and produced a shell 2.35 units deep
    # around a ring 0.72 thick — a barrel, not a ring.
    THICK = size.y
    log(f"asset bbox {tuple(round(v,3) for v in size)} centre {tuple(round(v,3) for v in centre)}")

    # Reparent the imported hierarchy under PORTAL_ACTIVE without moving it.
    for o in imported:
        if o.parent is None:
            o.parent = active
            o.matrix_parent_inverse = active.matrix_world.inverted()

    # The whole assembly is built about the ring's centre, so rotations happen
    # about the ring and not about the model's feet.
    root.location = centre
    active.location = -centre

    # ---- dormant shell ----
    shell = ring_plane(empty("SHELL", root))
    stone = material("ShellStone", (0.44, 0.42, 0.39), rough=0.85)

    # Matched to the machine's own aperture, so the dormant ring reads as the
    # day homepage rather than as a disc with a small hole. Pulling it in to
    # 0.42 did hide the emissive, but it closed the opening down to something
    # the day ring never had.
    r_in = R * 0.50
    r_out = R * 1.07
    depth = THICK * 1.3
    # A JOINT, not a gap. At 1.6 degrees a side the shell rendered as a paper
    # fan: nearly a fifth of the ring was air and the sections read as blades
    # rather than as masonry. Stone in a ring touches — the structure stands
    # because each piece presses on its neighbours.
    seam = math.radians(0.35)
    step = math.tau / SHELL_SECTIONS

    shell_secs = []
    for i in range(SHELL_SECTIONS):
        a0 = i * step + seam
        a1 = (i + 1) * step - seam
        ob = arc_solid(f"SHELL_SEG_{i:02d}", r_in, r_out, a0, a1, depth, steps=12)
        ob.data.materials.append(stone)
        ob.parent = shell
        # Each section pivots about the ring centre, which is the origin of this
        # local space, so no pivot juggling is needed later.
        shell_secs.append((ob, (a0 + a1) / 2.0))
    log(f"shell: {len(shell_secs)} sections, r {r_in:.3f}..{r_out:.3f}, depth {depth:.3f}")

    # ---- two concentric mechanical layers, counter-rotating ----
    mech_in = ring_plane(empty("MECH_INNER", root))
    mech_out = ring_plane(empty("MECH_OUTER", root))
    gold = material("MechGold", (0.72, 0.55, 0.25), rough=0.35, metal=0.9)
    iron = material("MechIron", (0.13, 0.14, 0.15), rough=0.5, metal=0.8)

    # SET BACK INTO THE THROAT, not across the opening.
    #
    # These first sat at 0.54..0.66R and 0.70..0.80R in the ring's own plane,
    # which put the gold layer straight across the aperture — it rendered as a
    # solid cylinder plugging the way through, and the opening is the one part
    # of a portal that has to stay open. Recessed behind the machine they are
    # seen THROUGH the aperture instead, turning against each other down the
    # bore, which is what "a deeper mechanism awakens" should look like.
    #
    # Both are annuli with clear centres, so the line of sight through the
    # portal survives however far they are pushed back.
    mech_in.location = (0, THICK * 1.4, 0)
    mech_out.location = (0, THICK * 2.6, 0)
    for idx in range(10):
        a0 = idx * math.tau / 10 + math.radians(1.2)
        a1 = (idx + 1) * math.tau / 10 - math.radians(1.2)
        o = arc_solid(f"MECH_INNER_{idx:02d}", R * 0.30, R * 0.44, a0, a1, THICK * 0.45, steps=8)
        o.data.materials.append(gold)
        o.parent = mech_in
    for idx in range(16):
        a0 = idx * math.tau / 16 + math.radians(1.0)
        a1 = (idx + 1) * math.tau / 16 - math.radians(1.0)
        o = arc_solid(f"MECH_OUTER_{idx:02d}", R * 0.34, R * 0.50, a0, a1, THICK * 0.38, steps=6)
        o.data.materials.append(iron)
        o.parent = mech_out

    # ---- separately addressable emissive arcs ----
    emissive = ring_plane(empty("EMISSIVE", root))
    for i in range(EMISSIVE_ARCS):
        a0 = i * math.tau / EMISSIVE_ARCS + math.radians(1.2)
        a1 = (i + 1) * math.tau / EMISSIVE_ARCS - math.radians(1.2)
        # Moved OUTSIDE the shell's inner edge rather than astride it, so the
        # shell's own body covers them end to end while it is closed. Sitting at
        # 0.475..0.525 against a shell starting at 0.50, half of every arc was
        # in the open aperture and the red ring showed in the dormant frame.
        o = arc_solid(f"EMIT_{i:02d}", R * 0.53, R * 0.58, a0, a1, THICK * 0.30, steps=6)
        # Its own material per arc: R3F drives emission by name, and shared
        # materials would light the whole ring at once.
        o.data.materials.append(
            material(f"EmitRed_{i:02d}", (0.10, 0.01, 0.01), rough=0.4,
                     emit=(1.0, 0.16, 0.07), emit_strength=6.0)
        )
        o.parent = emissive

    # ---- green indicators ----
    ind = ring_plane(empty("INDICATORS", root))
    green = material("IndicatorGreen", (0.02, 0.09, 0.04), rough=0.3,
                     emit=(0.23, 1.0, 0.53), emit_strength=9.0)
    for i in range(INDICATORS):
        a = i * math.tau / INDICATORS + math.radians(9)
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        o = bpy.context.active_object
        o.name = f"IND_{i:02d}"
        o.scale = (R * 0.012, R * 0.030, R * 0.012)
        o.location = (math.cos(a) * R * 0.86, math.sin(a) * R * 0.86, THICK * 0.30)
        o.rotation_euler = (0, 0, a)
        o.data.materials.append(green)
        o.parent = ind

    # ------------------------------------------------------------ animation
    # SHELL: withdraws. Short travel, long time, staggered.
    for i, (ob, mid) in enumerate(shell_secs):
        lag = int((i % 5) * 9)
        o0, o1 = F_HOLD_END + lag, F_SHELL_OPEN + lag
        out = R * 0.085
        key(ob, "location", o0, 0.0, 0); key(ob, "location", o0, 0.0, 1); key(ob, "location", o0, 0.0, 2)
        key(ob, "location", o1, math.cos(mid) * out, 0)
        key(ob, "location", o1, math.sin(mid) * out, 1)
        key(ob, "location", o1, -depth * 0.55, 2)
        key(ob, "rotation_euler", o0, 0.0, 2)
        key(ob, "rotation_euler", o1, math.radians(3.2) * (1 if i % 2 else -1), 2)
        ease(ob)

    # MECH: opposite rotations, starting before the shell finishes so the
    # machine is already turning when it comes into view.
    # The mechanism does not EXIST until the shell lets go of it.
    #
    # Recessing it into the throat was not enough: an annulus down the bore is
    # still an annulus you can see through an open aperture, and at rest the
    # gold layer was plainly visible in the middle of a ring that is supposed
    # to look like dead stone. Scale is the only channel glTF carries that can
    # take something out of the frame entirely, so the layers grow into place
    # as the shell withdraws.
    for grp in (mech_in, mech_out):
        for child in grp.children:
            key(child, "scale", F_HOLD_END, 0.001, 0)
            key(child, "scale", F_HOLD_END, 0.001, 1)
            key(child, "scale", F_HOLD_END, 0.001, 2)
            key(child, "scale", F_SHELL_OPEN, 1.0, 0)
            key(child, "scale", F_SHELL_OPEN, 1.0, 1)
            key(child, "scale", F_SHELL_OPEN, 1.0, 2)
            ease(child)

    key(mech_in, "rotation_euler", F_MECH_START, 0.0, 2)
    key(mech_in, "rotation_euler", F_END, math.radians(52), 2)
    key(mech_out, "rotation_euler", F_MECH_START, 0.0, 2)
    key(mech_out, "rotation_euler", F_END, math.radians(-34), 2)
    ease(mech_in); ease(mech_out)

    # EMISSIVE: scale is the only channel glTF will carry, so the arcs appear
    # in turn around the ring. Emission strength is R3F's job.
    arcs = sorted([o for o in bpy.data.objects if o.name.startswith("EMIT_")], key=lambda o: o.name)
    span = (F_IGNITE_END - F_IGNITE_START) / max(1, len(arcs))
    for i, o in enumerate(arcs):
        t0 = int(F_IGNITE_START + i * span)
        t1 = int(t0 + span * 1.6)
        key(o, "scale", t0, 1.0, 0); key(o, "scale", t0, 1.0, 1); key(o, "scale", t0, 0.02, 2)
        key(o, "scale", t1, 1.0, 2)
        ease(o)

    # INDICATORS: last, and barely. Two percent of the object.
    for i, o in enumerate(sorted([x for x in bpy.data.objects if x.name.startswith("IND_")], key=lambda x: x.name)):
        t0 = F_FULL + i * 4
        base = tuple(o.scale)
        key(o, "scale", t0, 0.01, 0); key(o, "scale", t0, 0.01, 1); key(o, "scale", t0, 0.01, 2)
        key(o, "scale", t0 + 20, base[0], 0)
        key(o, "scale", t0 + 20, base[1], 1)
        key(o, "scale", t0 + 20, base[2], 2)
        ease(o)

    # ------------------------------------------------------------ export
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    log(f"saved {OUT_BLEND}")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,        # bake the bevel modifiers
        export_animations=True,
        # ONE clip, not thirty-eight.
        #
        # The default mode exports a separate animation per object action, and
        # that is what came out first: 38 clips, each reporting a duration of
        # zero because every action was emitted against its own local time
        # rather than the scene's. Nothing in R3F could have played that as a
        # sequence — it would have had to start 38 clips and keep them in step
        # by hand, which is precisely the coordination the baked timeline
        # exists to remove.
        #
        # SCENE mode samples the whole scene across frame_start..frame_end and
        # writes a single animation, which is the one continuous timeline this
        # was supposed to be.
        export_animation_mode="SCENE",
        export_frame_range=True,
        export_bake_animation=True,
    )
    log(f"exported {OUT_GLB}")

    # Collapse Blender's per-object clips into one. See the script's own note:
    # they already share a timebase, so this only moves channels, and it is done
    # here rather than left to React because a build should hand over a file
    # that is already the shape the consumer needs.
    import subprocess
    r = subprocess.run(
        ["node", os.path.join(HERE, "scripts", "merge-portal-animations.mjs"), OUT_GLB, OUT_GLB],
        capture_output=True, text=True, cwd=HERE,
    )
    log(r.stdout.strip() or r.stderr.strip())

    total = len([o for o in bpy.data.objects])
    animated = len([o for o in bpy.data.objects if o.animation_data and o.animation_data.action])
    log(f"objects {total}, animated {animated}, actions {len(bpy.data.actions)}")
    log(f"glb size {os.path.getsize(OUT_GLB)/1024:.1f} KB")


if __name__ == "__main__":
    main()
