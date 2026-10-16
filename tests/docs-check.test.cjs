const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkDocumentation, parseDocument } = require('../scripts/check-docs.cjs');

test('repository documentation satisfies the permanent compatibility contract', () => {
  const root = path.resolve(__dirname, '..');
  const compatibility = JSON.parse(fs.readFileSync(path.join(root, 'scripts/docs-anchors.json'), 'utf8'));
  assert.deepEqual(checkDocumentation(root, compatibility).errors, []);
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dew-docs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  const readme = `# Product

[Open the app](https://example.test/)

## Get started
Instructions.
## Basic actions
Actions.
## Recent changes
- [Unreleased](CHANGELOG.md#unreleased)
- [Latest](CHANGELOG.md#v100)
[Full changelog](CHANGELOG.md)
## Development and documentation
[Guide](docs/user-guide.md) · [Index](docs/index.md) · [Development](docs/development.md)
Created by Ziggy Qiao
`;
  write('README.md', readme);
  write('CHANGELOG.md', '# Changelog\n## Unreleased\n## v1.0.0\n');
  write('AGENTS.md', '[Maintenance](docs/documentation.md)\n[Skill](.agents/skills/is-it-dryer-out-ui/SKILL.md)');
  write('.agents/skills/is-it-dryer-out-ui/SKILL.md', '# Skill');
  write('docs/index.md', '[Design](design-system.md)\n[Camera](guides/camera.md)\n[History](history/camera.md)');
  write('docs/documentation.md', '# Maintenance');
  write('docs/user-guide.md', '# Guide');
  write('docs/development.md', '# Development');
  write('docs/design-system.md', '# Design');
  const camera = '# Camera\n\n**Audience:** People\n**Status:** Current\n**Owns:** Camera actions\n**Reviewed:** 14 October 2026\n\n## Capture\n## Capture\n<a id="old-capture"></a>\n';
  write('docs/guides/camera.md', camera);
  const history = '> Historical evidence. Instructions and “current” statements in this record describe their original period. Consult the linked current reference before implementation.\n\n[Current guidance](../guides/camera.md)\n';
  write('docs/history/camera.md', history);
  return { root, write, readme, camera, history, compatibility: { 'docs/guides/camera.md': ['capture', 'capture-1', 'old-capture'] } };
}

test('portable check passes without Git, dependencies or migration records', t => {
  const f = fixture(t);
  assert.deepEqual(checkDocumentation(f.root, f.compatibility).errors, []);
});

test('README can omit Unreleased when the changelog is empty or has its empty placeholder', t => {
  const f = fixture(t);
  f.write('README.md', f.readme.replace('- [Unreleased](CHANGELOG.md#unreleased)\n', ''));
  for (const content of ['', 'No changes recorded.\n']) {
    f.write('CHANGELOG.md', '# Changelog\n## Unreleased\n' + content + '## v1.0.0\n');
    assert.deepEqual(checkDocumentation(f.root, f.compatibility).errors, []);
  }
});

test('README still needs an Unreleased summary when pending changes exist', t => {
  const f = fixture(t);
  f.write('CHANGELOG.md', '# Changelog\n## Unreleased\n- Improve settings.\n## v1.0.0\n');
  f.write('README.md', f.readme.replace('- [Unreleased](CHANGELOG.md#unreleased)\n', ''));
  assert.ok(checkDocumentation(f.root, f.compatibility).errors.some(error => error.includes('one Unreleased link')));
  f.write('README.md', f.readme);
  assert.deepEqual(checkDocumentation(f.root, f.compatibility).errors, []);
});

test('headings handle Unicode, inline code, setext and duplicate suffix collisions', () => {
  const parsed = parseDocument('# Read `RH` &amp; café\n## Capture\n## Capture-1\n## Capture\nSetext\n======\n');
  assert.deepEqual(parsed.ids, ['read-rh--café', 'capture', 'capture-1', 'capture-2', 'setext']);
});

test('fenced code, comments, inline code and scripts do not create links or anchors', () => {
  const source = '~~~~js\n# Fake\n```\n[Ignore](missing.md)\n~~~~\n<!-- <a id="fake"></a> -->\n`[Ignore](missing.md)`\n<script>const html = \'<a href="missing.md">\';</script>\n# Real\n';
  const parsed = parseDocument(source);
  assert.deepEqual(parsed.ids, ['real']);
  assert.deepEqual(parsed.references, []);
});

test('links include balanced destinations, titles, reference links, images and HTML attributes', () => {
  const parsed = parseDocument('[Guide](guide_(new).md "Title")\n![Photo](<image%20one.png>)\n[Reference][g]\n[g]: /docs/guide.md#capture\n<a href="guide.md?a=1&amp;b=2" id="legacy">Guide</a>\n');
  assert.ok(parsed.references.some(reference => reference.url === 'guide_(new).md'));
  assert.ok(parsed.references.some(reference => reference.url === 'image%20one.png' && reference.kind === 'image'));
  assert.ok(parsed.references.some(reference => reference.url === '/docs/guide.md#capture'));
  assert.ok(parsed.references.some(reference => reference.url === 'guide.md?a=1&b=2'));
  assert.ok(parsed.ids.includes('legacy'));
});

test('encoded paths/fragments, root paths and local HTML IDs resolve offline', t => {
  const f = fixture(t);
  f.write('docs/photo one.png', 'fixture');
  f.write('docs/board.html', '<h1 id="café">Board</h1><img src="photo%20one.png"><a href="/docs/user-guide.md">Guide</a>');
  f.write('docs/index.md', '[Design](design-system.md)\n[Camera](guides/camera.md#capture-1)\n[History](history/camera.md)\n[Board](board.html#caf%C3%A9)\n[Website](https://example.invalid/)\n[Timer](shortcuts://run-shortcut?name=Ventilation%20Timer)');
  const result = checkDocumentation(f.root, f.compatibility);
  assert.deepEqual(result.errors, []);
  assert.equal(result.external, 3);
});

test('broken targets, missing fragments, bad encoding and duplicate IDs fail with locations', t => {
  const f = fixture(t);
  f.write('docs/user-guide.md', '# Guide\n[Missing](missing.md)\n[Fragment](guides/camera.md#absent)\n[Encoding](%ZZ.md)\n[Outside](../../outside.md)\n[Reference][unknown]\n<a id="guide"></a>\n');
  const errors = checkDocumentation(f.root, f.compatibility).errors;
  for (const expected of ['Missing target', 'Missing fragment', 'Invalid URL encoding', 'Link leaves the repository', 'Missing link definition', 'Duplicate anchor']) assert.ok(errors.some(error => error.includes(expected)), expected);
  assert.ok(errors.some(error => error.startsWith('docs/user-guide.md:2:')));
});

test('diagnostic line numbers survive definitions and multiline code/comments', () => {
  const source = '[g]: guide.md\n<!--\ncomment\n-->\n`code\ncontinued`\n[Reference][g]\n';
  const reference = parseDocument(source).references.find(reference => reference.label === 'Reference');
  assert.equal(reference.line, 7);
});

test('orphan topics and missing metadata fail, while compatibility pointers need no extra index link', t => {
  const f = fixture(t);
  f.write('docs/guides/orphan.md', '# Orphan');
  f.write('docs/timer-development.md', '[Current timer guidance](guides/camera.md)');
  const errors = checkDocumentation(f.root, f.compatibility).errors;
  assert.ok(errors.some(error => error.includes('orphan.md: No reading route')));
  for (const label of ['Audience', 'Status', 'Owns', 'Reviewed']) assert.ok(errors.some(error => error.includes(`Missing ${label} label`)));
  assert.ok(!errors.some(error => error.startsWith('docs/timer-development.md:')));
});

test('preserved anchors and their old paths cannot silently disappear', t => {
  const f = fixture(t);
  f.write('docs/guides/camera.md', f.camera.replace('<a id="old-capture"></a>', ''));
  let errors = checkDocumentation(f.root, f.compatibility).errors;
  assert.ok(errors.some(error => error.includes('Preserved anchor removed: #old-capture')));
  fs.unlinkSync(path.join(f.root, 'docs/guides/camera.md'));
  errors = checkDocumentation(f.root, f.compatibility).errors;
  assert.ok(errors.some(error => error.includes('Compatibility path removed')));
});

test('history needs its notice and a direct route to current documentation', t => {
  const f = fixture(t);
  f.write('docs/history/camera.md', '# Historical camera evidence');
  const errors = checkDocumentation(f.root, f.compatibility).errors;
  assert.ok(errors.some(error => error.includes('Missing historical evidence notice')));
  assert.ok(errors.some(error => error.includes('History needs a link to current guidance')));
});

test('README rules catch reordered sections, missing routes, stale release summaries and credit', t => {
  const f = fixture(t);
  f.write('README.md', f.readme.replace('## Basic actions', '## Other actions').replace('[Index](docs/index.md)', '[Index](docs/development.md)').replace('#v100', '#unreleased').replace('Created by Ziggy Qiao', '').replace('[Open the app]', '[Website]'));
  const errors = checkDocumentation(f.root, f.compatibility).errors;
  for (const expected of ['Section order', 'direct link to docs/index.md', 'one Unreleased link', 'latest documented release', 'author credit', 'prominent Open the app']) assert.ok(errors.some(error => error.includes(expected)), expected);
});
