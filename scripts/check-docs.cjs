// Offline documentation checks. No dependencies, Git checkout or migration files required.
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const topicPattern = /^docs\/(design|development|guides|explanation)\/.*\.md$/;
// Compatibility pointers are checked for links and retained paths, but do not need
// a separate reading route: entry points link directly to their destinations.
const pointers = new Set(['docs/timer-development.md', 'docs/voice/VOICE-RECOVERY-RESEARCH.md',
  'docs/voice/WEBKIT-VOICE-BUG-DRAFT.md', 'docs/voice/ios_web_speech_microphone_video_analysis.md']);
const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  });
}

function slug(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'))
    .trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}_ -]/gu, '').replace(/ /g, '-');
}

function withoutCode(text) {
  let fence;
  return text.split('\n').map(line => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && match) { fence = match[1]; return ''; }
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
      return '';
    }
    return line;
  }).join('\n');
}

function parseDocument(text, markdown = true) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const mask = value => value.replace(/[^\n]/g, ' ');
  const content = (markdown ? withoutCode(text) : text).replace(/<!--[\s\S]*?-->/g, mask);
  const headings = [], ids = [], references = [];
  const used = new Set();
  const addHeading = (value, level, line) => {
    const base = slug(value);
    let id = base, suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id); ids.push(id); headings.push({ text: value, level, id, line });
  };
  if (markdown) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const heading = lines[i].match(/^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
      if (heading) addHeading(heading[2], heading[1].length, i + 1);
      else if (i > 0 && /^ {0,3}(=+|-+)\s*$/.test(lines[i]) && lines[i - 1].trim()
        && !/^\s*(?:[#>*-]|\d+[.)])/.test(lines[i - 1])) {
        addHeading(lines[i - 1].trim(), lines[i].trim()[0] === '=' ? 1 : 2, i);
      }
    }
  }
  const scan = (markdown ? content.replace(/(`+)([\s\S]*?)\1/g, mask) : content)
    .replace(/(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)>)/gi, (_, start, body, end) => start + mask(body) + end);
  const lineAt = index => scan.slice(0, index).split('\n').length;
  for (const tag of scan.matchAll(/<[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi)) {
    const name = tag[0].match(/^<([\w:-]+)/)[1].toLowerCase();
    for (const attribute of tag[0].matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      const key = attribute[1].toLowerCase();
      const value = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4]);
      if (key === 'id' || key === 'name' && name === 'a') ids.push(value);
      if (key === 'href' || key === 'src') references.push({ url: value, line: lineAt(tag.index), kind: key === 'href' ? 'link' : 'image' });
    }
  }
  if (markdown) {
    const definitions = new Map();
    const normalise = label => label.trim().replace(/\s+/g, ' ').toLowerCase();
    const definition = /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<([^>]+)>|(\S+))(?:[ \t]+.*)?$/gm;
    for (const match of scan.matchAll(definition)) definitions.set(normalise(match[1]), decodeEntities(match[2] ?? match[3]));
    const body = scan.replace(definition, mask);
    // Balanced brackets/parentheses support image links and URLs containing parentheses.
    const balanced = (start, open, close) => {
      let depth = 1;
      for (let i = start + 1; i < body.length; i++) {
        if (body[i] === '\\') { i++; continue; }
        if (body[i] === open) depth++;
        else if (body[i] === close && --depth === 0) return i;
      }
      return -1;
    };
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '\\') { i++; continue; }
      if (body[i] !== '[') continue;
      const end = balanced(i, '[', ']');
      if (end < 0) continue;
      const label = body.slice(i + 1, end), image = body[i - 1] === '!';
      let url;
      if (body[end + 1] === '(') {
        const close = balanced(end + 1, '(', ')');
        if (close >= 0) {
          const destination = body.slice(end + 2, close).trim();
          url = destination.startsWith('<') ? destination.slice(1, destination.indexOf('>')) : destination.replace(/\s+["'][\s\S]*$/, '');
        }
      } else if (body[end + 1] === '[') {
        const close = body.indexOf(']', end + 2);
        if (close >= 0) {
          const key = body.slice(end + 2, close) || label;
          url = definitions.get(normalise(key));
          if (url === undefined) references.push({ missingDefinition: key, line: lineAt(i) });
        }
      } else url = definitions.get(normalise(label));
      if (url !== undefined) references.push({ url: decodeEntities(url.replace(/\\([\\()[\]])/g, '$1')), label, line: lineAt(i), kind: image ? 'image' : 'link' });
    }
  }
  return { content, headings, ids, references };
}

function collectDocuments(root) {
  const files = [];
  const walk = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(md|html)$/i.test(entry.name)) files.push(path.relative(root, file).split(path.sep).join('/'));
    }
  };
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.md')) files.push(entry.name);
  walk(path.join(root, 'docs'));
  walk(path.join(root, '.agents', 'skills'));
  return files.sort();
}

function checkDocumentation(root, compatibility) {
  root = path.resolve(root);
  const errors = [], documents = new Map(), edges = new Map();
  let links = 0, external = 0, protectedAnchors = 0;
  const fail = (source, message, line) => errors.push(`${source}${line ? `:${line}` : ''}: ${message}`);
  const load = name => {
    if (!documents.has(name)) documents.set(name, parseDocument(fs.readFileSync(path.join(root, name), 'utf8'), name.endsWith('.md')));
    return documents.get(name);
  };
  const files = collectDocuments(root);
  for (const name of files) load(name);
  const insideRoot = target => target === root || target.startsWith(root + path.sep);
  const realRoot = fs.realpathSync(root);
  const insideRealRoot = target => target === realRoot || target.startsWith(realRoot + path.sep);
  for (const name of files) {
    const document = load(name), seen = new Set(), outgoing = new Set();
    edges.set(name, outgoing);
    for (const id of document.ids) {
      if (seen.has(id)) fail(name, `Duplicate anchor #${id}`);
      seen.add(id);
    }
    for (const reference of document.references) {
      if (reference.missingDefinition) { fail(name, `Missing link definition [${reference.missingDefinition}]`, reference.line); continue; }
      links++;
      const url = reference.url;
      if (/^[a-z][\w+.-]*:|^\/\//i.test(url)) { external++; continue; }
      let pathname, fragment;
      try {
        const hash = url.indexOf('#');
        pathname = decodeURIComponent((hash < 0 ? url : url.slice(0, hash)).split('?')[0]);
        fragment = hash < 0 ? '' : decodeURIComponent(url.slice(hash + 1));
      } catch { fail(name, `Invalid URL encoding: ${url}`, reference.line); continue; }
      const absolute = !pathname ? path.join(root, name)
        : pathname.startsWith('/') ? path.resolve(root, '.' + pathname) : path.resolve(root, path.dirname(name), pathname);
      if (!insideRoot(absolute)) { fail(name, `Link leaves the repository: ${url}`, reference.line); continue; }
      if (!fs.existsSync(absolute)) { fail(name, `Missing target: ${url}`, reference.line); continue; }
      if (!insideRealRoot(fs.realpathSync(absolute))) { fail(name, `Link resolves outside the repository: ${url}`, reference.line); continue; }
      const target = path.relative(root, absolute).split(path.sep).join('/');
      reference.target = target; reference.fragment = fragment;
      if (fs.statSync(absolute).isDirectory()) continue;
      if (reference.kind === 'link') outgoing.add(target);
      if (fragment && /\.(md|html)$/i.test(target) && !load(target).ids.includes(fragment)) fail(name, `Missing fragment: ${url}`, reference.line);
    }
  }
  for (const name of ['README.md', 'AGENTS.md', 'docs/index.md', 'docs/documentation.md', 'docs/user-guide.md', 'docs/development.md', 'docs/design-system.md', '.agents/skills/is-it-dryer-out-ui/SKILL.md']) {
    if (!documents.has(name)) fail(name, 'Required entry point is missing');
  }
  const reachable = new Set(), queue = ['README.md', 'AGENTS.md'];
  for (let i = 0; i < queue.length; i++) {
    const name = queue[i];
    if (reachable.has(name)) continue;
    reachable.add(name); queue.push(...(edges.get(name) || []));
  }
  for (const name of files.filter(name => name.startsWith('docs/'))) {
    if (!pointers.has(name) && !reachable.has(name)) fail(name, 'No reading route from README.md or AGENTS.md');
    if (topicPattern.test(name)) {
      const header = load(name).content.split(/^## /m)[0];
      for (const field of ['Audience', 'Status', 'Owns', 'Reviewed']) {
        if (!new RegExp(`^\\*\\*${field}:\\*\\*\\s*\\S`, 'm').test(header)) fail(name, `Missing ${field} label before the first topic section`);
      }
    }
    if (name.startsWith('docs/history/') && name.endsWith('.md')) {
      if (!load(name).content.includes('Historical evidence. Instructions and “current” statements in this record describe their original period. Consult the linked current reference before implementation.')) fail(name, 'Missing historical evidence notice');
      if (!load(name).references.some(reference => reference.kind === 'link' && reference.target?.startsWith('docs/') && !reference.target.startsWith('docs/history/'))) fail(name, 'History needs a link to current guidance');
    }
  }
  for (const [name, anchors] of Object.entries(compatibility)) {
    if (!documents.has(name)) { fail(name, 'Compatibility path removed'); continue; }
    for (const anchor of anchors) {
      protectedAnchors++;
      if (!load(name).ids.includes(anchor)) fail(name, `Preserved anchor removed: #${anchor}. Retain it with an onward link.`);
    }
  }
  const readme = documents.get('README.md');
  if (readme) {
    const required = ['Get started', 'Basic actions', 'Recent changes', 'Development and documentation'];
    if (readme.headings.filter(heading => heading.level === 1).length !== 1) fail('README.md', 'Keep one product title');
    const sections = readme.headings.filter(heading => heading.level === 2);
    if (JSON.stringify(sections.map(heading => heading.text)) !== JSON.stringify(required)) fail('README.md', `Section order must be: ${required.join(' → ')}`);
    const sectionReferences = title => {
      const index = sections.findIndex(heading => heading.text === title);
      return index < 0 ? [] : readme.references.filter(reference => reference.line > sections[index].line && reference.line < (sections[index + 1]?.line ?? Infinity));
    };
    for (const target of ['docs/user-guide.md', 'docs/index.md', 'docs/development.md']) {
      if (!sectionReferences('Development and documentation').some(reference => reference.kind === 'link' && reference.target === target)) fail('README.md', `Development and documentation needs a direct link to ${target}`);
    }
    const recent = sectionReferences('Recent changes');
    const changelog = documents.get('CHANGELOG.md');
    const releases = changelog?.headings.filter(heading => heading.level === 2 && /^v\d/.test(heading.text)) || [];
    const unreleased = changelog?.headings.find(heading => heading.level === 2 && heading.id === 'unreleased');
    const nextSection = changelog?.headings.find(heading => heading.level <= 2 && heading.line > (unreleased?.line ?? Infinity));
    const pending = unreleased ? changelog.content.split('\n').slice(unreleased.line, nextSection ? nextSection.line - 1 : undefined)
      .filter(line => line.trim() && !/^No changes recorded\.?$/i.test(line.trim())).length > 0 : false;
    const unreleasedLinks = recent.filter(reference => reference.target === 'CHANGELOG.md' && reference.fragment === 'unreleased').length;
    if (unreleasedLinks > 1 || pending && unreleasedLinks !== 1) fail('README.md', 'Recent changes needs one Unreleased link when changes are pending, and at most one otherwise');
    if (releases[0] && !recent.some(reference => reference.target === 'CHANGELOG.md' && reference.fragment === releases[0].id)) fail('README.md', 'Recent changes needs a link to the latest documented release');
    if (!recent.some(reference => reference.target === 'CHANGELOG.md' && !reference.fragment)) fail('README.md', 'Recent changes needs a full-changelog link');
    if (!readme.references.some(reference => reference.label === 'Open the app' && /^https:\/\//.test(reference.url) && reference.line < (sections[0]?.line ?? Infinity))) fail('README.md', 'Keep the prominent Open the app link before Get started');
    if (!/\nCreated by Ziggy Qiao\s*$/.test(readme.content)) fail('README.md', 'Keep the author credit at the end');
  }
  return { errors, documents: files.length, links, external, protectedAnchors };
}

if (require.main === module) {
  try {
    const compatibility = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs-anchors.json'), 'utf8'));
    const result = checkDocumentation(repositoryRoot, compatibility);
    if (result.errors.length) {
      console.error(result.errors.map(error => `ERROR ${error}`).join('\n'));
      console.error(`FAIL ${result.errors.length} documentation problem(s).`);
      process.exitCode = 1;
    } else console.log(`PASS ${result.documents} documents, ${result.links} references and ${result.protectedAnchors} preserved anchors. ${result.external} external/application links classified without opening them.`);
  } catch (error) { console.error(`Documentation check could not run: ${error.message}`); process.exitCode = 1; }
}

module.exports = { checkDocumentation, parseDocument };
