# Frozen endpoints

The two states the cinematic transition connects. Captured from :3001 at
1440x810 with `?still=1`, GPU-backed Chromium.

- `day-home.png` — the arrival. Sequence idle at 0, `night` false.
- `night-projects.png` — the destination. `night` true.

These are the CONTRACT for the transition rebuild. The sequence may do
anything it likes in between, but frame one has to be the first image and the
last has to be the second. Anything that changes either of them is a
regression, however good it looks on its own.

They exist because the endpoints are the part most at risk. Every change made
while chasing a beat in the middle lands on materials, lights and camera that
the resting states also use, and drift there is invisible while you are
looking at the middle. One such drift is already recorded in
`docs/endpoints/DRIFT.md`.

Recapture with the same viewport and wait, or the comparison is meaningless.
