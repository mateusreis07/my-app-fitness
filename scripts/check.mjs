import { spawnSync } from 'node:child_process';

const checks = [
  ['TypeScript', 'node_modules/typescript/bin/tsc', '--noEmit'],
  ['ESLint', 'node_modules/eslint/bin/eslint.js', '.'],
  ['Prettier', 'node_modules/prettier/bin/prettier.cjs', '--check', '.'],
  ['Testes', '--test', 'src/**/*.test.mts'],
];
for (const [label, ...args] of checks) {
  console.log(`\n${label}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
