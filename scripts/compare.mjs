import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(new URL('../.results/', import.meta.url), {recursive: true});
const results = {};
try {
  for (const variant of ['original', 'patched']) {
    const setup = spawnSync('node', ['scripts/variant.mjs', variant], {
      cwd: root,
      stdio: 'inherit',
    });
    if (setup.status !== 0) throw new Error(`Install failed: ${variant}`);
    const test = spawnSync(
      'pnpm',
      [
        'exec',
        'jest',
        '--runInBand',
        '--silent',
        '--json',
        '--outputFile',
        `.results/${variant}.json`,
      ],
      {cwd: root, encoding: 'utf8'},
    );
    writeFileSync(
      new URL(`../.results/${variant}.log`, import.meta.url),
      (test.stdout ?? '') + (test.stderr ?? ''),
    );
    const data = JSON.parse(
      readFileSync(
        new URL(`../.results/${variant}.json`, import.meta.url),
        'utf8',
      ),
    );
    results[variant] = {
      passed: data.numPassedTests,
      failed: data.numFailedTests,
      total: data.numTotalTests,
      tests: data.testResults.flatMap(suite =>
        suite.assertionResults.map(t => ({name: t.fullName, status: t.status})),
      ),
    };
    console.log(
      `${variant}: ${data.numPassedTests} passed, ${data.numFailedTests} failed`,
    );
    if (
      (variant === 'original' && data.numFailedTests === 0) ||
      (variant === 'patched' && (test.status !== 0 || data.numFailedTests > 0))
    ) {
      throw new Error(`Unexpected differential result: ${variant}`);
    }
  }
  writeFileSync(
    new URL('../evidence/component-tests.json', import.meta.url),
    JSON.stringify(
      {
        controller: '1.22.7',
        method:
          'Actual installed components; mocked native measurements, keyboard events and Reanimated. No native race occurrence is inferred from these tests.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  const restore = spawnSync('node', ['scripts/variant.mjs', 'original'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (restore.status !== 0) process.exitCode = 1;
}
