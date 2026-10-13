import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import meta from './pages/_meta.js';

const websiteDir = fileURLToPath(new URL('.', import.meta.url));
const { version, repository } = JSON.parse(
  readFileSync(join(websiteDir, '../package.json'), 'utf8'),
);
const currentMajor = Number(version.split('.')[0]);
const otherMajors = Object.keys(meta)
  .filter((name) => /^api-v\d+$/.test(name))
  .map((name) => Number(name.slice(5)))
  .filter((major) => major !== currentMajor);
const refs = otherMajors.map((major) => `refs/docs/${major}.x.x`);

if (otherMajors.length > 0) {
  execFileSync(
    'git',
    [
      'fetch',
      '--no-tags',
      repository.url.replace(/^git\+/, ''),
      ...otherMajors.map(
        (major) => `+refs/heads/${major}.x.x:refs/docs/${major}.x.x`,
      ),
    ],
    { cwd: websiteDir, stdio: 'inherit' },
  );
}

execFileSync('npm', ['run', 'generate:docs', '--', 'local', ...refs], {
  cwd: websiteDir,
  stdio: 'inherit',
});
