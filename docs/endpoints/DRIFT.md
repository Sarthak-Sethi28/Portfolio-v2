# Known drift from the approved day homepage

`ModelAperture` tints the portal's material every frame:

    m.color.setRGB(0.42 + woke * 0.58, 0.52 + woke * 0.48, 0.58 + woke * 0.42)

where `woke = max(ignition, nightLevel)`. At rest in daylight both are zero, so
the ring renders at roughly half brightness and pulled toward blue-grey.

It was added for a real reason: the asset's baseColor has the red channel
painted into it, so with emissive at zero the portal still arrived GLOWING and
could never read as the dormant stone of board 01. Dimming alone would not fix
it — the problem is hue, not level.

But it is a change to an endpoint that was already signed off, made while
working on the middle of the sequence. That is exactly the class of drift the
golden frames exist to catch, and which of the two day rings is the frozen one
is the author's call, not a detail to settle by inference:

- keep it, and the arrival is a dark dormant machine that wakes; or
- revert it, and the day homepage is exactly as approved, with the ignition
  beat having less to reveal.
