"""
PORTAL TUNNEL — BEAUTY PASS v1

Operates on the approved V10 tunnel. Geometry is NOT rebuilt, moved, rescaled
or deleted; this pass only touches materials, lighting, atmosphere and render
settings.

THE PROBLEM IT SOLVES

The V10 render reads as a Blender preview: bright, flat, washed in red, with
every graphite panel equally legible and no black to anchor it. That is what
happens when emission does the lighting — a surface that emits is uniformly
bright regardless of where it sits, so depth collapses and the eye has nothing
to travel toward.

The fix is to stop lighting the tunnel with its own materials. Emission drops
hard and becomes a small number of hot accents; actual lights do the work, and
they are localised so most of the structure falls away into black. Red then
reads as illumination rather than paint, and the far end can be a void instead
of a lit disc.

Target balance: 85% near-black graphite, 10% reflected crimson, 5% hot accents.

IDEMPOTENT. Everything this script creates is prefixed TUNNEL_BEAUTY_ and is
removed before being recreated. Nothing else in the scene is deleted.
"""

import os
import bpy
from mathutils import Vector

SRC = "/Users/SarthakSethi/portal_cinematic_tunnel_v10_locked.blend"
DST = "/Users/SarthakSethi/portal_cinematic_tunnel_beauty.blend"
OUT = "/Users/SarthakSethi/Downloads/signal-array-exp/docs/cinematic/blender/tunnel-beauty"
PREFIX = "TUNNEL_BEAUTY_"
FRAMES = (1, 45, 90)


def log(m):
    print(f"[beauty] {m}", flush=True)


# --------------------------------------------------------------- helpers
def principled(mat):
    """The Principled BSDF feeding a material's output, or None."""
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def setv(node, name, value):
    """
    Set a socket only if it exists.

    Socket names move between Blender versions — 'Emission' became 'Emission
    Color', 'Specular' became 'Specular IOR Level' — and this file was written
    by a newer binary than the one running the script. Guarding every write
    means a renamed socket degrades to leaving that one value alone instead of
    aborting the whole pass.
    """
    if node and name in node.inputs:
        try:
            node.inputs[name].default_value = value
            return True
        except Exception:
            return False
    return False


def emission_of(mat):
    """The emission strength socket, whatever it is called in this version."""
    b = principled(mat)
    if not b:
        return None
    for n in ("Emission Strength", "Emission"):
        if n in b.inputs:
            return b.inputs[n]
    return None


def purge_helpers():
    """Remove only this pass's own objects, so a rerun is clean."""
    for o in [o for o in bpy.data.objects if o.name.startswith(PREFIX)]:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.materials if m.name.startswith(PREFIX)]:
        bpy.data.materials.remove(m)
    for d in [d for d in bpy.data.lights if d.name.startswith(PREFIX)]:
        bpy.data.lights.remove(d)
    for me in [me for me in bpy.data.meshes if me.name.startswith(PREFIX)]:
        bpy.data.meshes.remove(me)


# --------------------------------------------------------------- materials
def refine_materials():
    """
    Darken everything, then put the light back only where it belongs.

    Graphite is pushed to near-black with high metalness and a spread of
    roughness values: identical roughness across four hundred panels is what
    made the walls uniformly readable, because every one of them answered the
    light the same way. Varying it means some catch the red and most do not,
    which is what gives a mechanical surface its depth.
    """
    done = []

    graphite = {
        # name                base colour            metal  rough
        "FRAME14V10_Graphite":  ((0.016, 0.015, 0.016), 0.92, 0.34),
        "FRAME14V10_Graphite2": ((0.024, 0.022, 0.024), 0.88, 0.47),
        "FRAME14V10_Graphite3": ((0.010, 0.010, 0.011), 0.95, 0.26),
    }
    for name, (col, metal, rough) in graphite.items():
        mat = bpy.data.materials.get(name)
        b = principled(mat)
        if not b:
            continue
        setv(b, "Base Color", (*col, 1.0))
        setv(b, "Metallic", metal)
        setv(b, "Roughness", rough)
        # Graphite must not emit at all. Any glow here lights the tunnel from
        # everywhere at once, which is exactly what flattened it.
        e = emission_of(mat)
        if e:
            e.default_value = 0.0
        done.append(name)

    # Aged bronze, not bright yellow: dark, warm, and rough enough to stay a
    # trim rather than a light source.
    gold = bpy.data.materials.get("FRAME14V10_Gold")
    b = principled(gold)
    if b:
        setv(b, "Base Color", (0.26, 0.155, 0.062, 1.0))
        setv(b, "Metallic", 1.0)
        setv(b, "Roughness", 0.44)
        e = emission_of(gold)
        if e:
            e.default_value = 0.0
        done.append("FRAME14V10_Gold")

    """
    RED, IN TWO TIERS.

    The pale salmon came from a single mid-red at one strength across all 109
    strips, driven hard enough that AgX desaturated it — any channel pushed far
    past 1 climbs toward white, and the brightest thing in frame ends up the
    least red. So the bulk of the strips drop to a deep oxblood at low
    strength, and only the 26 RedHot slots stay genuinely hot.
    """
    red = bpy.data.materials.get("FRAME14V10_Red")
    b = principled(red)
    if b:
        setv(b, "Base Color", (0.035, 0.002, 0.002, 1.0))
        setv(b, "Metallic", 0.0)
        setv(b, "Roughness", 0.5)
        setv(b, "Emission Color", (0.62, 0.030, 0.016, 1.0))
        e = emission_of(red)
        if e:
            e.default_value = 1.6
        done.append("FRAME14V10_Red")

    hot = bpy.data.materials.get("FRAME14V10_RedHot")
    b = principled(hot)
    if b:
        setv(b, "Base Color", (0.06, 0.004, 0.002, 1.0))
        setv(b, "Metallic", 0.0)
        setv(b, "Roughness", 0.4)
        setv(b, "Emission Color", (1.0, 0.085, 0.035, 1.0))
        e = emission_of(hot)
        if e:
            e.default_value = 7.5
        done.append("FRAME14V10_RedHot")

    """
    THE VOID. The far end must be a destination, not a lit disc.

    Pure black with no emission and full roughness, so it reflects nothing and
    returns nothing. It is the only surface in the scene allowed to be
    featureless, and that is what makes the eye travel toward it.
    """
    void = bpy.data.materials.get("FRAME14V10_Void")
    b = principled(void)
    if b:
        setv(b, "Base Color", (0.0, 0.0, 0.0, 1.0))
        setv(b, "Metallic", 0.0)
        setv(b, "Roughness", 1.0)
        setv(b, "Specular IOR Level", 0.0)
        e = emission_of(void)
        if e:
            e.default_value = 0.0
        done.append("FRAME14V10_Void")

    log(f"materials refined: {', '.join(done)}")


def refine_floor():
    """
    The floor gets its own material so it can be a mirror.

    It shares graphite with the walls in V10, which means it cannot be made
    reflective without turning every panel into a mirror too. A dedicated
    material — smooth, black, fully metallic — lets the red strips above draw
    long vertical streaks down it, which is most of what makes a dark corridor
    read as wet and deep rather than merely dim.
    """
    floors = [o for o in bpy.data.objects
              if o.type == "MESH" and o.name.startswith("FRAME14V10_FloorPlate")]
    if not floors:
        log("no floor plates found; skipping floor")
        return

    mat = bpy.data.materials.new(PREFIX + "Floor")
    mat.use_nodes = True
    b = principled(mat)
    setv(b, "Base Color", (0.010, 0.009, 0.010, 1.0))
    setv(b, "Metallic", 1.0)
    # Low but not zero: a perfect mirror gives hard-edged doubles, a little
    # roughness stretches the reflections into streaks.
    setv(b, "Roughness", 0.14)

    for o in floors:
        if o.data.materials:
            o.data.materials[0] = mat
        else:
            o.data.materials.append(mat)
    log(f"floor material applied to {len(floors)} plates")


# --------------------------------------------------------------- lighting
def refine_lights():
    """
    Turn the existing rig down, and make it crimson.

    V10 already has ten red area lights and two floor bounces. They are not
    replaced — they are re-balanced: much lower energy, deeper colour, and a
    falloff that leaves the spaces between them dark. Ten lights at equal
    strength is an evenly lit tube; ten at varied strength is a corridor with
    pools of light in it.
    """
    reds = sorted([o for o in bpy.data.objects
                   if o.type == "LIGHT" and o.name.startswith("FRAME14V10_RedArea")],
                  key=lambda o: o.location.y)
    for i, o in enumerate(reds):
        d = o.data
        d.color = (1.0, 0.075, 0.035)
        # Alternating strong/weak, so the tunnel has rhythm rather than a wash.
        # Raised a little: with the cool fill pulled back, the red has to
        # carry more of the tunnel on its own.
        base = 40.0 if i % 3 == 0 else 13.0
        # Deeper lights are weaker, which is what builds distance.
        d.energy = base * (1.0 - min(0.55, i * 0.055))
        if hasattr(d, "size"):
            d.size = max(0.12, getattr(d, "size", 0.4) * 0.8)
        d.use_shadow = True

    bounces = [o for o in bpy.data.objects
               if o.type == "LIGHT" and o.name.startswith("FRAME14V10_FloorBounce")]
    for o in bounces:
        d = o.data
        d.color = (1.0, 0.13, 0.06)
        # Barely there. This is light that has already bounced once; if it
        # reads as a source, the floor stops looking reflective and starts
        # looking self-illuminated.
        d.energy = 4.5

    log(f"rebalanced {len(reds)} red area lights, {len(bounces)} floor bounces")


def add_accents(cam):
    """
    Two cool rim lights, and nothing else.

    A purely red tunnel has no reference for how red the red is — the eye
    normalises and the whole thing reads as monochrome. A very weak cool rim
    along the near ribs gives the crimson something to be crimson against, and
    it is the cheapest way to stop the image feeling like a colour filter.
    """
    for i, side in enumerate((-1, 1)):
        d = bpy.data.lights.new(PREFIX + f"Rim{i}", type="AREA")
        d.color = (0.42, 0.55, 0.92)
        """
        Barely on.

        At 2.2 these lit the panels to a legible grey-blue down the whole
        tunnel — reintroducing the exact fault the pass exists to remove, just
        in a cooler colour. Their only job is to give the crimson something to
        be crimson against; the moment they are strong enough to describe a
        surface they are too strong.
        """
        d.energy = 0.75
        d.size = 1.1
        o = bpy.data.objects.new(PREFIX + f"Rim{i}", d)
        o.location = (side * 2.2, cam.location.y - 2.0, 1.9)
        o.rotation_euler = (1.15, 0.0, side * 0.9)
        bpy.context.collection.objects.link(o)
    log("added 2 cool rim accents")


def add_haze(cam):
    """
    Atmosphere, kept deliberately thin.

    Enough that distance softens and the tunnel separates into layers; not so
    much that it reads as smoke. The volume is offset AWAY from the lens so the
    foreground stays crisp — haze in front of the camera fogs the whole frame
    and is the usual way this effect goes wrong.
    """
    mesh = bpy.data.meshes.new(PREFIX + "HazeMesh")
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    src = bpy.context.active_object
    mesh_data = src.data.copy()
    mesh_data.name = PREFIX + "HazeMesh"
    bpy.data.objects.remove(src, do_unlink=True)
    bpy.data.meshes.remove(mesh)

    o = bpy.data.objects.new(PREFIX + "Haze", mesh_data)
    o.scale = (7.0, 34.0, 7.0)
    o.location = (0.0, cam.location.y - 19.0, 1.0)
    bpy.context.collection.objects.link(o)

    mat = bpy.data.materials.new(PREFIX + "Haze")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.55, 0.10, 0.06, 1.0)
    # Very low. Above about 0.02 this stops being depth and starts being fog.
    vol.inputs["Density"].default_value = 0.009
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    o.data.materials.append(mat)
    o.visible_shadow = False
    log("added thin haze volume")


# --------------------------------------------------------------- render
def refine_render(scene):
    """
    Quality where it shows, and nothing that risks the file.

    Every setting is guarded: this file came from a newer Blender than the one
    running the script, and EEVEE's options in particular have moved twice in
    recent releases. A missing attribute skips that improvement rather than
    aborting the pass.
    """
    r = scene.render
    r.resolution_percentage = 100
    r.film_transparent = False

    ee = getattr(scene, "eevee", None)
    if ee:
        for attr, val in (
            ("taa_render_samples", 96),
            ("use_raytracing", True),
            ("use_shadows", True),
            ("use_volumetric_shadows", True),
            ("volumetric_samples", 48),
            ("use_gtao", True),
            ("gtao_distance", 1.4),
            ("gtao_factor", 1.0),
            ("use_motion_blur", False),
        ):
            if hasattr(ee, attr):
                try:
                    setattr(ee, attr, val)
                except Exception:
                    pass

    """
    AgX, and slightly under-exposed.

    AgX is already the right transform here — it is what stops the hot accents
    tearing into white — but the scene was being graded at neutral exposure,
    which is why the blacks sat grey. Pulling exposure down and contrast up is
    what actually buys the darkness the brief is asking for; no amount of
    darker base colours substitutes for it.
    """
    vs = scene.view_settings
    vs.view_transform = "AgX"
    try:
        vs.look = "AgX - Medium High Contrast"
    except Exception:
        try:
            vs.look = "Medium High Contrast"
        except Exception:
            pass
    vs.exposure = -0.55
    vs.gamma = 1.0


def setup_compositor(scene):
    """
    A minimal glare, on the compositor rather than on EEVEE.

    EEVEE's built-in bloom was removed when it was rewritten, so glow has to
    come from the compositor now. Fog Glow only, at low mix: it lifts the hot
    accents without touching the graphite, which is the difference between
    selective glow and a bloom haze over the whole frame.

    Blender 5 moved the compositor from scene.node_tree to
    scene.compositing_node_group, so both are handled — the script has to run
    against whichever binary is present.
    """
    tree = None
    if hasattr(scene, "compositing_node_group"):
        ng = scene.compositing_node_group
        if ng is None:
            ng = bpy.data.node_groups.new(PREFIX + "Comp", "CompositorNodeTree")
            scene.compositing_node_group = ng
        tree = ng
    elif hasattr(scene, "node_tree"):
        scene.use_nodes = True
        tree = scene.node_tree

    if tree is None:
        log("compositor unavailable in this build; skipped")
        return

    for n in list(tree.nodes):
        tree.nodes.remove(n)

    """
    The scene compositor IS a node group in Blender 5.

    There is no CompositorNodeComposite any more — creating one raises "Node
    type undefined". The chain terminates in the group's own output instead,
    and the group needs a declared Image socket in its interface for that
    output to have anything to connect to.
    """
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")

    if hasattr(tree, "interface"):
        has_out = any(getattr(i, "in_out", "") == "OUTPUT" for i in tree.interface.items_tree)
        if not has_out:
            tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    comp = tree.nodes.new("NodeGroupOutput")

    """
    In Blender 5 the Glare node's settings are INPUT SOCKETS, not properties.

    The compositor was rewritten, and `glare_type`, `size`, `threshold` and
    `mix` no longer exist as attributes — they are sockets named Type, Size,
    Threshold and Strength. Writing them the old way raises, which is exactly
    the kind of brittle API assumption this file was asked to avoid, so every
    one is set by socket name and skipped if absent.

    Fog Glow at low strength: it lifts the hot accents and leaves the graphite
    untouched, which is the difference between a selective glow and a bloom
    haze over the whole frame.
    """
    def sock(name, value):
        if name in glare.inputs:
            try:
                glare.inputs[name].default_value = value
                return True
            except Exception:
                return False
        return False

    sock("Type", "Fog Glow")
    sock("Quality", "High")
    # Only things brighter than the graphite may glow at all.
    sock("Threshold", 1.10)
    sock("Smoothness", 0.20)
    sock("Size", 0.62)
    sock("Strength", 0.34)
    sock("Saturation", 1.15)

    glare.location = (300, 0)
    comp.location = (600, 0)
    rl.location = (0, 0)
    try:
        tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
        tree.links.new(glare.outputs["Image"], comp.inputs["Image"])
    except Exception as e:
        log(f"compositor linking skipped: {e}")

    log("compositor: Render Layers -> Fog Glow -> Composite")


def darken_world(scene):
    """
    The world must contribute nothing.

    A grey world background lights every surface from every direction, which
    is the single largest reason the graphite was readable everywhere at once.
    In a sealed tunnel there is no sky, so there should be no ambient.
    """
    w = scene.world
    if not w:
        return
    w.use_nodes = True
    bg = next((n for n in w.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
        bg.inputs["Strength"].default_value = 0.0


# --------------------------------------------------------------- main
def main():
    log("opening locked V10 source (never written to)")
    bpy.ops.wm.open_mainfile(filepath=SRC)
    scene = bpy.context.scene

    cam = scene.camera
    if cam is None:
        raise RuntimeError("no active camera in the scene")
    log(f"engine={scene.render.engine} camera={cam.name} lens={cam.data.lens}mm "
        f"frames={scene.frame_start}-{scene.frame_end}")

    purge_helpers()

    refine_materials()
    refine_floor()
    refine_lights()
    add_accents(cam)
    add_haze(cam)
    darken_world(scene)
    refine_render(scene)
    setup_compositor(scene)

    os.makedirs(os.path.dirname(DST), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=DST)
    log(f"saved {DST}")

    os.makedirs(OUT, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    for f in FRAMES:
        scene.frame_set(f)
        scene.render.filepath = os.path.join(OUT, f"frame-{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        log(f"rendered frame {f:03d}")

    print("PORTAL TUNNEL BEAUTY PASS COMPLETE", flush=True)


if __name__ == "__main__":
    main()
