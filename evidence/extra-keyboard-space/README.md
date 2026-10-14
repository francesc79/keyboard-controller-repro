# extraKeyboardSpace comparison

The suggested prop was tested against controller **1.22.7**, using the same Android APK for original and patched JS variants. No production application was changed.

**Result:** the tested values change bottom spacing, but do not fix the clipped field when Android native focus scrolling is disabled. With native focus scrolling enabled, the original already keeps the field visible, including in the dynamic-layout control. The claim is limited to this configuration; these results do not establish that the production application requires the patch.

## Device results

Huawei DUK-L09, Android 9 / API 28, Gboard. Values below are logical pixels. IME top: **351.0**; viewport bottom: **289.7**.

| Controller | scrollsChildToFocus | extraKeyboardSpace | Shift after focus | Input bottom | Full input |
| --- | --- | --- | --- | ---: | --- |
| Original | true | -100, 0, 40, 100 | No | 289.7 | Visible |
| Original | true | -100, 0, 40, 100 | 24 dp | 289.7 | Visible |
| Original | false | -100, 0, 40, 100 | No | 339.0 | Clipped |
| Patched | false | 0 | No | 277.7 | Visible |
| Patched | true | 0 | No | 277.7 | Visible |
| Patched | true | 0 | 24 dp | 277.3 | Visible |

The original extra=40 / native-focus-off case was repeated for its video, with the same result. All 16 recorded measurements, covering 15 configurations, are in [results.json](results.json).

The original input is above the keyboard, yet **49.3 dp below the viewport bottom**. Increasing scrollable bottom space by 40 dp (the footer height) or 100 dp does not change that endpoint in this fixture. The patched extra=0 case fits inside the viewport.

## Videos and screenshots

- Original, native focus off, extra=0: [MP4](original-native-focus-off-extra-0.mp4), [screenshot](original-native-focus-off-extra-0.png).
- Original, native focus off, extra=40: [MP4](original-native-focus-off-extra-40.mp4), [screenshot](original-native-focus-off-extra-40.png).
- Patched, native focus off, extra=0: [MP4](patched-native-focus-off-extra-0.mp4), [screenshot](patched-native-focus-off-extra-0.png).
- Original default-focus control, extra=0: [screenshot](original-native-focus-on-extra-0.png).

The phone has no `screenrecord` executable. These MP4s encode actual ADB screen captures at approximately 1–2 fps, preserving capture intervals. They show the endpoint and interaction sequence; they are not evidence about animation smoothness. No synthesized frames or forced native measurements are used.

## Reproduce manually

1. Install with `pnpm install --frozen-lockfile` and build/start the Android app as described in the [main README](../../README.md).
2. Keep **KASV viewport**, bounded mode. Default settings are **extra=0** and **Native on**.
3. For the isolated controller case, tap **Native on** so the button reads **Native off**. This passes the documented Android `scrollsChildToFocus={false}` prop to the ScrollView.
4. Select **0**, **40**, **100**, or **-100** before opening the keyboard.
5. Tap **Focus last**, wait for the IME to settle, then **Sample bounds**.
6. Force-stop/reopen the app before each case, restoring the same settings. For the default-focus control, keep **Native on**.
7. For the dynamic-layout control, keep **Native on**, focus the field and tap **Shift**. This inserts 24 dp before the field and calls the public `assureFocusedInputVisible()` method after layout. Then sample bounds.
8. Stop Metro, run `pnpm patched`, restart Metro with `pnpm start --clear` and reopen the app. Repeat with extra=0, keeping every other setting the same.
9. Restore the original default using `pnpm original` when finished.

Every case uses `removeClippedSubviews={false}` to keep the programmatically focused offscreen input mounted. The `VISIBLE` label checks the entire input against the viewport and IME, not caret spacing or bottomOffset compliance. Sampling only observes geometry; it never scrolls or supplies offsets.

## Component-level cross-check

The existing installed-component harness now also tests extra values **-188, 0, 40, 188** against the deterministic 640-high window / 202 viewport-bottom fixture. Its keyboard height is 250 and expected scroll is 58.

The tests confirm bottom padding changes to **62, 250, 290, 438** respectively. The original still issues no scroll request in these four cases; the patched implementation satisfies the expected 58 dp request. Native events and Reanimated are simulated in these tests; Android native focus scrolling is not simulated.

`pnpm compare`: original **8 passed / 21 failed**, patched **29 passed / 0 failed**. See [component-tests.json](../component-tests.json) for individual results.

## Scope and limits

- The default Android native focus behavior prevents clipping in every default-focus case executed here. This is a useful control, not evidence that extraKeyboardSpace itself corrected the visibility calculation.
- Native clipping is demonstrated with `scrollsChildToFocus=false`. This is an explicit nondefault setting and must be disclosed when sharing the videos.
- iOS, other devices/API levels, native KAV timing, native fullscreen, default removeClippedSubviews=true, and patched nonzero-extra combinations were **NOT RUN**.
- The controller patch and production application are unchanged. This comparison alone does not justify removing or retaining the production KASV correction.

References: [extraKeyboardSpace documentation](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view#extrakeyboardspace), [React Native ScrollView source](https://github.com/facebook/react-native/blob/v0.86.3/packages/react-native/Libraries/Components/ScrollView/ScrollView.js), [upstream issue](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1681).
