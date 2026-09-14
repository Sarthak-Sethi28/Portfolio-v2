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

# The shot list, in frames. Every number the animation uses is named here, so
# retiming is a change to this block and nothing else.
#
# stillness -> tension -> unlock -> reveal -> ignition -> settle -> stillness
S01_ARRIVAL     = (0, 30)     # dormant. Nothing moves. Deliberately.
S02_CLOSER      = (30, 60)    # tension only; barely perceptible
S03_DISTURBANCE = (60, 90)    # first visible response, staggered
S04_PULL        = (90, 120)   # propagation around the circumference
S05_RESPONSE    = (120, 150)  # movement REDUCES; tension held
S06_ALONE       = (150, 180)  # dramatic pause; frozen 160-175
S07_UNLOCK      = (180, 210)  # first hero motion, staggered wave
S08_REVEAL      = (210, 240)  # shell reaches final; rings counter-rotate
S09_IGNITION    = (240, 270)  # channel cleared; clamps finish
S10_FULL_POWER  = (270, 300)  # one restrained pressure pulse at 282
S11_SHIFT       = (300, 330)  # heavy deceleration
S12_NEW_REALITY = (330, 360)  # settles to stable
S13_APPROACH    = (360, 390)  # static; website camera takes over
S14_APERTURE    = (390, 420)  # static
S15_TRANSITION  = (420, 450)  # final pose

# Shell displacement, as fractions of the portal radius. Restrained on purpose:
# the shell only ever moves far enough to expose the machine.
SHELL_TENSION_R   = 0.004   # 0.4%
SHELL_DISTURB_R   = 0.008
SHELL_PULL_R      = 0.011
SHELL_UNLOCK_R    = 0.042
SHELL_REVEAL_R    = 0.105   # see note below: the 5-8% band cannot hold
SHELL_REVEAL_DEG_NOTE = """
A DELIBERATE DEVIATION from the 5-8% radial band, because the brief contains
two requirements that cannot both be met inside it.

The shell must COVER the energy channel when closed, so its inner edge has to
start inside the channel's inner radius. The channel must be UNOBSTRUCTED once
ignition begins, so that same edge has to finish outside the channel's outer
radius. The gap between those two is the channel's own width plus margin, and
the edge does not travel radially by the full displacement: a sector moved
along its mid-angle carries its end corners outward by only cos(half-span) of
that distance, and the 4-degree tilt swings those corners further inward again.

Measured, not reasoned: at 7.2% the nearest shell vertex finished at 0.503
against a channel reaching 0.528 — obstructed by two and a half percent of the
radius, in the exact frames where the light is supposed to run round the ring.

Raising the travel is the honest fix. The alternative was moving the channel
inward, which breaks the closed state instead, and the shell at 9.5% still
reads as restrained rather than exploded.
"""
SHELL_REVEAL_D    = 0.030
SHELL_TENSION_DEG = 0.45
SHELL_DISTURB_DEG = 0.8
SHELL_PULL_DEG    = 1.1
SHELL_UNLOCK_DEG  = 2.6
# Reduced from 4.2: the tilt is what swings a section's inner corner back
# toward the channel, so it works directly against the clearance above.
SHELL_REVEAL_DEG  = 3.4

# Ring rotation, degrees. A leads B, and they never match speed.
RING_A_REVEAL, RING_B_REVEAL = 22.0, -14.0
RING_A_SHIFT,  RING_B_SHIFT  = 27.0, -17.0
RING_A_FINAL,  RING_B_FINAL  = 27.9, -17.6

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

    # ORIGIN AT THE SECTION'S OWN CENTROID, not at the ring's centre.
    #
    # Built around the ring centre, a section's "rotation" is a rotation about
    # the ring AXIS, which slides it along the arc rather than turning it. At
    # the four degrees the brief asks for, that is a sixth of a section's own
    # width — the shell splayed into a turbine fan and the ring stopped reading
    # as a ring. Moving the origin to the middle of each sector makes the same
    # four degrees a tilt in place, which is what a heavy panel unseating
    # actually does, and leaves the radial travel to the location channel where
    # it belongs.
    mid_a = (a0 + a1) / 2.0
    mid_r = (r_in + r_out) / 2.0
    pivot = (math.cos(mid_a) * mid_r, math.sin(mid_a) * mid_r, 0.0)
    for v in me.vertices:
        v.co.x -= pivot[0]
        v.co.y -= pivot[1]

    ob = bpy.data.objects.new(name, me)
    ob.location = pivot
    bpy.context.collection.objects.link(ob)

    # A real chamfer on every arris. Without it the sections read as cut from
    # paper however thick they actually are, because nothing catches a highlight
    # along the edges.
    bev = ob.modifiers.new("Bevel", "BEVEL")
    # Modest. A heavy chamfer on a section this size reads as a rounded-over
    # edge rather than a dressed one, and it is what was opening the seams.
    bev.width = min(depth * 0.03, (r_out - r_in) * 0.03)
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
    """
    Heavy things start and stop reluctantly, and never spring back.

    AUTO_CLAMPED is the important part. A clamped handle cannot carry the curve
    past the values of the keys either side of it, so a decelerating move
    physically cannot overshoot its final position — which is the one failure
    that would make hundreds of tonnes read as rubber. Blender's default
    handles do overshoot on exactly this shape of curve.
    """
    if not (ob.animation_data and ob.animation_data.action):
        return
    for fc in action_fcurves(ob.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN_OUT"
            kp.handle_left_type = "AUTO_CLAMPED"
            kp.handle_right_type = "AUTO_CLAMPED"
        fc.update()


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
    # A PULSE node between the root and everything that should feel the
    # pressure wave of shot 10. That beat needs ONE transform to carry it;
    # applying a pulse per piece is how a machine ends up looking like it is
    # breathing rather than like pressure passed through it.
    pulse_node = empty("PULSE", root)
    active = empty("PORTAL_ACTIVE", pulse_node)

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

    # Sized against the energy channel at both ends of the move, which is the
    # only constraint that actually matters here.
    #
    # CLOSED, the shell's inner edge must sit inside the arcs so it covers them
    # completely — at 0.50 against arcs starting at 0.505 the margin was two
    # tenths of a percent and thin red slivers showed at every seam in the
    # dormant frame. OPEN, the same edge travels out by SHELL_REVEAL_R and has
    # to finish OUTSIDE them, or the shell would sit across the channel exactly
    # when it ignites.
    #
    #   closed: 0.49R          < 0.515R  (arcs covered)
    #   open:   0.49R + 0.072R = 0.562R  > 0.555R  (channel clear)
    r_in = R * 0.49
    r_out = R * 1.07
    depth = THICK * 1.3
    # NEGATIVE. The sections OVERLAP when closed.
    #
    # This went 1.6 degrees -> 0.35 -> overlap, and the last step is the one
    # that mattered. Even at 0.35 a thin red line showed at every joint in the
    # dormant frame, and the cause was not the gap but the BEVEL: a 0.033-unit
    # chamfer taken off both edges of every section opens a 0.066-unit slit
    # whatever the nominal seam is, and the energy channel sits directly behind
    # it. No amount of shrinking a positive seam closes a hole the chamfer is
    # cutting.
    #
    # Overlapping the sections closes it properly, and it is what a closed iris
    # actually does — the leaves lie over one another and part as it opens. The
    # solids interpenetrate while shut, which costs nothing visually since they
    # share a material, and the joint lines appear on their own as the shell
    # withdraws.
    seam = -math.radians(0.35)
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
    mech_in = ring_plane(empty("MechanicalRing_A", pulse_node))
    mech_out = ring_plane(empty("MechanicalRing_B", pulse_node))
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
        # Lining the bore, NOT spanning it. At 0.30..0.44 the rings left a clear
        # centre of only three tenths of the portal radius and the final aperture
        # read as choked — shot 14 flies a camera through this hole. Pushed out
        # against the throat wall they still show as turning layers from inside,
        # which is what that shot wants to see, without standing in the way.
        o = arc_solid(f"MECH_INNER_{idx:02d}", R * 0.42, R * 0.50, a0, a1, THICK * 0.45, steps=8)
        o.data.materials.append(gold)
        o.parent = mech_in
    for idx in range(16):
        a0 = idx * math.tau / 16 + math.radians(1.0)
        a1 = (idx + 1) * math.tau / 16 - math.radians(1.0)
        o = arc_solid(f"MECH_OUTER_{idx:02d}", R * 0.44, R * 0.53, a0, a1, THICK * 0.38, steps=6)
        o.data.materials.append(iron)
        o.parent = mech_out

    # ---- separately addressable emissive arcs ----
    emissive = ring_plane(empty("EMISSIVE", pulse_node))
    # EnergyRoot exists so R3F has a single handle on the channel. Created at
    # identity inside EMISSIVE, so no arc's world transform changes.
    energy_root = empty("EnergyRoot", emissive)
    for i in range(EMISSIVE_ARCS):
        a0 = i * math.tau / EMISSIVE_ARCS + math.radians(1.2)
        a1 = (i + 1) * math.tau / EMISSIVE_ARCS - math.radians(1.2)
        # Moved OUTSIDE the shell's inner edge rather than astride it, so the
        # shell's own body covers them end to end while it is closed. Sitting at
        # 0.475..0.525 against a shell starting at 0.50, half of every arc was
        # in the open aperture and the red ring showed in the dormant frame.
        # Narrowed by half a percent at the outer edge purely to buy clearance
        # margin; at 0.555 the shell finished 0.0012 short of clearing it, which
        # is a hairline and would still have drawn a shell edge across the light.
        o = arc_solid(f"EMIT_{i:02d}", R * 0.515, R * 0.548, a0, a1, THICK * 0.30, steps=6)
        # Its own material per arc: R3F drives emission by name, and shared
        # materials would light the whole ring at once.
        o.data.materials.append(
            material(f"EmitRed_{i:02d}", (0.10, 0.01, 0.01), rough=0.4,
                     emit=(1.0, 0.16, 0.07), emit_strength=6.0)
        )
        o.parent = energy_root

    # ---- green indicators ----
    ind = ring_plane(empty("INDICATORS", pulse_node))
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
    #
    # CURVE WORK. Every key below is BEZIER with AUTO_CLAMPED handles, which is
    # what buys "no overshoot" — clamped handles cannot carry a curve past the
    # values of the keys on either side, so a shell section physically cannot
    # travel further than its final position and spring back. Default handles
    # do exactly that on a decelerating move, and it is the single thing that
    # would make hundreds of tonnes read as rubber.
    #
    # Shell and rings are shaped differently on purpose: the shell gets its
    # velocity in the middle and locks firmly, the rings accelerate more slowly
    # and keep a long deceleration tail, because a mass that is turning has
    # further to shed its momentum than one that is sliding.

    # Sections are grouped by angular distance from the crown, so the unlock
    # propagates top -> upper -> sides -> lower -> bottom rather than at random.
    def group_of(mid):
        d = abs(((math.degrees(mid) - 90.0 + 180.0) % 360.0) - 180.0)
        return 0 if d < 26 else 1 if d < 58 else 2 if d < 104 else 3 if d < 148 else 4

    for i, (ob, mid) in enumerate(shell_secs):
        g = group_of(mid)
        cx, cy = math.cos(mid), math.sin(mid)
        sign = 1.0 if i % 2 == 0 else -1.0

        # Offsets are now relative to the section's resting position, because
        # its origin sits at its own centroid rather than at the ring centre.
        base = tuple(ob.location)

        def place(frame, rad, dep, deg):
            key(ob, "location", frame, base[0] + cx * R * rad, 0)
            key(ob, "location", frame, base[1] + cy * R * rad, 1)
            key(ob, "location", frame, base[2] - R * dep * sign, 2)
            key(ob, "rotation_euler", frame, math.radians(deg) * sign, 2)

        # 01 ARRIVAL. Held dead still to frame 30. No idle motion at all —
        # the stillness is what gives everything after it somewhere to move
        # from, and an "alive" dormant machine spends that for nothing.
        place(S01_ARRIVAL[1], 0.0, 0.0, 0.0)

        # 02 CLOSER LOOK. Internal pressure. Only some sections take it, so the
        # structure reads as loaded unevenly rather than as uniformly humming.
        if i % 3 == 0:
            place(S02_CLOSER[1], SHELL_TENSION_R, 0.0, SHELL_TENSION_DEG)
        else:
            place(S02_CLOSER[1], 0.0, 0.0, 0.0)

        # 03 DISTURBANCE. First visible response, a few sections only.
        if i % 3 == 0 or i % 5 == 0:
            place(S03_DISTURBANCE[1], SHELL_DISTURB_R, 0.003, SHELL_DISTURB_DEG)

        # 04 THE PULL. Engagement spreads around the circumference in order.
        place(S04_PULL[1] + g * 3, SHELL_PULL_R, 0.004, SHELL_PULL_DEG)

        # 05 RESPONSE. Movement REDUCES. The portal goes quiet while the world
        # outside it does the work, and relaxing slightly is more alive than
        # freezing outright.
        place(S05_RESPONSE[1], SHELL_PULL_R * 0.86, 0.003, SHELL_PULL_DEG * 0.8)

        # 06 ALONE. Frozen 160-175, so the unlock lands into silence.
        place(160, SHELL_PULL_R * 0.86, 0.003, SHELL_PULL_DEG * 0.8)
        place(175, SHELL_PULL_R * 0.86, 0.003, SHELL_PULL_DEG * 0.8)

        # 07 UNLOCK. The hero beat, staggered four frames per group.
        t0 = S07_UNLOCK[0] + g * 4
        place(t0, SHELL_PULL_R * 0.86, 0.003, SHELL_PULL_DEG * 0.8)
        place(t0 + 30, SHELL_UNLOCK_R, 0.016, SHELL_UNLOCK_DEG)

        # 08 LAYERS REVEAL. Out to the final open position and no further.
        place(S08_REVEAL[1], SHELL_REVEAL_R, SHELL_REVEAL_D, SHELL_REVEAL_DEG)

        # 09 IGNITION. Clamps finish; the channel must be clear by now.
        place(S09_IGNITION[1], SHELL_REVEAL_R * 1.02, SHELL_REVEAL_D, SHELL_REVEAL_DEG)

        # 10-15. Nothing further. A held key at the end keeps the exporter's
        # sampling flat rather than letting it drift between distant keys.
        place(F_END, SHELL_REVEAL_R * 1.02, SHELL_REVEAL_D, SHELL_REVEAL_DEG)
        ease(ob)

    # ---- the two mechanical rings ----
    #
    # A leads B by six frames and they never share a speed. Identical
    # counter-rotation reads as a single geared assembly and kills the sense
    # that there are two independent layers down there.
    for ob, (start, reveal, shift, final) in (
        (mech_in, (212, RING_A_REVEAL, RING_A_SHIFT, RING_A_FINAL)),
        (mech_out, (218, RING_B_REVEAL, RING_B_SHIFT, RING_B_FINAL)),
    ):
        key(ob, "rotation_euler", 0, 0.0, 2)
        key(ob, "rotation_euler", start, 0.0, 2)
        key(ob, "rotation_euler", S08_REVEAL[1], math.radians(reveal), 2)
        # 09: continues a small amount rather than stopping dead.
        key(ob, "rotation_euler", S09_IGNITION[1], math.radians(reveal + (shift - reveal) * 0.35), 2)
        # 11: heavy deceleration into frame 330.
        key(ob, "rotation_euler", S11_SHIFT[1], math.radians(shift), 2)
        # 12: settles by a degree or so and stops. No looping idle.
        key(ob, "rotation_euler", S12_NEW_REALITY[1], math.radians(final), 2)
        key(ob, "rotation_euler", F_END, math.radians(final), 2)
        ease(ob)

    # The rings are hidden until the shell lets go of them.
    #
    # A DEVIATION, stated plainly: the brief forbids substituting scale for
    # emissive on the EMIT arcs, and that is respected below. This is a
    # different problem — an annulus set back in the throat is still visible
    # through an open aperture, so at rest the gold layer showed in the middle
    # of a ring that is meant to look like dead stone. Scale is the only
    # channel glTF carries that can remove geometry from frame entirely. It is
    # timed to the reveal and eased, so the layers grow into alignment rather
    # than popping into being.
    for grp in (mech_in, mech_out):
        for child in grp.children:
            key(child, "scale", S07_UNLOCK[0] + 22, 0.001, 0)
            key(child, "scale", S07_UNLOCK[0] + 22, 0.001, 1)
            key(child, "scale", S07_UNLOCK[0] + 22, 0.001, 2)
            key(child, "scale", S08_REVEAL[1], 1.0, 0)
            key(child, "scale", S08_REVEAL[1], 1.0, 1)
            key(child, "scale", S08_REVEAL[1], 1.0, 2)
            ease(child)

    # ---- 10 FULL POWER: one pressure pulse, on one node ----
    #
    # Carried on PULSE rather than on individual pieces, so it reads as a wave
    # passing through a single machine. About one percent, over twelve frames,
    # once. Any more often and it is breathing; any larger and the feet slide.
    key(pulse_node, "scale", 276, 1.0, 0); key(pulse_node, "scale", 276, 1.0, 1); key(pulse_node, "scale", 276, 1.0, 2)
    for ax in (0, 1, 2):
        key(pulse_node, "scale", 282, 1.010, ax)
        key(pulse_node, "scale", 288, 1.0, ax)
    ease(pulse_node)

    # EMIT_* and IND_* are deliberately NOT animated. Their geometry stays
    # stable and correctly aligned; emissive progression is R3F's job in step 4,
    # which is the only way to do it because glTF cannot carry animated
    # material properties at all.

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
