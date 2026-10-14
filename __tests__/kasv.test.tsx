import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const mockHost = "NativeKASV" as React.ElementType;
const NativeKASV = jest.requireActual(
  "react-native-keyboard-controller/lib/commonjs/components/KeyboardAwareScrollView",
).default as typeof KeyboardAwareScrollView;
const mockScroll = jest.fn();
let mockSelection: (event: object) => void;
const mockViewport = { value: { width: 360, height: 116 } };
let mockPageY = 86;
const mockInput = {
  value: {
    target: 7,
    parentScrollViewTarget: 1,
    layout: { absoluteY: 196, height: 48 },
  },
};
let mockKeyboard: {
  onStart: (event: object) => void;
  onMove: (event: object) => void;
  onEnd: (event: object) => void;
};
jest.mock("react-native-keyboard-controller/lib/commonjs/bindings", () => ({
  KeyboardControllerNative: {
    viewPositionInWindow: () =>
      Promise.resolve({
        x: 0,
        y: mockPageY,
        width: 360,
        height: mockViewport.value.height,
      }),
  },
}));
jest.mock("react-native-keyboard-controller/lib/commonjs/hooks", () => ({
  useWindowDimensions: () => ({ height: 640 }),
  useReanimatedFocusedInput: () => ({
    input: mockInput,
    update: () => Promise.resolve(),
  }),
  useFocusedInputHandler: (handlers: {
    onSelectionChange: typeof mockSelection;
  }) => {
    mockSelection = handlers.onSelectionChange;
  },
}));
jest.mock(
  "react-native-keyboard-controller/lib/commonjs/utils/findNodeHandle",
  () => ({ findNodeHandle: () => 1 }),
);
jest.mock(
  "react-native-keyboard-controller/lib/commonjs/components/hooks/useScrollState",
  () => ({
    __esModule: true,
    default: () => ({
      offset: { value: 0 },
      layout: mockViewport,
      size: { value: { width: 360, height: 1200 } },
    }),
  }),
);
jest.mock(
  "react-native-keyboard-controller/lib/commonjs/components/ScrollViewWithBottomPadding",
  () => ({
    __esModule: true,
    default: jest
      .requireActual("react")
      .forwardRef((props: object, ref: unknown) =>
        jest
          .requireActual("react")
          .createElement("NativeKASV", { ...props, ref }),
      ),
  }),
);
jest.mock(
  "react-native-keyboard-controller/lib/commonjs/components/KeyboardAwareScrollView/useSmoothKeyboardHandler",
  () => ({
    useSmoothKeyboardHandler: (handlers: typeof mockKeyboard) => {
      mockKeyboard = handlers;
    },
  }),
);
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { ScrollView: "AnimatedScrollView" },
  useAnimatedRef: () => jest.requireActual("react").useRef(null),
  useSharedValue: (value: unknown) =>
    jest.requireActual("react").useRef({ value }).current,
  useDerivedValue: (callback: () => unknown) => ({
    get value() {
      return callback();
    },
  }),
  useAnimatedStyle: () => ({}),
  useAnimatedReaction: () => undefined,
  runOnUI: (callback: unknown) => callback,
  scrollTo: (...args: unknown[]) => mockScroll(...args),
  clamp: (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value)),
  interpolate: (value: number, input: number[], output: number[]) =>
    output[0] +
    ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
}));

let renderer: ReactTestRenderer;
beforeEach(() => {
  mockScroll.mockReset();
  mockViewport.value.height = 116;
  mockPageY = 86;
  mockInput.value.target = 7;
  mockInput.value.parentScrollViewTarget = 1;
  mockInput.value.layout.height = 48;
  mockInput.value.layout.absoluteY = 196;
  jest.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
});
afterEach(() => {
  act(() => renderer.unmount());
  jest.restoreAllMocks();
});
const openKeyboard = async (enabled = true, extraKeyboardSpace = 0) => {
  await act(async () => {
    renderer = create(
      <NativeKASV
        bottomOffset={16}
        enabled={enabled}
        extraKeyboardSpace={extraKeyboardSpace}
      />,
      { createNodeMock: () => ({}) },
    );
  });
  await act(async () => {
    await renderer.root.findByType(mockHost).props.onLayout({
      nativeEvent: {
        layout: { x: 0, y: 0, width: 360, height: mockViewport.value.height },
      },
    });
  });
  act(() => {
    mockKeyboard.onStart({ height: 250, target: 7, progress: 0 });
    mockSelection({
      target: 7,
      selection: { start: { position: 0, y: 48 }, end: { position: 0, y: 48 } },
    });
    mockKeyboard.onMove({ height: 250, target: 7, progress: 1 });
  });
};

it("scrolls above a footer even when the field already fits above the IME", async () => {
  await openKeyboard();
  // Viewport bottom = 86 + 116 = 202; input bottom = 196 + 48 = 244.
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 58, false);
});

it("keeps fullscreen scrolling bounded by the keyboard", async () => {
  mockPageY = 0;
  mockViewport.value.height = 640;
  mockInput.value.layout.absoluteY = 380;
  await openKeyboard();
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 54, false);
});

it("reveals a partially clipped field in a small viewport", async () => {
  mockInput.value.layout.absoluteY = 164;
  await openKeyboard();
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 26, false);
});

it("does not scroll an input owned by a nested scroller", async () => {
  mockInput.value.parentScrollViewTarget = 2;
  await openKeyboard();
  expect(mockScroll).not.toHaveBeenCalled();
});

it("waits for the new focus selection and then reveals that input", async () => {
  mockInput.value.layout.absoluteY = 100;
  await openKeyboard();
  act(() => mockKeyboard.onEnd({ height: 250, target: 7, progress: 1 }));
  mockScroll.mockClear();
  mockInput.value = {
    ...mockInput.value,
    target: 8,
    layout: { absoluteY: 196, height: 48 },
  };
  act(() => {
    mockKeyboard.onStart({ height: 250, target: 8, progress: 1 });
    mockKeyboard.onMove({ height: 250, target: 8, progress: 1 });
  });
  expect(mockScroll).not.toHaveBeenCalled();
  act(() =>
    mockSelection({
      target: 8,
      selection: { start: { position: 0, y: 48 }, end: { position: 0, y: 48 } },
    }),
  );
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 58, true);
});

it("uses the resized viewport when visibility is requested after layout changes", async () => {
  mockViewport.value.height = 554;
  await openKeyboard();
  act(() => mockKeyboard.onEnd({ height: 250, target: 7, progress: 1 }));
  mockScroll.mockClear();
  mockViewport.value.height = 116;
  await act(async () => {
    renderer.root.findByType(mockHost).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 116 } },
    });
  });
  act(() => mockKeyboard.onMove({ height: 250, target: 7, progress: 1 }));
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 58, false);
});

it("preserves upstream scrolling when the IME changes height without hiding", async () => {
  mockPageY = 0;
  mockViewport.value.height = 640;
  mockInput.value.layout.absoluteY = 380;
  await openKeyboard();
  act(() => mockKeyboard.onEnd({ height: 250, target: 7, progress: 1 }));
  mockScroll.mockClear();
  act(() => {
    mockKeyboard.onStart({ height: 350, target: 7, progress: 1 });
    mockKeyboard.onMove({ height: 350, target: 7, progress: 1 });
  });
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 154, false);
});

it("reveals the caret of a multiline input using the viewport boundary", async () => {
  mockInput.value.layout.absoluteY = 100;
  mockInput.value.layout.height = 200;
  await openKeyboard();
  act(() => mockKeyboard.onEnd({ height: 250, target: 7, progress: 1 }));
  mockScroll.mockClear();
  act(() =>
    mockSelection({
      target: 7,
      selection: {
        start: { position: 20, y: 130 },
        end: { position: 20, y: 130 },
      },
    }),
  );
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 44, true);
});

it("keeps the IME as the limit when the viewport extends below it", async () => {
  mockViewport.value.height = 554;
  mockInput.value.layout.absoluteY = 380;
  await openKeyboard();
  expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 54, false);
});

it("does not scroll a field already inside the viewport and above the IME", async () => {
  mockViewport.value.height = 554;
  await openKeyboard();
  expect(mockScroll).not.toHaveBeenCalled();
});

it("preserves the disabled scroll contract", async () => {
  await openKeyboard(false);
  expect(mockScroll).not.toHaveBeenCalled();
});

// Native focus scrolling is not simulated here. The device comparison covers
// platform fallback behavior separately; this checks the controller output.
it.each([-188, 0, 40, 188])(
  "respects viewport visibility with extraKeyboardSpace=%i",
  async (extraKeyboardSpace) => {
    await openKeyboard(true, extraKeyboardSpace);
    expect(renderer.root.findByType(mockHost).props.bottomPadding.value).toBe(
      250 + extraKeyboardSpace,
    );
    expect(mockScroll).toHaveBeenCalledWith(expect.anything(), 0, 58, false);
  },
);
