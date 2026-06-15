import { execSync }    from 'child_process';
import { readFileSync } from 'fs';
import path             from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const config      = packageJson.config || {};

const SSH_HOST    = config.staging_host_name;
const REMOTE_PATH = config.staging_host_path;
const LOCAL_PATH  = path.resolve(__dirname, '..');

const NODE_PATH = '/home/ankur/.nvm/versions/node/v20.19.4/bin/node';

if (!SSH_HOST || !REMOTE_PATH) {
  console.error('Missing SSH config in package.json > config');
  process.exit(1);
}

console.log('Building docs...');
execSync(`${NODE_PATH} node_modules/.bin/vitepress build docs`, {
  stdio: 'inherit',
  cwd:   LOCAL_PATH,
});

console.log(`Syncing to ${SSH_HOST}:${REMOTE_PATH}`);
execSync(`rsync -avz --delete docs/.vitepress/dist/ ${SSH_HOST}:${REMOTE_PATH}`, {
  stdio: 'inherit',
  shell: '/bin/bash',
});

console.log('Done. Docs deployed.');
