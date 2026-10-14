# KeyboardAwareScrollView ignores its own viewport bottom when it ends above the IME

Historical issue draft. The follow-up [extraKeyboardSpace comparison](../evidence/extra-keyboard-space/README.md) reproduces native clipping only with Android native focus scrolling disabled. The original remains visible in the executed default-focus controls. Use the [follow-up reply](extra-keyboard-space-reply.md) for the precise scope and evidence.

## Description

With a bounded `KeyboardAwareScrollView` and a fixed footer outside it, the focused input can remain clipped even when the calculated scroll places it above the keyboard. The ScrollView's bottom is above the IME, so the keyboard edge is not the actual visibility boundary.

## Reproduction

Use the **KASV viewport** screen in this repository. The default checkout uses unpatched 1.22.7.

1. Install with `pnpm install --frozen-lockfile` and launch `pnpm android`.
2. Keep **Bounded** mode and tap **Focus last**.
3. Wait for the IME to settle, then tap **Sample bounds**.
4. Compare the focused input bottom with the ScrollView bottom and the keyboard top.
5. Repeat after `pnpm patched`, restarting Metro with a fresh JS runtime.

The fullscreen control and already-visible component tests distinguish this from applying a universal extra offset.

## Expected behavior

The field/caret should be visible inside the ScrollView and above the keyboard. The lower boundary is:

```ts
Math.min(windowHeight - keyboardHeight, scrollViewPageY + scrollViewHeight)
```

## Current calculation in 1.22.7

`maybeScroll` uses `windowHeight - keyboardHeight` without bounding it by the measured ScrollView bottom. Existing `scrollViewPageY` and `scrollViewLayout.height` provide the missing boundary.

The deterministic viewport case uses a 640-high window, 250-high keyboard, ScrollView y86/height116, input y196/height48 and bottomOffset16. The visible bottom is 202, so the expected scroll is 58, although the input bottom 244 is already above the IME edge 390.

## Evidence and environment

- React Native 0.86.3, Expo 57.0.18, React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1, controller 1.22.7.
- Actual installed component tests: original 8 pass/21 fail; proposed patch 29 pass/0 fail across both KAV/KASV groups. See `evidence/component-tests.json` for individual cases.
- The component tests simulate native events/measurements. They are not native race recordings.
- Consult the README for native results and platform limitations before submitting this draft.

Related report: #1134 describes an input covered by a sticky footer on iOS. This reproduction uses a bounded ordinary View with a footer outside the ScrollView; equivalence has not been assumed.
