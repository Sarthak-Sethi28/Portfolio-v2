# WebGL scene appears to flicker, but only while the camera is moving

## Environment

- React Three Fiber 9.7 / three.js 0.186 / Next.js 16 (App Router) / React 19
- macOS, Apple M3 Pro, Chrome
- `ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro)`
- **120Hz ProMotion display (variable refresh rate)**

## Symptom

The image appears to flicker or shimmer. It happens **only while the camera is
moving**. The camera has a permanent slow idle drift (sine-based orbital motion
plus a damped lean toward the pointer). With that drift disabled, the scene is
perfectly clean.

## The key measurement

I instrumented the render loop with a `gl.readPixels` probe that samples three
24x24 screen regions every frame (water, slab face, sky), computes each region's
mean luminance, and tracks the peak frame-to-frame delta.

**Result: `0.00 / 0.00 / 0.00`.** The rendered image is stable frame to frame.
Nothing measurable is changing between frames, yet it still reads as flicker to
the eye when the camera moves.

Frame rate measured separately: a locked **120fps** at the current settings.
(Earlier, with a heavier configuration, it fell to 43-50fps and the artefact
was much worse — reducing cost improved but did not eliminate it.)

## Scene composition

- ~30 `RoundedBox` meshes, dark `MeshStandardMaterial`, roughness map only
- One large ground plane with drei `MeshReflectorMaterial`
- A sky dome: custom `ShaderMaterial`, equirect panorama blended over a
  procedural gradient
- drei `<Environment>` for image-based lighting
- `@react-three/postprocessing` EffectComposer: Bloom, SMAA, Vignette, ACES
  ToneMapping

## Bisected with URL flags — each subsystem disabled independently

| Disabled | Flicker still present? |
| --- | --- |
| Camera drift (camera frozen) | **NO — clean** |
| Water reflection | yes |
| Bloom | yes |
| Particles | yes |
| Surface textures | yes |
| Sky panorama | yes |
| **All post-processing** | yes |
| DOM overlay | yes |

Only freezing the camera removes it.

## Already tried, in order, none resolved it

1. Removed `Noise` post-effect (per-frame random grain — a genuine bug, but not this)
2. Removed `ChromaticAberration`
3. Removed `AdaptiveDpr` and `PerformanceMonitor` (they resized the drawing buffer on frame-time dips)
4. Enabled `multisampling` on EffectComposer (8x, then 4x) — the composer discards the Canvas's `antialias`
5. Added `SMAA` on top of MSAA
6. Enabled mipmaps and maximum anisotropy on every texture
7. Narrowed the roughness map's range (roughness selects env-map mip; wide variation causes view-dependent specular aliasing)
8. Set `metalness` to 0 on all concrete so faces stop mirroring the environment map
9. Widened the sun disc, which was sub-pixel — its coverage changed per frame and bloom amplified it
10. Lowered bloom threshold and intensity so no single bright pixel dominates
11. Damped the hover state change (raycast resolves against the camera, so hover toggles as the camera drifts; the material change was instant)
12. Replaced `atan(z,x)` equirect UV with a continuous `acos`-based mapping (the atan seam makes UV derivatives explode, forcing the blurriest mip in a band)
13. Forced an integer device pixel ratio (was 1.6 on a DPR-2 display — non-integer resampling)
14. Reduced reflector resolution
15. Disabled sub-pixel additive particles
16. Enlarged the sky dome so it fully encloses the ground plane
17. Removed `backdrop-filter` and reduced a 90px text-shadow blur on DOM elements composited over the canvas

## The question

Given:

- a **measurably stable image** (zero frame-to-frame luminance delta),
- at a **locked 120fps**,
- on a **120Hz variable-refresh (ProMotion) display**,
- where the artefact appears **only under continuous camera motion**,

is this a **frame-pacing / presentation** problem rather than a rendering one?
Specifically:

1. Can a WebGL canvas presenting on a VRR panel produce visible judder that
   reads as flicker even at full frame rate, and how would you confirm that in
   a browser?
2. Would capping or pacing the render loop to a fixed interval help, versus
   rendering as fast as possible?
3. Is there a known interaction between Chrome's compositor, ANGLE/Metal, and
   ProMotion that causes this?
4. Is continuous **sub-pixel** camera motion itself the problem — i.e. would
   quantising camera position to whole pixels, or moving in larger discrete
   steps, be the actual fix?
