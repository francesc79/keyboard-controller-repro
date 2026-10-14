import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const variant = process.argv[2];
if (!['original', 'patched'].includes(variant))
  throw new Error('Use original or patched');
const workspace = new URL('../pnpm-workspace.yaml', import.meta.url);
const base = readFileSync(workspace, 'utf8')
  .split('\npatchedDependencies:')[0]
  .trimEnd();
writeFileSync(
  workspace,
  base +
    '\n' +
    (variant === 'patched'
      ? '\npatchedDependencies:\n  react-native-keyboard-controller@1.22.7: patches/react-native-keyboard-controller@1.22.7.patch\n'
      : ''),
);
const install = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], {
  cwd: root,
  stdio: 'inherit',
});
if (install.status !== 0) process.exit(install.status ?? 1);
writeFileSync(
  new URL('../variant.json', import.meta.url),
  JSON.stringify({name: variant}) + '\n',
);
