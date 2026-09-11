# The Signal Array — Design

**Date:** 2026-09-11
**Owner:** Sarthak Sethi
**Status:** Awaiting review

---

## 1. What this is

A 3D WebGL portfolio site. The visitor lands in a rendered world rather than on a
page, and navigates it by looking around and clicking things in it.

The reference is [jacemu.xyz](https://www.jacemu.xyz/) — its interaction design is
the target, not its content or its assets. We match the *experience*: a boot
terminal that opens into a world, monuments that are navigation, a settings panel
that visibly changes the scene, day/night, weather, and a second world reached by
passing through a threshold. Everything rendered is ours.

### Goals

- A visitor who has never heard of Sarthak remembers the site an hour later.
- Every section of a conventional portfolio is reachable — about, experience,
  projects, writing, contact — without the visitor feeling they are filling in a
  form to get there.
- 60fps on an M1 at 1440p. Usable on a mid-range Android.
- The site degrades to something legible, not a black screen, when WebGL is
  unavailable or the visitor has asked for reduced motion.

### Non-goals

- A CMS or admin panel. Content lives in the repo (§7).
- Matching jacemu.xyz's specific art (gothic stone, asteroid field, underwater
  scene). We share mechanics, not look.
- A blog engine. `WRITING` links out to posts hosted elsewhere.
- Multiplayer, analytics dashboards, or any authenticated surface.

---

## 2. Art direction

Locked against three generated concept frames, stored beside this document:

| File | Frame |
| --- | --- |
| `concept-1.png` | World 1 — the array at dusk |
| `concept-2.png` | World 2 — the aperture and the colonnade |
| `concept-3.png` | Night mode |

**The world.** A dead-flat salt plain under a centimetre of standing water that
mirrors the entire sky. Colossal matte-black brutalist monoliths stand in it,
widely spaced. A parabolic radio-telescope dish sits on the horizon, tilted at the
sky. Heavy volumetric fog. A ring aperture stands at the centre of the array.

**Temperature is the map.** World 1 is warm — low sun, amber and teal. World 2,
through the aperture, is cold — desaturated blue-grey, no sun. Passing through the
ring is a temperature change, and it is the main signal that the visitor has moved.

**Scale is the effect.** Everything reads as enormous because of three things:
fog depth-cueing, the mirrored ground doubling every vertical, and a single
human-scale silhouette on the horizon for reference. All three are cheap. None is
optional.

**Type.** One geometric sans at extreme letter-spacing for world titles
(`SARTHAK SETHI`, `PROJECTS`), one monospace for the boot terminal and the
`SYS.CONFIG` panel. No other typefaces.

These frames are the *target*, not a promise. A real-time renderer will land
around 80% of a generated still. PR 2 exists to judge exactly how close.

---

## 3. Architecture

### Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router | API routes for the visitor counter; first-class Vercel previews |
| 3D | React Three Fiber + `@react-three/drei` | Scene as a component tree, which keeps units small and testable |
| Grade | `postprocessing` + `@react-three/postprocessing` | Bloom, DoF, vignette, tone mapping |
| Scene state | Zustand | One store, read by both DOM overlay and scene; no prop drilling through the graph |
| Styling | Tailwind v4 | Overlay only; the scene has no CSS |
| Counter store | Vercel KV | One integer. Nothing heavier is justified |
| Host | Vercel (`sarthak-sethi28`) | CLI already authenticated |

### Geometry is code, not assets

The single most important decision in this document.

jacemu.xyz ships Blender-authored, Draco-compressed `.glb` scenes. We author
geometry procedurally in TypeScript instead:

- Monolith — `RoundedBox`, parameterised by height, width, bevel, tilt
- Aperture — `TorusGeometry` with a custom inner profile
- Dish — `LatheGeometry` parabola + radial strut instances + a lattice ring
- Ground — a single large `PlaneGeometry` with `MeshReflectorMaterial`
- Debris and motes — instanced meshes with a seeded RNG

This is not a downgrade, for three reasons:

1. **The aesthetic is boxes.** Brutalism is rectangular slabs. `concept-1.png` is
   four boxes, a plane, and good fog.
2. **No asset pipeline.** No Blender dependency, no Draco decode step, no
   multi-megabyte download blocking first paint.
3. **The settings panel becomes real.** Because the world is parameters rather
   than a frozen mesh, `SYS.CONFIG` sliders can reshape the array itself — spacing,
   count, height variance. The reference site's sliders can only move particles.

Skies are CC0 HDRIs from Poly Haven — one dusk, one night — cross-faded on toggle.
CC0 keeps licensing unambiguous.

### Module boundaries

Each unit below has one purpose, a typed interface, and can be reasoned about
without reading its neighbours.

```
src/
  content/        # Typed data. No React, no three. The only file you edit to update the site.
    profile.ts    #   name, blurb, socials
    experience.ts #   roles
    projects.ts   #   projects, each with a pillar slot index
    writing.ts    #   external post links
    index.ts      #   re-export + zod schemas validated at build time

  store/
    scene.ts      # Zustand. Time-of-day, weather, slider values, active world,
                  # focused monument, freelook on/off. Pure state, no side effects.

  world/          # Everything inside the <Canvas>. Knows nothing about the DOM.
    geometry/     #   pure builder functions: (params) => BufferGeometry
    materials/    #   shader materials + uniform plumbing
    array/        #   World 1 assembly
    aperture/     #   World 2 assembly
    atmosphere/   #   fog, sky, rain, motes, starfield
    camera/       #   idle drift, drag-pan, freelook rig, focus transitions
    Stage.tsx     #   composes a world + post-processing

  overlay/        # Everything outside the <Canvas>. Knows nothing about three.
    Boot/         #   terminal sequence + iris reveal
    Config/       #   SYS.CONFIG panel
    Panels/       #   section and project detail panels
    Chrome/       #   mute, acknowledgments, webring

  lib/
    rng.ts        # seeded RNG — required for deterministic visual tests
    quality.ts    # device capability detection -> quality tier
```

The boundary that matters: `world/` and `overlay/` never import each other. They
communicate only through `store/scene.ts`. This is what makes the overlay testable
in Playwright without a GPU, and what keeps the scene from accumulating DOM
concerns.

### Data flow

```
content/*.ts ──(build-time zod validation)──> typed objects
                                                 │
                                                 ├──> world/  (monument labels, pillar slots)
                                                 └──> overlay/ (panel bodies)

user input ──> store/scene.ts ──┬──> world/   (uniforms, camera targets)
                                └──> overlay/ (panel visibility, config readout)

asset loading ──> drei useProgress ──> overlay/Boot (real progress lines)
```

---

## 4. Information architecture

### World 1 — THE ARRAY

Dusk. `SARTHAK SETHI` centred in wide-tracked type. Four monoliths ring the
viewer, each a section. The aperture stands at centre.

| Monument | Opens |
| --- | --- |
| Monolith N | `ABOUT` |
| Monolith E | `EXPERIENCE` |
| Monolith S | `WRITING` |
| Monolith W | `CONTACT` |
| Aperture (centre) | Transition to World 2 |

### World 2 — THROUGH THE APERTURE

Cold. `PROJECTS`. A colonnade of pillars recedes into fog, one per project.
Clicking a pillar lights it and opens the project panel. The aperture behind the
viewer returns to World 1.

Projects at launch: `semantic-guardian`, `Chatbot-University-of-Waterloo`,
`iMoney`, the WPEC deal-group site, `Danier-Chatbot`. Adding a sixth means adding
one object to `content/projects.ts`; the colonnade sizes itself.

### Entry sequence

1. Black. Monospace terminal types a boot log.
2. Lines are bound to `useProgress` — `Loading geometry buffers …… OK` fires when
   geometry actually finishes. The log tells the truth; this is a deliberate
   improvement on the reference, which fakes it on a timer.
3. Final line reports the real visitor number from `/api/visitors`.
4. Iris reveal into World 1.

A returning visitor (localStorage flag) gets an abbreviated 1.5s version. Nobody
should sit through the full boot twice.

---

## 5. Interaction

| Input | Effect |
| --- | --- |
| Idle | Slow camera drift; parallax on pointer move |
| Drag | Pan the view |
| `F` | Toggle freelook — unlocks full orbit |
| Hover monument | Rim-light rises, label fades in |
| Click monument | Camera eases to a framing position; panel opens |
| Hold on aperture | Charge-up, then world transition |
| `Esc` | Close panel, return camera to rest |
| `Tab` | Cycle monuments — keyboard reaches every section |

### SYS.CONFIG

A monospace panel, top right, matching the reference's idiom. Every control is
bound to a live uniform or geometry parameter — nothing here is decorative.

- `array_spacing` — distribution radius of the whole array
- `field_density` — count of the *decorative* monoliths in the middle distance,
  which rebuilds that part of the array. The four section monoliths are fixed and
  never removable by a slider; losing navigation to a settings control would be a
  bug, not a feature
- `fog_density`
- `mote_count`
- `cursor_repel_force`
- `water_roughness`
- `mode::day` / `mode::night` — HDRI cross-fade, 1.2s
- `rain` — particles + water ripple normal animation

State persists to localStorage.

---

## 6. Performance

The failure mode for sites like this is a beautiful scene nobody waits for.

**Budgets.** Time-to-first-frame under 2.5s on a 20Mbps connection. 60fps on an
M1 at 1440p. 30fps on a Pixel 6a. Total initial transfer under 3MB including HDRI.

**Quality tiers**, selected at boot by `lib/quality.ts` from device memory,
renderer string, and a two-frame timing probe:

| Tier | Reflections | Post FX | Motes | DPR |
| --- | --- | --- | --- | --- |
| High | Full-res reflector | Bloom + DoF + vignette | 100% | up to 2 |
| Medium | Half-res reflector | Bloom + vignette | 50% | 1.5 |
| Low | Static gradient fake | Vignette only | 20% | 1 |

`AdaptiveDpr` and `AdaptiveEvents` drop quality further under sustained frame
drops rather than stuttering.

The HDRI is the largest asset. Ship 1k for Low/Medium and 2k for High, loaded
after first paint — the boot terminal covers the gap, which is what the boot
terminal is *for*.

---

## 7. Content

Typed modules, validated by zod at build time, so a malformed entry fails CI
rather than rendering blank.

```ts
export interface Project {
  slug: string
  title: string
  blurb: string          // one line, shown on the pillar
  body: string           // panel copy
  stack: string[]
  repo?: string
  live?: string
  year: number
}
```

Editing the site is editing a file and pushing. Should a CMS ever be wanted, every
consumer reads through `content/index.ts`, so the swap is contained to that module.

---

## 8. Accessibility and fallback

Non-negotiable, and specified now because it is miserable to retrofit.

- `prefers-reduced-motion` — no boot animation, no camera drift, no rain. The
  world renders static and every monument is still clickable.
- Full keyboard path — `Tab` cycles monuments, `Enter` opens, `Esc` closes.
- Panels are real DOM with proper headings and focus traps, readable by a screen
  reader with the canvas marked `aria-hidden`.
- No WebGL — a styled, complete text version of the entire portfolio. Not an
  apology page. This doubles as what crawlers index.
- Every section is also reachable at a real URL (`/about`, `/projects/<slug>`) for
  linking and for search.

---

## 9. Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| Pure logic | Vitest | Geometry builders, seeded RNG, quality tiering, content schemas |
| Overlay | Playwright | Boot completes, panels open/close, config persists, keyboard path, reduced-motion path |
| Scene | Playwright screenshots | Fixed camera positions, seeded RNG, `webgl: swiftshader` — catches visual regressions |
| Budget | Lighthouse CI | Fails the build if TTFF or transfer size regresses |

Seeded RNG is what makes scene screenshots viable; without it the world differs
every run and visual tests are worthless. Hence `lib/rng.ts` in PR 1, not later.

---

## 10. Phases

One PR each. Every PR ships a Vercel preview to look at before merge.

| PR | Scope | Done when |
| --- | --- | --- |
| 1 | Scaffold, CI, Vercel previews, Vitest + Playwright, seeded RNG | A grey box renders; CI green on lint, types, tests |
| 2 | **Static World 1** — water, HDRI sky, fog, monoliths, aperture, dish, lighting | Preview matches `concept-1.png` closely enough to build on |
| 3 | Post-processing, day/night cross-fade, rain, starfield | Night preview matches `concept-3.png` |
| 4 | Camera — idle drift, drag-pan, `F` freelook, raycast hover/click, focus easing | The world is navigable |
| 5 | Boot terminal bound to real progress, `/api/visitors` + KV, iris reveal | Cold load is the full sequence; second load is short |
| 6 | Content modules, zod schemas, section panels, keyboard path, `/about` routes | Every section reachable by mouse, keyboard, and URL |
| 7 | **World 2** — aperture transition, colonnade, project pillars, detail panels | Preview matches `concept-2.png`; round trip works |
| 8 | `SYS.CONFIG` wired to live uniforms, localStorage, audio + mute, acknowledgments | Every slider visibly changes the world |
| 9 | Quality tiers, touch controls, reduced-motion, no-WebGL fallback | Budgets in §6 met on a real Pixel; fallback is complete |
| 10 | OG image, metadata, favicon, sitemap, domain, uwatering webring | Live |

**PR 2 is the risk gate.** If the static world does not carry the concept, every
later PR is wasted work. It lands early and deliberately, and it is judged on a
real preview URL before anything is built on top of it.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Procedural geometry looks cheap next to the concept art | PR 2 is the gate. If it fails, we source CC0 models before continuing — the decision is reversible because geometry sits behind builder functions |
| Reflections tank mobile performance | Low tier replaces the reflector with a gradient. Specified up front, not bolted on |
| The boot sequence annoys repeat visitors | Abbreviated replay after first visit |
| Scope creep — this world invites endless additions | Phase table is the contract. New ideas go to a backlog, not into an open PR |
| Audio autoplay policy | Muted by default, explicit unmute, exactly as the reference does it |

---

## 12. Open items

None. Content strategy, audio, and hosting were decided before this document was
written:

- Content — typed files in the repo
- Audio — original generated ambient track, muted by default
- Hosting — Vercel under `sarthak-sethi28`; domain decided at PR 10
