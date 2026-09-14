# Blender pipeline

Real Blender, headless, as a Python module. Blender **5.0.1**
(`blender-v5.0-release`) on Python 3.11.

The venv is ~745MB and is gitignored. Rebuild it with:

    /opt/homebrew/bin/python3.11 -m venv .blender-venv
    ./.blender-venv/bin/pip install bpy

`bpy` from PyPI is Blender itself compiled as a module — the same C++ source as
the app, shipping the standard addons including `io_scene_gltf2`. It needs no
sudo and touches nothing outside the venv, which is why it was chosen over
`brew install --cask blender`: the cask can prompt for a password that a
headless agent cannot answer.

## Build

    ./.blender-venv/bin/python scripts/build_cinematic_portal.py

Blender → `.blend` → animated `.glb`. Produces
`assets/blender/portal-cinematic.blend` and
`public/models/portal-cinematic.glb`, then calls
`scripts/merge-portal-animations.mjs` to collapse Blender's per-object clips
into one named `Cinematic`.

## Look at it

    ./.blender-venv/bin/python scripts/preview_cinematic_portal.py /tmp/pp 0,200,450

Renders frames from the `.blend` with EEVEE. Separate from the build on
purpose: object and keyframe counts cannot tell you whether the shell opens the
right way or whether the machine is actually hidden underneath at rest. Both of
those were wrong on the first pass and only looking caught them.

## Two things worth knowing before editing

**The glTF importer converts Y-up to Z-up.** The asset arrives lying in
Blender's XZ plane with its thickness along Y. Everything is authored flat in
XY and the parent groups are tipped 90° about X to meet it — tipping the
parents, not each piece, so local Z rotations stay spins about the ring's axis.
Reading `size.z` as the thickness once produced a shell 2.35 units deep around
a ring 0.72 thick.

**glTF cannot animate materials.** It carries translation, rotation, scale and
morph weights, and nothing else. The ignition travelling round the ring is
therefore NOT baked as emission keyframes — it cannot be. The emissive arcs are
separate named objects (`EMIT_00`..`EMIT_11`) animated by scale, and their
emission strength is R3F's job. Any claim that the glow itself is in the file
would be false.
