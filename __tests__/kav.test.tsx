import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

import type {KeyboardAvoidingView} from 'react-native-keyboard-controller';

// Exercise the installed implementation: a Modal mock cannot reproduce this race.
const mockHost = 'NativeKAV' as React.ElementType;
const NativeKAV = jest.requireActual(
  'react-native-keyboard-controller/lib/commonjs/components/KeyboardAvoidingView',
).default as typeof KeyboardAvoidingView;
const mockMeasure = jest.fn();
const mockApply = jest.fn();
let mockTarget = 1;
const mockKeyboard = {
  isClosed: {value: true},
  heightWhenOpened: {value: 250},
  progress: {value: 1},
};
jest.mock('react-native-keyboard-controller/lib/commonjs/bindings', () => ({
  KeyboardControllerNative: {
    viewPositionInWindow: (...args: unknown[]) => mockMeasure(...args),
  },
}));
jest.mock('react-native-keyboard-controller/lib/commonjs/hooks', () => ({
  useWindowDimensions: () => ({height: 640}),
}));
jest.mock(
  'react-native-keyboard-controller/lib/commonjs/utils/findNodeHandle',
  () => ({findNodeHandle: (view: unknown) => (view ? mockTarget : null)}),
);
jest.mock(
  'react-native-keyboard-controller/lib/commonjs/components/KeyboardAvoidingView/hooks',
  () => ({
    useKeyboardAnimation: () => mockKeyboard,
    useTranslateAnimation: () => ({translate: {value: 0}, padding: {value: 0}}),
  }),
);
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {View: 'NativeKAV'},
  useSharedValue: (value: unknown) =>
    jest.requireActual('react').useRef({value}).current,
  useDerivedValue: (callback: () => unknown) => ({
    get value() {
      return callback();
    },
  }),
  useAnimatedStyle: (callback: () => {height?: number; flex?: number}) => ({
    get height() {
      return callback().height;
    },
    get flex() {
      return callback().flex;
    },
  }),
  interpolate: (value: number, input: number[], output: number[]) =>
    output[0] +
    ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
  runOnUI: (callback: (value: unknown) => void) => (value: unknown) => {
    mockApply(value);
    callback(value);
  },
}));

const layout = {x: 0, y: 0, width: 360, height: 474};
const positioned = {x: 0, y: 48, width: 360, height: 474};
let renderer: ReactTestRenderer;
let frames: FrameRequestCallback[];
beforeEach(() => {
  mockMeasure.mockReset();
  mockApply.mockReset();
  mockTarget = 1;
  mockKeyboard.isClosed.value = true;
  frames = [];
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
  act(() => {
    renderer = create(<NativeKAV automaticOffset behavior="height" />, {
      createNodeMock: () => ({}),
    });
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  jest.restoreAllMocks();
});
const measure = async () => {
  await act(async () => {
    await renderer.root.findByType(mockHost).props.onLayout({
      nativeEvent: {layout},
    });
  });
};
const nextFrame = async () => {
  await act(async () => {
    frames.shift()?.(0);
  });
};

it('retries an unlaid-out native view instead of caching a zero offset', async () => {
  mockMeasure
    .mockResolvedValueOnce({x: 0, y: 0, width: 0, height: 0})
    .mockResolvedValueOnce(positioned);
  await measure();
  expect(mockApply).not.toHaveBeenCalled();
  await nextFrame();
  expect(mockMeasure).toHaveBeenCalledTimes(2);
  expect(mockApply).toHaveBeenCalledWith({...layout, x: 0, y: 48});
});

it('accepts a measured view at the screen origin without retrying', async () => {
  mockMeasure.mockResolvedValue({...positioned, y: 0});
  await measure();
  expect(mockApply).toHaveBeenCalledWith(layout);
  expect(frames).toHaveLength(0);
});

it('stops pending retries after unmount', async () => {
  mockMeasure.mockResolvedValue({x: 0, y: 0, width: 0, height: 0});
  await measure();
  act(() => renderer.unmount());
  await nextFrame();
  expect(mockMeasure).toHaveBeenCalledTimes(1);
  expect(mockApply).not.toHaveBeenCalled();
});

it('ignores an older native response after a newer layout', async () => {
  let complete!: (value: typeof positioned) => void;
  mockMeasure
    .mockImplementationOnce(() => new Promise(resolve => (complete = resolve)))
    .mockResolvedValueOnce(positioned);
  act(() => {
    renderer.root.findByType(mockHost).props.onLayout({
      nativeEvent: {layout},
    });
  });
  await measure();
  await act(async () => complete({...positioned, y: 0}));
  expect(mockApply).toHaveBeenCalledTimes(1);
  expect(mockApply).toHaveBeenCalledWith({...layout, y: 48});
  mockKeyboard.isClosed.value = false;
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
});

it.each([
  {width: 0, height: 474},
  {width: 360, height: 0},
  {width: -1, height: 474},
  {width: NaN, height: 474},
  {width: 360, height: Infinity},
])('waits for usable native dimensions %j', async dimensions => {
  mockKeyboard.isClosed.value = false;
  mockMeasure
    .mockResolvedValueOnce({...positioned, ...dimensions, y: 0})
    .mockResolvedValueOnce(positioned);
  await measure();
  expect(mockApply).not.toHaveBeenCalled();
  expect(
    renderer.root.findByType(mockHost).props.style[1].height,
  ).toBeUndefined();
  await nextFrame();
  expect(mockApply).toHaveBeenCalledWith({...layout, y: 48});
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
});

it('ignores a response when the native target changes', async () => {
  mockKeyboard.isClosed.value = false;
  let complete!: (value: typeof positioned) => void;
  mockMeasure.mockImplementation(
    () => new Promise(resolve => (complete = resolve)),
  );
  act(() => {
    renderer.root.findByType(mockHost).props.onLayout({nativeEvent: {layout}});
  });
  mockTarget = 2;
  await act(async () => complete(positioned));
  expect(mockApply).not.toHaveBeenCalled();
  expect(
    renderer.root.findByType(mockHost).props.style[1].height,
  ).toBeUndefined();
});

it('ignores a response after unmount and initializes a remount independently', async () => {
  mockKeyboard.isClosed.value = false;
  let complete!: (value: typeof positioned) => void;
  mockMeasure
    .mockImplementationOnce(() => new Promise(resolve => (complete = resolve)))
    .mockResolvedValueOnce(positioned);
  act(() => {
    renderer.root.findByType(mockHost).props.onLayout({nativeEvent: {layout}});
  });
  act(() => renderer.unmount());
  act(() => {
    renderer = create(<NativeKAV automaticOffset behavior="height" />, {
      createNodeMock: () => ({}),
    });
  });
  await measure();
  await act(async () => complete({...positioned, y: 0}));
  expect(mockApply).toHaveBeenCalledTimes(1);
  expect(mockApply).toHaveBeenCalledWith({...layout, y: 48});
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
});

it('initializes usable height when mounted with the keyboard already open', async () => {
  mockKeyboard.isClosed.value = false;
  mockMeasure
    .mockResolvedValueOnce({x: 0, y: 0, width: 0, height: 0})
    .mockResolvedValueOnce(positioned);
  await measure();
  await nextFrame();
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
});

it('keeps children mounted across enabled true, false, true with an open keyboard', async () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  const Child = () => {
    React.useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return null;
  };
  mockKeyboard.isClosed.value = false;
  mockMeasure.mockResolvedValue(positioned);
  act(() =>
    renderer.update(
      <NativeKAV automaticOffset behavior="height">
        <Child />
      </NativeKAV>,
    ),
  );
  await measure();
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
  act(() =>
    renderer.update(
      <NativeKAV automaticOffset behavior="height" enabled={false}>
        <Child />
      </NativeKAV>,
    ),
  );
  expect(
    renderer.root.findByType(mockHost).props.style[1].height,
  ).toBeUndefined();
  act(() =>
    renderer.update(
      <NativeKAV automaticOffset behavior="height">
        <Child />
      </NativeKAV>,
    ),
  );
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
});

it('recovers from prolonged zero measurements and stops measuring after unmount', async () => {
  mockKeyboard.isClosed.value = false;
  mockMeasure.mockResolvedValue({x: 0, y: 0, width: 0, height: 0});
  await measure();
  for (let i = 0; i < 20; i++) await nextFrame();
  expect(mockApply).not.toHaveBeenCalled();
  expect(
    renderer.root.findByType(mockHost).props.style[1].height,
  ).toBeUndefined();
  mockMeasure.mockResolvedValue(positioned);
  await nextFrame();
  expect(mockApply).toHaveBeenCalledWith({...layout, y: 48});
  expect(renderer.root.findByType(mockHost).props.style[1].height).toBe(342);
  const count = mockMeasure.mock.calls.length;
  act(() => renderer.unmount());
  await nextFrame();
  expect(mockMeasure).toHaveBeenCalledTimes(count);
});
