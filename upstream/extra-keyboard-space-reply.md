Thanks for the suggestion. I tested the original 1.22.7 with `extraKeyboardSpace` values of -100, 0, 40 and 100, then compared it with the patch at extra=0 on the same Android device/APK.

There is an important qualification: with Android's native focus scrolling enabled (`scrollsChildToFocus=true`), the original keeps the input visible with all four values. It also stays visible after a 24 dp layout shift followed by `assureFocusedInputVisible()`. So these default-focus cases do not demonstrate native clipping.

To isolate KASV's own scrolling, I used `scrollsChildToFocus=false`. Every case also uses `removeClippedSubviews=false` to keep the offscreen programmatically focused input mounted. Under that configuration:

- Viewport bottom: 289.7 dp; keyboard top: 351.0 dp.
- Original with extra -100 / 0 / 40 / 100: input bottom 339.0 dp, clipped by 49.3 dp beyond the viewport.
- Patched with extra=0: input bottom 277.7 dp, inside the viewport.

The footer height is 40 dp. Adding 40 or 100 dp of extra keyboard space did not change the original endpoint in this fixture.

I have included the measurements, exact settings and three videos here:
https://github.com/francesc79/keyboard-controller-repro/tree/master/evidence/extra-keyboard-space

The phone lacks `screenrecord`, so the MP4s use real ADB screen captures at approximately 1–2 fps. They demonstrate settled clipping, not animation timing. The isolated-controller setting is visible as **Native off** in the videos. iOS has not been tested.

Is KASV expected to ensure visibility with `scrollsChildToFocus=false`, or should this combination be configured differently? I would limit the report to this explicit configuration based on the current native evidence, rather than claim a default Android regression.
