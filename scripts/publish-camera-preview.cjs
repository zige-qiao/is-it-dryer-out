// Build a Pages deployment commit without changing local branches or pushing.
// The main site's tree is preserved; only preview/ and .nojekyll are added.
const { execFileSync } = require('node:child_process');

const PREVIEW_NAME = 'camera-reading-recognition';
const PREVIEW_CACHE_PREFIX = 'dew-camera-preview-v';

function previewWorker(source) {
  return source.replaceAll('is-it-dryer-out-v', PREVIEW_CACHE_PREFIX)
    .replaceAll('dew-camera-ocr-6.0.1-v1', 'dew-camera-preview-ocr-6.0.1-v1');
}

function previewConfig(source, commit) {
  return source.replace(/(export const \w*STORAGE_KEY = ")([^"]+)(";)/g,
    (_, before, key, after) => `${before}camera-preview-${key}${after}`)
    .replace(/export const APP_BUILD_VERSION = "[^"]+";/,
      `export const APP_BUILD_VERSION = "${PREVIEW_NAME} (${commit.slice(0, 7)})";`);
}

function buildDeployment(baseRef = 'origin/main', previewRef = 'HEAD') {
  const git = (args, input) => execFileSync('git', args, { input, encoding: 'utf8' }).trimEnd();
  const baseCommit = git(['rev-parse', '--verify', `${baseRef}^{commit}`]);
  const previewCommit = git(['rev-parse', '--verify', `${previewRef}^{commit}`]);
  const entries = tree => git(['ls-tree', '-z', tree]).split('\0').filter(Boolean).map(line => {
    const [header, name] = line.split('\t');
    const [mode, type, sha] = header.split(' ');
    return { mode, type, sha, name };
  });
  const tree = items => git(['mktree', '-z'], items.map(({ mode, type, sha, name }) => `${mode} ${type} ${sha}\t${name}\0`).join(''));
  const blob = text => git(['hash-object', '-w', '--stdin'], text);
  const folder = (name, sha) => ({ name, sha, mode: '040000', type: 'tree' });
  const file = (name, contents) => ({ name, sha: blob(contents), mode: '100644', type: 'blob' });
  const replace = (items, entry) => [...items.filter(item => item.name !== entry.name), entry];
  const read = entry => git(['cat-file', 'blob', entry.sha]) + '\n';

  const root = entries(previewCommit);
  const required = ['index.html', 'styles.css', 'app.js', 'service-worker.js', 'manifest.webmanifest', 'favicon-v4.png', 'icon.svg', 'src', 'vendor'];
  let preview = required.map(name => {
    const entry = root.find(item => item.name === name);
    if (!entry) throw Error(`Missing preview asset: ${name}`);
    return entry;
  });
  // Standalone phone diagnostics are deployed only inside the isolated preview.
  for (const name of ['camera-flash-test.html', 'camera-flash-test.js']) {
    const entry = root.find(item => item.name === name);
    if (entry) preview.push(entry);
  }
  const worker = preview.find(entry => entry.name === 'service-worker.js');
  preview = replace(preview, file('service-worker.js', previewWorker(read(worker))));

  const src = entries(preview.find(entry => entry.name === 'src').sha);
  const config = src.find(entry => entry.name === 'config.js');
  const camera = src.find(entry => entry.name === 'camera');
  const cameraFiles = entries(camera.sha);
  const recognition = cameraFiles.find(entry => entry.name === 'recognition.js');
  const recognitionSource = read(recognition).replaceAll('dew-camera-ocr-6.0.1-v1', 'dew-camera-preview-ocr-6.0.1-v1');
  const cameraTree = tree(replace(cameraFiles, file('recognition.js', recognitionSource)));
  let previewSrc = replace(src, file('config.js', previewConfig(read(config), previewCommit)));
  previewSrc = replace(previewSrc, folder('camera', cameraTree));
  preview = replace(preview, folder('src', tree(previewSrc)));

  const manifest = JSON.parse(read(preview.find(entry => entry.name === 'manifest.webmanifest')));
  Object.assign(manifest, { name: 'Is it dryer out — camera preview', short_name: 'Camera preview', id: '.', scope: '.' });
  preview = replace(preview, file('manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n'));
  const docs = entries(root.find(entry => entry.name === 'docs').sha);
  const timerHelp = docs.find(entry => entry.name === 'timer-shortcut.html');
  if (!timerHelp) throw Error('Missing timer help page');
  preview.push(folder('docs', tree([timerHelp])));
  preview.push(file('preview.json', JSON.stringify({ branch: PREVIEW_NAME, commit: previewCommit }, null, 2) + '\n'));

  const main = entries(baseCommit);
  const oldPreview = main.find(entry => entry.name === 'preview');
  if (oldPreview && oldPreview.type !== 'tree') throw Error('The preview path is not a directory');
  const previews = replace(oldPreview ? entries(oldPreview.sha) : [], folder(PREVIEW_NAME, tree(preview)));
  let deployment = replace(main, folder('preview', tree(previews)));
  deployment = replace(deployment, file('.nojekyll', ''));
  // Assert that none of the existing main app files changed.
  for (const original of main.filter(entry => !['preview', '.nojekyll'].includes(entry.name))) {
    if (deployment.find(entry => entry.name === original.name)?.sha !== original.sha) throw Error(`Main asset changed: ${original.name}`);
  }
  const deploymentCommit = git(['commit-tree', tree(deployment), '-p', baseCommit],
    `Publish isolated camera recognition preview\n\nSource: ${previewCommit}\nURL: /preview/${PREVIEW_NAME}/\n`);
  return { baseCommit, previewCommit, deploymentCommit };
}

module.exports = { previewWorker, previewConfig, buildDeployment };
if (require.main === module) console.log(JSON.stringify(buildDeployment(process.argv[2], process.argv[3]), null, 2));
