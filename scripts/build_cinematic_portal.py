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
# The SPLIT machine: the same asset, the same textures, the same silhouette,
# recovered into its four structural quadrants by scripts/split-portal.mjs.
# Nothing about how it looks changes — only that its parts can now be
# addressed, which is what the unlock needs.
SRC_GLB = os.path.join(HERE, "assets", "blender", "base_split.glb")
OUT_GLB = os.path.join(HERE, "public", "models", "portal-cinematic.glb")
OUT_BLEND = os.path.join(HERE, "assets", "blender", "portal-cinematic.blend")

# ---------------------------------------------------------------- timeline
# Ring centre height in the model's own space, measured from its bbox.
CY = 0.9395
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

    # UVs. Without them the shell could only ever be flat colour, which is why
    # it rendered as white plastic next to a fully textured machine.
    #
    # Cylindrical: U runs around the arc, V across the radial width, so the
    # texture wraps the ring the way rolled plate would rather than being
    # projected flat and smearing on the returns. Scaled by the real arc length
    # so the grain is the same size on a wide section as on a narrow one — a
    # per-section 0..1 unwrap would make every section look like a different
    # material.
    uv = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            ang = math.atan2(co.y, co.x)
            rad = math.hypot(co.x, co.y)
            # Fine tiling on purpose. At 1.6 the map's larger features repeated
            # about fourteen times around the ring and read as a printed motif;
            # at this scale the same map is surface grain, which is all a
            # dormant shell needs from it.
            loop[uv].uv = (ang * r_out * 5.5, (rad - r_in) * 5.5 + co.z * 2.0)

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


def clad_material(name, source_meshes):
    """
    A material built from the imported asset's own image maps.

    Reaches into the imported material's node tree and reuses the actual image
    datablocks — base colour, normal and roughness — so the shell is made of
    the same stuff as the machine underneath it. Falls back to plain stone if
    the asset ever arrives without textures, because a build that dies on a
    missing map is worse than one that looks wrong.
    """
    src = None
    for ob in source_meshes:
        for slot in ob.material_slots:
            if slot.material and slot.material.use_nodes:
                src = slot.material
                break
        if src:
            break
    if src is None:
        return material(name, (0.42, 0.40, 0.37), rough=0.85)

    images = {}
    for node in src.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            for out in node.outputs:
                for link in out.links:
                    images[link.to_socket.name] = node.image

    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    def hook(image, socket, non_color=False):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        if non_color:
            tex.image.colorspace_settings.name = "Non-Color"
        nt.links.new(tex.outputs["Color"], bsdf.inputs[socket])
        return tex

    base_img = images.get("Base Color")
    if base_img:
        # Multiplied down, so the dormant shell is the weathered OUTSIDE of the
        # machine rather than a second copy of its lit face.
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = base_img
        # DESATURATE, then darken.
        #
        # The asset's base colour has the energy channel painted into it, so
        # borrowing the map wholesale covered the dormant shell in glowing red
        # markings — a ring that is meant to read as dead stone wearing the
        # machine's lit face. Pulling the saturation out keeps everything worth
        # having from that map (the grain, the panel breaks, the wear) and
        # removes the one thing that gives the game away. Hue, not level: just
        # dimming it leaves the red as dark red.
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Saturation"].default_value = 0.12
        hsv.inputs["Value"].default_value = 0.85
        nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])

        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color2"].default_value = (0.74, 0.72, 0.68, 1.0)
        nt.links.new(hsv.outputs["Color"], mix.inputs["Color1"])
        nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    if "Roughness" in images:
        hook(images["Roughness"], "Roughness", non_color=True)
    else:
        bsdf.inputs["Roughness"].default_value = 0.8

    nrm_img = None
    for node in src.node_tree.nodes:
        if node.type == "NORMAL_MAP":
            for link in node.inputs["Color"].links:
                nrm_img = link.from_node.image
    if nrm_img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = nrm_img
        tex.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.8
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    bsdf.inputs["Metallic"].default_value = 0.25
    return m


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

    # THE QUADRANTS, pivoted on themselves.
    #
    # Each arrives with its origin at the model's origin, which would make
    # "rotation" a turn about the ring's axis — that slides a 90-degree
    # quadrant along the arc instead of tilting it, and at any useful angle the
    # ring stops being a ring. Moving each origin to its own centroid makes the
    # same few degrees a tilt in place, which is what a heavy structural member
    # unseating actually does.
    quadrants = []
    for o in meshes:
        if not o.name.startswith("seg_"):
            continue
        c = Vector((0.0, 0.0, 0.0))
        for v in o.data.vertices:
            c += v.co
        c /= max(1, len(o.data.vertices))
        for v in o.data.vertices:
            v.co -= c
        o.location = o.location + c
        quadrants.append((o, c))
    log(f"quadrants: {[q[0].name for q in quadrants]}")

    # The whole assembly is built about the ring's centre, so rotations happen
    # about the ring and not about the model's feet.
    root.location = centre
    active.location = -centre

    # ---- NO DORMANT SHELL ----
    #
    # It was built, textured, animated, and then removed, and the reason is
    # worth keeping: docs/endpoints/day-home.png is immutable and it shows the
    # MACHINE. A casing whose entire purpose is to conceal the machine cannot
    # also be the frame that displays it, so rendering it put a stone donut
    # where the signed-off portal should be.
    #
    # The unlock is performed by the machine's OWN four quadrants instead,
    # which is better anyway: there is no second object to explain, no geometry
    # swap, and the thing that opens is the thing the visitor has been looking
    # at since the first frame. Same model, closed configuration to open.

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

    # ---- THE UNLOCK: the machine's own quadrants ----
    #
    # Crown first, then the haunches, then the springing. That is the order an
    # arch actually comes apart in — the keystone is the piece under least
    # restraint and the bottom carries the load, so releasing the bottom first
    # would read as the thing collapsing rather than opening. It also happens
    # to be the order that reads best from the site's fixed camera, because the
    # crown is the part most clearly in frame.
    #
    #   5.95s  top       (crown releases)
    #   6.08s  left      (haunch)
    #   6.21s  right     (haunch)
    #   6.34s  bottom    (springing, last, and it travels least)
    #
    # Each quadrant moves out along its OWN radius and back in depth. Moving
    # them all one way would slide the machine apart; moving each outward opens
    # every seam at once while the circle stays a circle. Small: enough to
    # expose the construction behind, not enough to look like debris.
    ORDER = {"seg_top": 0, "seg_left": 1, "seg_right": 2, "seg_bottom": 3}
    for ob, _c in quadrants:
        rank = ORDER.get(ob.name, 0)
        start = int(round((5.95 + rank * 0.13) * FPS))
        # Fully open by 7.8s, settled into the final pose by 10.5s and then
        # held — that pose is what remains on the night endpoint.
        opened = int(round(7.8 * FPS))
        settled = int(round(10.5 * FPS))

        base = Vector(ob.location)
        # Radial direction in the ring's plane. After the glTF Z-up conversion
        # the ring lies in XZ, so the axis is Y and "radial" is XZ.
        d = Vector((base.x, 0.0, base.z - CY))
        d = d.normalized() if d.length > 1e-5 else Vector((0.0, 0.0, 1.0))

        # SIZED AGAINST THE SCREEN, not against the model.
        #
        # At 0.085 of the radius each quadrant travelled about three and a half
        # world units, which from the site's fixed camera is roughly ten pixels
        # on a ring some two hundred and thirty across — the machine opened and
        # nothing visibly happened. The hero beat has to be legible from the
        # camera that actually exists, so the travel is set by how far it reads
        # on screen rather than by what sounds restrained in model units.
        #
        # Still restrained: a fifth of the radius on a ring this size opens the
        # seams wide enough to see the mechanism behind and no wider, and every
        # quadrant stays plainly part of the same circle.
        # The SPRINGING barely moves. It carries the feet, and pushing it as
        # far as the crown lifted the base clear of the water — the machine
        # read as coming apart at its foundations rather than opening. An arch
        # opens at the crown and the haunches; the part taking the load stays
        # where it is, which is also why it is released last.
        travel = {0: 1.0, 1: 0.92, 2: 0.92, 3: 0.3}[rank]
        out = R * 0.21 * travel
        # Depth is mostly invisible head-on, so it is small — it exists to open
        # the seams into shadow rather than to move anything anywhere.
        depth = THICK * 0.30 * travel * (1.0 if rank % 2 == 0 else -1.0)
        spin = math.radians(3.0) * travel * (1.0 if rank % 2 == 0 else -1.0)

        for ax in (0, 1, 2):
            key(ob, "location", start, base[ax], ax)
        key(ob, "rotation_euler", start, 0.0, 1)

        key(ob, "location", opened, base.x + d.x * out, 0)
        key(ob, "location", opened, base.y + depth, 1)
        key(ob, "location", opened, base.z + d.z * out, 2)
        key(ob, "rotation_euler", opened, spin, 1)

        # Settles a fraction further and stops. No idle drift afterwards.
        key(ob, "location", settled, base.x + d.x * out * 1.06, 0)
        key(ob, "location", settled, base.y + depth * 1.06, 1)
        key(ob, "location", settled, base.z + d.z * out * 1.06, 2)
        key(ob, "rotation_euler", settled, spin * 1.06, 1)

        for ax in (0, 1, 2):
            key(ob, "location", F_END, ob.location[ax] if False else (
                base.x + d.x * out * 1.06 if ax == 0 else
                base.y + depth * 1.06 if ax == 1 else
                base.z + d.z * out * 1.06), ax)
        key(ob, "rotation_euler", F_END, spin * 1.06, 1)
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
            # Exposed as the quadrants part, between 6.7 and 7.8 seconds, so
            # the deeper layers arrive into a gap that has just opened rather
            # than appearing through solid geometry.
            t_hidden = int(round(6.7 * FPS))
            t_shown = int(round(7.8 * FPS))
            for ax in (0, 1, 2):
                key(child, "scale", t_hidden, 0.001, ax)
                key(child, "scale", t_shown, 1.0, ax)
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

    # COMPRESS. 15MB of uncompressed PNG is not something to ship, and the same
    # three steps took the source asset from 14.3MB to 503KB. Run as separate
    # passes rather than through `optimize`, which flattens hierarchies
    # destructively and would take the named nodes the animation targets.
    tmp_a, tmp_b = OUT_GLB + ".a", OUT_GLB + ".b"
    cli = ["npx", "--yes", "@gltf-transform/cli@latest"]
    for args in (
        ["resize", OUT_GLB, tmp_a, "--width", "1024", "--height", "1024"],
        ["webp", tmp_a, tmp_b],
        ["draco", tmp_b, OUT_GLB],
    ):
        subprocess.run(cli + args, capture_output=True, text=True, cwd=HERE)
    for f in (tmp_a, tmp_b):
        if os.path.exists(f):
            os.remove(f)

    total = len([o for o in bpy.data.objects])
    animated = len([o for o in bpy.data.objects if o.animation_data and o.animation_data.action])
    log(f"objects {total}, animated {animated}, actions {len(bpy.data.actions)}")
    log(f"glb size {os.path.getsize(OUT_GLB)/1024:.1f} KB")


if __name__ == "__main__":
    main()
