import React, {useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import variant from './variant.json';

function Action({title, onPress}: {title: string; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={title}
      onPress={onPress}
      style={styles.action}>
      <Text>{title}</Text>
    </Pressable>
  );
}

type Rect = {y: number; width: number; height: number};
function bounds(view: View | TextInput | null): Promise<Rect | null> {
  if (!view) return Promise.resolve(null);
  return new Promise(resolve => {
    view.measureInWindow((_x, y, width, height) => {
      resolve(
        [y, width, height].every(Number.isFinite) && width > 0 && height > 0
          ? {y, width, height}
          : null,
      );
    });
  });
}

function ScrollViewportCase() {
  const viewport = useRef<View>(null);
  const input = useRef<TextInput>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [sample, setSample] = useState(
    'Focus last, wait for IME, then sample bounds.',
  );

  const sampleBounds = async () => {
    const [area, field] = await Promise.all([
      bounds(viewport.current),
      bounds(input.current),
    ]);
    const ime = Keyboard.metrics();
    if (!area || !field || !ime) {
      setSample('No settled IME geometry. Open the keyboard first.');
      return;
    }
    const viewportBottom = area.y + area.height;
    const visibleBottom = Math.min(viewportBottom, ime.screenY);
    const inputBottom = field.y + field.height;
    const result =
      field.y >= area.y - 1 && inputBottom <= visibleBottom + 1
        ? 'VISIBLE'
        : 'CLIPPED';
    setSample(
      `${result}: input=${inputBottom.toFixed(1)} viewport=${viewportBottom.toFixed(1)} ime=${ime.screenY.toFixed(1)}`,
    );
  };

  return (
    <View style={styles.body}>
      <View style={styles.actions}>
        <Action title="Focus last" onPress={() => input.current?.focus()} />
        <Action title="Sample bounds" onPress={sampleBounds} />
        <Action
          title={fullscreen ? 'Bounded' : 'Fullscreen'}
          onPress={() => {
            Keyboard.dismiss();
            setFullscreen(value => !value);
          }}
        />
      </View>
      <View
        style={[styles.card, fullscreen ? styles.fullscreen : styles.bounded]}>
        <View style={styles.header}>
          <Text>Fixed header</Text>
        </View>
        <View
          ref={viewport}
          testID="scroll-viewport"
          collapsable={false}
          style={styles.viewport}>
          <KeyboardAwareScrollView
            bottomOffset={16}
            mode="insets"
            style={styles.viewport}
            keyboardShouldPersistTaps="handled">
            {Array.from({length: 9}, (_, index) => (
              <TextInput
                key={index}
                placeholder={`Field ${index + 1}`}
                testID={`field-${index + 1}`}
                style={styles.input}
              />
            ))}
            <TextInput
              ref={input}
              placeholder="Last field"
              testID="last-field"
              style={styles.input}
            />
          </KeyboardAwareScrollView>
        </View>
        <View testID="fixed-footer" style={styles.footer}>
          <Text>Fixed footer outside ScrollView</Text>
        </View>
      </View>
      <Text testID="bounds-status" style={styles.note}>
        {sample}
      </Text>
      <Text style={styles.note}>
        Bounded: the ScrollView ends above the keyboard. Its own bottom must
        limit visibility.
      </Text>
    </View>
  );
}

function NativeMeasurementCase() {
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sample, setSample] = useState(
    'Natural native race: reproduction is device/timing dependent.',
  );
  const footer = useRef<View>(null);
  const sampleBounds = async () => {
    const rect = await bounds(footer.current);
    const ime = Keyboard.metrics();
    if (!rect || !ime)
      return setSample('Mount the view with the keyboard open first.');
    const bottom = rect.y + rect.height;
    setSample(
      `footer=${bottom.toFixed(1)} ime=${ime.screenY.toFixed(1)} ${bottom <= ime.screenY + 1 ? 'VISIBLE' : 'COVERED'}`,
    );
  };
  return (
    <View style={styles.body}>
      <TextInput
        placeholder="Open keyboard before mounting"
        testID="external-input"
        style={styles.input}
      />
      <View style={styles.actions}>
        <Action
          title="Mount again"
          onPress={() => {
            setGeneration(value => value + 1);
            setMounted(true);
          }}
        />
        <Action title="Unmount" onPress={() => setMounted(false)} />
        <Action title="Sample footer" onPress={sampleBounds} />
      </View>
      {mounted && (
        <KeyboardAvoidingView
          key={generation}
          automaticOffset
          behavior="height"
          style={styles.viewport}>
          <View style={styles.header}>
            <Text>Offset container</Text>
          </View>
          <ScrollView
            style={styles.viewport}
            keyboardShouldPersistTaps="handled">
            <TextInput
              autoFocus
              placeholder="Autofocus inside KAV"
              testID="kav-input"
              style={styles.input}
            />
          </ScrollView>
          <View ref={footer} collapsable={false} style={styles.footer}>
            <Text>Footer inside KAV</Text>
          </View>
        </KeyboardAvoidingView>
      )}
      <Text testID="measurement-status" style={styles.note}>
        {sample}
      </Text>
    </View>
  );
}

function Cases() {
  const [screen, setScreen] = useState<'scroll' | 'measure'>('scroll');
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Keyboard Controller {variant.name}</Text>
      <View style={styles.actions}>
        <Action
          title="KASV viewport"
          onPress={() => {
            Keyboard.dismiss();
            setScreen('scroll');
          }}
        />
        <Action
          title="KAV measurement"
          onPress={() => {
            Keyboard.dismiss();
            setScreen('measure');
          }}
        />
      </View>
      {screen === 'scroll' ? <ScrollViewportCase /> : <NativeMeasurementCase />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <Cases />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', paddingHorizontal: 12},
  title: {fontSize: 16, marginVertical: 4},
  body: {flex: 1, minHeight: 0},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4},
  action: {backgroundColor: '#dbeafe', padding: 6, borderRadius: 4},
  card: {borderWidth: 1, borderColor: '#475569'},
  bounded: {height: 160},
  fullscreen: {flex: 1, minHeight: 0},
  header: {
    height: 28,
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 4,
  },
  footer: {
    height: 40,
    flexShrink: 0,
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 4,
  },
  viewport: {flex: 1, minHeight: 0},
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#64748b',
    margin: 4,
    paddingHorizontal: 8,
  },
  note: {fontSize: 12, marginVertical: 4},
});
