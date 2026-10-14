# Keyboard Controller reproduction

Independent Expo / React Native app for two `react-native-keyboard-controller@1.22.7` issues:

1. `KeyboardAwareScrollView`: a bounded viewport ends above the keyboard, but scrolling uses the keyboard edge as its visibility limit.
2. `KeyboardAvoidingView`: premature or stale native position responses can initialize the wrong geometry.

Only public npm dependencies are used. There is no navigation framework, UI library, authentication, backend, or application data.

## Setup

Use Node 22 or newer and pnpm 11.1.1 through Corepack. Android requires JDK 17 and an Android SDK; iOS requires macOS/Xcode.

```sh
git clone https://github.com/francesc79/keyboard-controller-repro.git
cd keyboard-controller-repro
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm compare
```

`pnpm compare` installs each variant using pnpm and executes the actual installed components. Native measurements, keyboard events and Reanimated are simulated in these component tests. The script restores the original variant before returning.

| Controller | Passed | Failed |
| --- | ---: | ---: |
| Original 1.22.7 | 8 | 21 |
| Patched 1.22.7 | 29 | 0 |

Expected regression failures are captured by `pnpm compare`; the command succeeds only when the original exposes failures and the patched variant passes. Full local output goes to ignored `.results/`. The shareable result summary is [component-tests.json](evidence/component-tests.json).

These 29 tests include fullscreen and already-visible controls, viewport changes followed by an event, focus/selection timing, multiline caret, invalid native dimensions, stale/out-of-order responses, target changes and unmount/remount. They do not establish the frequency of a native race.

## Android: bounded ScrollView

```sh
pnpm original
pnpm android
```

The app opens on **KASV viewport**. On a physical USB device, ensure the app can reach Metro:

```sh
adb reverse tcp:8086 tcp:8086
```

1. Keep the default bounded card: its fixed header and footer are outside the ScrollView.
2. Tap **Focus last** and wait until the keyboard stops moving.
3. Tap **Sample bounds**.
4. Compare `input`, `viewport`, and `ime` in the readout. The expected limit is `min(viewport, ime)`, allowing the configured `bottomOffset`.
5. Toggle **Fullscreen** as a control, then return to **Bounded**.

The sample reads settled native rectangles for observation; it does not change scrolling or supply offsets to the controller. A screenshot/readout describes that endpoint, not every animation frame.

The `VISIBLE` indicator checks that the entire input fits between the viewport top and the smaller lower edge. It does not assert caret spacing or the configured `bottomOffset`.

For the patched comparison, stop Metro first, then run:

```sh
pnpm patched
pnpm start --clear
```

Reopen the already-built app. Both variants use the same native 1.22.7 code; the patch changes only JS/TS distribution files. The header shows the installed variant. Restore the default when finished:

```sh
pnpm original
```

## Initial native results

The Android debug build succeeded with minSdk 24. On a Huawei DUK-L09 running Android 9 / API 28 with Gboard, the supplied Maestro visibility flow passed for **both** variants:

| Variant | Input bottom | Viewport bottom | IME top | Full input |
| --- | ---: | ---: | ---: | --- |
| Original | 250.7 | 250.7 | 351.0 | Visible |
| Patched | 238.0 | 250.7 | 351.0 | Visible |

Values are logical pixels. **Native clipping was not reproduced in this run.** The observed difference is a larger lower gap with the patch. Native focus scrolling can also affect the final position; these screenshots do not establish which mechanism made the original input visible.

See [native-results.json](evidence/native-results.json), [original screenshot](evidence/android-original.png), and [patched screenshot](evidence/android-patched.png). No dependency instrumentation or forced native responses were used on the device. The deterministic component failures above are separate evidence.

To run the same optional check with Maestro installed:

```sh
maestro test maestro/viewport.yaml
```

The natural KAV race, native fullscreen control, iOS and other Android devices/API levels are **NOT RUN**. Local verification used Node 24.15.0 and pnpm 11.1.1. The table above records the initial run, before the comparison controls were added. A later [extraKeyboardSpace comparison](evidence/extra-keyboard-space/README.md) reproduces clipping with Android native focus scrolling explicitly disabled; it also documents the default-focus controls, component tests and videos.

## Native measurement timing

Choose **KAV measurement**. Focus the external field to open the keyboard, then use **Mount again** to mount an offset KAV with an autofocus input. Repeat mount/unmount and sample the footer after each transition settles.

This screen attempts the natural race without replacing native measurements. Reproduction depends on device/timing. The deterministic tests explicitly simulate zero, invalid, delayed and out-of-order native responses; their results must not be described as observing those native responses on a device.

## Patch scope and limitations

The [pnpm patch](patches/react-native-keyboard-controller@1.22.7.patch) changes KAV and KASV in the package's source, CommonJS and ESM distribution formats. It preserves upstream 1.22.7 changes.

- KASV uses the smaller of the keyboard edge and its measured viewport bottom.
- KAV checks the measurement generation and native target, ignores stale responses and retries unusable dimensions.
- KAV retries remain unbounded while a mounted view keeps returning invalid dimensions. There is no timeout for a native Promise. The existing fallback after a rejected native measurement remains unchanged.
- The patch addresses the reported cases; it is not a general layout synchronization solution.

`pnpm-workspace.yaml` disables optimistic repeat installation so that changing the patch registration actually reinstalls the controller. The two React Native tooling overrides pin its published 0.86.2 helper packages while keeping React Native 0.86.3.

The default published checkout is **original/unpatched**. Changing variants intentionally regenerates `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `variant.json`. No script manually edits `node_modules`.

## Upstream material

- [KASV issue draft](upstream/kasv-issue.md)
- [KAV comment draft](upstream/kav-comment.md)
- Related reports: [#1514](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1514), [#1594](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1594), [#1134](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1134).

Use [this reproduction repository](https://github.com/francesc79/keyboard-controller-repro) as the reproduction link when submitting. No issue, comment, commit, or push is performed by the scripts.
