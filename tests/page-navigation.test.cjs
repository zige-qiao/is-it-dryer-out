const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPageNavigation } = require('../src/ui/page-navigation.js');
const { element } = require('./helpers/browser.cjs');

function fixture(hash = '', motion = false, stageWidth = 390) {
  const document = element(), window = element(), stage = element(), track = element();
  let trackWrites = 0, trackTransform;
  Object.defineProperty(track.style, 'transform', { configurable: true,
    get: () => trackTransform, set(value) { trackTransform = value; trackWrites++; } });
  track.style.removeProperty = key => { if (key === 'transform') trackTransform = undefined; };
  const views = { overview: element(), why: element() }, headings = { overview: element(), why: element() };
  const links = Object.keys(views).map(id => Object.assign(element(), { dataset: { pageLink: id } }));
  let overlay = false, selection = '', eligible = true, redraws = 0, suppressed = 0;
  const animations = [];
  let clock = 0;
  let observer, hiddenWrites = 0, geometryReads = 0, overlayReads = 0, mediaReads = 0, nextFrame = 0;
  const frames = new Map(), frameCallbacks = [];
  const requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback); frameCallbacks.push(callback); return nextFrame;
  };
  const cancelAnimationFrame = id => frames.delete(id);
  document.documentElement = element(); document.body = element(); document.visibilityState = 'visible';
  document.activeElement = null;
  for (const [id, view] of Object.entries(views)) {
    let hidden = false;
    Object.defineProperty(view, 'hidden', { get: () => hidden, set(value) { hidden = value; hiddenWrites++; } });
    view.contains = node => node?.view === id;
    view.style.removeProperty = key => delete view.style[key];
    headings[id].focus = () => { document.activeElement = headings[id]; };
    headings[id].view = id;
    if (motion) view.animate = (frames, options) => {
      const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
      animations.push(animation); return animation;
    };
  }
  stage.getBoundingClientRect = () => { geometryReads++; return { width: stageWidth }; };
  document.querySelectorAll = () => links;
  document.querySelector = selector => {
    if (selector.startsWith('dialog[open]')) overlayReads++;
    return ({
    '#pageStage': stage, '#pageTrack': track, '#overviewPage': views.overview, '#whyPage': views.why,
    '#explanationToggle': headings.why, '#decisionLabel': headings.overview,
    })[selector] || (selector.startsWith('dialog[open]') && overlay ? element() : null);
  };
  document.dispatchEvent = event => document.emit(event.type, event);
  window.location = { hash }; window.scrollY = 0; window.innerWidth = 390;
  window.scrollTo = ({ top }) => { window.scrollY = top; };
  window.getSelection = () => ({ toString: () => selection });
  window.matchMedia = () => { mediaReads++; return { matches: !motion }; };
  const history = [];
  window.history = { state: { retained: true },
    pushState(state, title, hash) { history.push(hash); window.location.hash = hash; },
    replaceState(state, title, hash) { window.location.hash = hash; },
  };
  const controller = createPageNavigation({ renderChart() { redraws++; }, suppressGestureClick() { suppressed++; },
    canStartPointerGesture: () => eligible }, { document, window, Event, requestAnimationFrame, cancelAnimationFrame,
    performance: { now: () => clock },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} } });
  controller.bind();
  const target = (id = 'overview', kind = '') => ({ view: id,
    closest: selector => selector.split(',').map(part => part.trim()).includes(
      ({ chart: '#ahChart', link: 'a', 'tab-bar': 'nav' })[kind] || kind) ? element() : null });
  const touch = (name, x, y = 200, options = {}) => {
    let prevented = false;
    const point = { clientX: x, clientY: y };
    clock += 200; // Existing fixtures represent slow drags; flicks supply explicit timing.
    document.emit(name, { target: target(), touches: name === 'touchend' ? [] : [point], changedTouches: [point],
      timeStamp: clock, cancelable: true, preventDefault() { prevented = true; }, ...options });
    return prevented;
  };
  const click = id => links.find(link => link.dataset.pageLink === id).emit('click', { preventDefault() {} });
  return { document, window, stage, track, views, headings, links, touch, target, click, animations, history, controller, frameCallbacks,
    clock(value) { clock = value; },
    width(value) { stageWidth = value; }, get trackWrites() { return trackWrites; }, get hiddenWrites() { return hiddenWrites; },
    paint() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); },
    get pendingFrames() { return frames.size; },
    get geometryReads() { return geometryReads; }, get overlayReads() { return overlayReads; }, get mediaReads() { return mediaReads; },
    overlay(value) { overlay = value; }, selection(value) { selection = value; }, eligible(value) { eligible = value; },
    flushMutations() {
      for (let count = 0; count < 5; count++) {
        const before = hiddenWrites; observer();
        if (hiddenWrites === before) return;
      }
      throw Error('overlay observer keeps mutating its own observed view attributes');
    },
    get redraws() { return redraws; }, get suppressed() { return suppressed; } };
}

test('initial routes repair unknown hashes and hide inactive content from focus and accessibility', () => {
  for (const hash of ['', '#unknown', '#overview', '#why']) {
    const f = fixture(hash), id = hash === '#why' ? 'why' : 'overview', other = id === 'why' ? 'overview' : 'why';
    assert.equal(f.window.location.hash, `#${id}`);
    assert.equal(f.controller.isOverview(), id === 'overview');
    assert.equal(f.views[id].hidden, false); assert.equal(f.views[id].inert, false);
    assert.equal(f.views[other].hidden, true); assert.equal(f.views[other].inert, true);
    assert.equal(f.views[other].getAttribute('aria-hidden'), 'true');
    assert.equal(f.links.find(link => link.dataset.pageLink === id).getAttribute('aria-current'), 'page');
    assert.equal(f.history.length, 0);
  }
});

test('tabs retain scroll positions, restore hidden focus and redraw only on returning to Overview', () => {
  const f = fixture(); f.window.scrollY = 180; f.document.activeElement = f.headings.overview;
  f.click('why'); assert.equal(f.window.scrollY, 0); assert.equal(f.document.activeElement, f.headings.why);
  f.window.scrollY = 320; f.click('overview'); assert.equal(f.window.scrollY, 180);
  f.click('why'); assert.equal(f.window.scrollY, 320); assert.equal(f.redraws, 2);
  assert.deepEqual(f.history, ['#why', '#overview', '#why']);
  f.window.location.hash = '#overview'; f.window.emit('popstate'); f.window.emit('hashchange');
  assert.equal(f.controller.isOverview(), true); assert.equal(f.redraws, 3);
  assert.equal(f.history.length, 3, 'browser history does not add a duplicate entry');
});

test('one-finger horizontal gestures switch in both directions without wrapping', () => {
  const f = fixture();
  f.touch('touchstart', 280); assert.equal(f.touch('touchmove', 40), true);
  assert.equal(f.views.why.inert, true, 'drag preview cannot receive focus');
  f.touch('touchend', 40); assert.equal(f.controller.isOverview(), false);
  f.touch('touchstart', 280, 200, { target: f.target('why') }); f.touch('touchmove', 40); f.touch('touchend', 40);
  assert.equal(f.window.location.hash, '#why', 'left swipe at the final tab cannot wrap');
  f.touch('touchstart', 100, 200, { target: f.target('why') }); f.touch('touchmove', 340); f.touch('touchend', 340);
  assert.equal(f.controller.isOverview(), true);
  assert.equal(f.suppressed, 4, 'recognition and commit use the shared click guard');
});

test('short, diagonal, vertical and multi-touch gestures never navigate', () => {
  for (const kind of ['short', 'vertical', 'diagonal', 'multi', 'ineligible', 'scroll', 'native-cancel']) {
    const f = fixture();
    if (kind === 'ineligible') f.eligible(false);
    const x = 280;
    f.touch('touchstart', x);
    if (kind === 'scroll') f.window.scrollY = 30;
    const dx = kind === 'short' ? 30 : kind === 'vertical' ? 5 : 240;
    const dy = ['vertical', 'diagonal'].includes(kind) ? 320 : 0;
    f.touch('touchmove', x - dx, 200 + dy, kind === 'multi' ? { touches: [{ clientX: 100, clientY: 200 }, {}] } :
      kind === 'native-cancel' ? { cancelable: false } : {});
    f.touch('touchend', x - dx, 200 + dy);
    assert.equal(f.window.location.hash, '#overview', kind);
    assert.equal(f.views.why.hidden, true, kind);
  }
});

test('chart descendants, sheets and cancellation keep their gestures without changing tabs', () => {
  for (const kind of ['chart', 'sheet', 'touchcancel', 'resize', 'hidden']) {
    const f = fixture();
    if (kind === 'sheet') f.overlay(true);
    f.touch('touchstart', 280, 200, kind === 'chart' ? { target: f.target('overview', 'chart') } : {});
    f.touch('touchmove', 40);
    if (kind === 'touchcancel') f.document.emit('touchcancel');
    if (kind === 'resize') f.window.emit('resize');
    if (kind === 'hidden') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    f.touch('touchend', 40);
    assert.equal(f.controller.isOverview(), true, kind);
    assert.equal(f.views.why.hidden, true, kind);
  }
});

test('controls, tab bar, blank background, selected text and screen edges allow page swipes', () => {
  for (const kind of ['button', 'link', 'summary', 'input', 'tab-bar', 'background', 'selection', 'edge-left', 'edge-right']) {
    const f = fixture(kind === 'edge-left' ? '#why' : '#overview');
    const id = f.controller.isOverview() ? 'overview' : 'why';
    const target = f.target(['tab-bar', 'background'].includes(kind) ? null : id, kind);
    if (kind === 'selection') f.selection('selected text');
    const x = kind === 'edge-left' ? 4 : kind === 'edge-right' ? 386 : id === 'overview' ? 280 : 100;
    const end = id === 'overview' ? x - 240 : x + 240;
    f.touch('touchstart', x, 200, { target });
    assert.equal(f.touch('touchmove', end), true, kind);
    f.touch('touchend', end);
    assert.equal(f.window.location.hash, id === 'overview' ? '#why' : '#overview', kind);
    assert.equal(f.suppressed, 2, `${kind}: swipe suppresses control activation`);
  }
});

test('a pending history change waits for the Settings sheet to close', () => {
  const f = fixture('#why'); f.overlay(true); f.window.location.hash = '#overview'; f.window.emit('popstate');
  assert.equal(f.controller.isOverview(), false);
  f.overlay(false); f.document.emit('close'); assert.equal(f.controller.isOverview(), true);
});

test('opening a sheet cancels a live swipe without causing an observer mutation loop', () => {
  const f = fixture('#overview', true); f.overlay(true); assert.doesNotThrow(() => f.flushMutations());
  f.overlay(false); f.touch('touchstart', 280); f.touch('touchmove', 40);
  assert.equal(f.views.why.hidden, false);
  f.overlay(true); assert.doesNotThrow(() => f.flushMutations());
  f.touch('touchend', 40);
  assert.equal(f.controller.isOverview(), true); assert.equal(f.views.why.hidden, true);
});

test('the track follows the finger and settles in 360ms; rapid navigation cleans up previews', () => {
  const f = fixture('#overview', true);
  f.touch('touchstart', 280); f.touch('touchmove', 40);
  f.paint();
  assert.equal(f.track.style.transform, 'translateX(-240px)');
  assert.equal(f.views.why.style.transform, 'translateX(390px)');
  f.touch('touchend', 40);
  assert.equal(f.animations.at(-1).options.duration, 360);
  assert.equal(f.animations.at(-1).options.easing, 'cubic-bezier(0.3, 0.45, 0.4, 1)');
  assert.equal(f.track.style.transform, undefined, 'release resets the shared track');
  assert.equal(f.views.overview.inert, true);
  const animationCount = f.animations.length;
  f.click('overview');
  assert.equal(f.animations.length, animationCount, 'tab activation does not start another slide');
  assert.equal(f.views.why.hidden, true); assert.equal(f.views.overview.style.transform, undefined);
  assert.ok(f.animations.every(animation => animation.cancelled));
});

test('tab activation switches immediately even when motion is enabled', () => {
  const f = fixture('#overview', true);
  f.window.scrollY = 180;
  f.document.activeElement = f.headings.overview;
  f.click('why');
  assert.equal(f.window.location.hash, '#why');
  assert.equal(f.views.overview.hidden, true);
  assert.equal(f.views.why.hidden, false);
  assert.equal(f.views.why.inert, false);
  assert.equal(f.document.activeElement, f.headings.why);
  assert.equal(f.animations.length, 0);
  f.click('overview');
  assert.equal(f.window.scrollY, 180);
  assert.equal(f.redraws, 2);
  assert.equal(f.animations.length, 0);
  assert.deepEqual(f.history, ['#why', '#overview']);
});

test('activating the selected tab during a slide clears the preview immediately', () => {
  const f = fixture('#overview', true);
  f.touch('touchstart', 280); f.touch('touchmove', 40); f.touch('touchend', 40);
  const animationCount = f.animations.length;
  f.click('why');
  assert.equal(f.views.overview.hidden, true);
  assert.equal(f.views.why.style.transform, undefined);
  assert.equal(f.animations.length, animationCount);
  assert.ok(f.animations.every(animation => animation.cancelled));
  assert.deepEqual(f.history, ['#why'], 'selected tab does not add duplicate history');
});

test('touch events batch into one paint of the latest position without repeated reads', () => {
  const f = fixture('#overview', true);
  f.touch('touchstart', 180);
  const reads = [f.geometryReads, f.overlayReads, f.mediaReads];
  for (const x of [160, 140, 100]) assert.equal(f.touch('touchmove', x), true);
  assert.equal(f.pendingFrames, 1);
  assert.equal(f.views.overview.style.transform, undefined, 'paint waits for the browser frame');
  assert.equal(f.views.why.style.transform, 'translateX(390px)', 'preview starts offscreen');
  assert.deepEqual([f.geometryReads, f.overlayReads, f.mediaReads], reads);
  f.paint();
  assert.equal(f.track.style.transform, 'translateX(-80px)');
  assert.equal(f.trackWrites, 1, 'one transform write moves both pages');
  assert.equal(f.views.why.style.transform, 'translateX(390px)');
  f.touch('touchmove', 90); f.touch('touchmove', 80);
  assert.equal(f.pendingFrames, 1); f.paint();
  assert.equal(f.track.style.transform, 'translateX(-100px)');
  assert.equal(f.trackWrites, 2);
});

test('release uses final travel for commitment but the last paint for settling', () => {
  for (const painted of [false, true]) {
    const f = fixture('#overview', true);
    f.touch('touchstart', 280); f.touch('touchmove', 250);
    if (painted) f.paint();
    f.touch('touchmove', 40); f.touch('touchend', 40);
    assert.equal(f.window.location.hash, '#why');
    assert.equal(f.pendingFrames, 0);
    assert.equal(f.animations.at(-2).frames[0].transform, `translateX(${painted ? -30 : 0}px)`);
    f.paint(); assert.equal(f.views.why.style.transform, undefined);
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), true);
    f.animations.at(-1).onfinish();
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false);
  }
  const f = fixture('#overview', true);
  f.touch('touchstart', 180); f.touch('touchmove', 140); f.touch('touchend', 140);
  assert.equal(f.pendingFrames, 0); assert.equal(f.window.location.hash, '#overview');
  assert.equal(f.animations[0].frames[0].transform, 'translateX(0px)');
});

test('interruptions cancel queued painting and motion hints', () => {
  for (const kind of ['tab', 'history', 'sheet', 'multitouch', 'resize', 'hidden', 'pagehide', 'cancel']) {
    const f = fixture('#overview', true);
    f.touch('touchstart', 180); f.touch('touchmove', 100);
    const stalePaint = f.frameCallbacks.at(-1);
    if (kind === 'tab') f.click('why');
    if (kind === 'history') f.window.emit('popstate');
    if (kind === 'sheet') { f.overlay(true); f.flushMutations(); }
    if (kind === 'multitouch') f.touch('touchmove', 100, 200, { touches: [{}, {}] });
    if (kind === 'resize') f.window.emit('resize');
    if (kind === 'hidden') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    if (kind === 'pagehide') f.window.emit('pagehide');
    if (kind === 'cancel') f.document.emit('touchcancel');
    assert.equal(f.pendingFrames, 0, kind);
    stalePaint();
    assert.equal(f.views.overview.style.transform, undefined, kind);
    assert.equal(f.views.why.style.transform, undefined, kind);
    assert.equal(f.track.style.transform, undefined, kind);
    assert.equal(f.stage.classList.contains('is-page-preparing'), false, kind);
    assert.equal(f.document.documentElement.classList.contains('is-page-preparing'), false, kind);
    assert.equal(f.stage.classList.contains('is-page-settling'), false, kind);
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false, kind);
  }
});

test('reduced motion never reveals or paints a moving preview', () => {
  const f = fixture('#overview');
  f.touch('touchstart', 280); f.touch('touchmove', 40);
  assert.equal(f.pendingFrames, 0); assert.equal(f.views.why.hidden, true);
  assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false);
  f.touch('touchend', 40); assert.equal(f.window.location.hash, '#why');
  assert.equal(f.animations.length, 0);
});

test('a stale callback cannot paint or clear the next gesture frame', () => {
  const f = fixture('#overview', true);
  f.touch('touchstart', 180); f.touch('touchmove', 100);
  const stalePaint = f.frameCallbacks.at(-1);
  f.document.emit('touchcancel');
  f.touch('touchstart', 180); f.touch('touchmove', 120);
  stalePaint();
  assert.equal(f.pendingFrames, 1);
  f.touch('touchmove', 80); assert.equal(f.pendingFrames, 1);
  f.paint(); assert.equal(f.track.style.transform, 'translateX(-100px)');
});

test('preparation hints clear on a tap, rejected intent and end-boundary gestures', () => {
  for (const kind of ['tap', 'vertical', 'boundary']) {
    const f = fixture('#overview', true);
    f.touch('touchstart', 180);
    assert.equal(f.stage.classList.contains('is-page-preparing'), true);
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false);
    if (kind === 'vertical') f.touch('touchmove', 180, 250);
    if (kind === 'boundary') f.touch('touchmove', 250);
    f.touch('touchend', 180);
    assert.equal(f.stage.classList.contains('is-page-preparing'), false);
    assert.equal(f.document.documentElement.classList.contains('is-page-preparing'), false);
    assert.equal(f.views.why.hidden, true);
    assert.equal(f.pendingFrames, 0);
  }
});

test('reversal returns from the painted track offset with the gentle curve', () => {
  const f = fixture('#overview', true);
  f.touch('touchstart', 180); f.touch('touchmove', 100); f.paint();
  f.touch('touchmove', 160); f.paint();
  f.touch('touchend', 160);
  assert.equal(f.window.location.hash, '#overview');
  assert.equal(f.track.style.transform, undefined);
  assert.equal(f.animations[0].frames[0].transform, 'translateX(-20px)');
  assert.equal(f.animations[1].frames[0].transform, 'translateX(370px)');
  assert.equal(f.animations[0].options.duration, 360);
  assert.equal(f.animations[0].options.easing, 'cubic-bezier(0.3, 0.45, 0.4, 1)');
  f.animations[0].onfinish();
  assert.equal(f.stage.classList.contains('is-page-settling'), false);
  assert.equal(f.views.why.hidden, true);
});

test('shared-track swipes preserve different saved scroll positions and vertical preview alignment', () => {
  const f = fixture('#overview', true);
  f.window.scrollY = 180; f.click('why'); f.window.scrollY = 320;
  f.touch('touchstart', 100, 200, { target: f.target('why') }); f.touch('touchmove', 340); f.paint();
  assert.equal(f.views.overview.style.top, '140px');
  assert.equal(f.track.style.transform, 'translateX(240px)');
  f.touch('touchend', 340);
  assert.equal(f.window.scrollY, 180);
  assert.equal(f.views.why.style.top, '-140px');
  assert.equal(f.animations.at(-2).frames[0].transform, 'translateX(240px)');
  assert.equal(f.animations.at(-1).frames[0].transform, 'translateX(-150px)');
  f.animations.at(-1).onfinish();
  f.click('why'); assert.equal(f.window.scrollY, 320);
});

test('browser history retains its existing slide timing', () => {
  const f = fixture('#overview', true);
  f.window.location.hash = '#why'; f.window.emit('popstate');
  assert.equal(f.animations.at(-1).options.duration, 160);
  assert.equal(f.animations.at(-1).options.easing, 'ease-out');
});


test('touch-down prepares an inert offscreen neighbour before horizontal recognition in either direction', () => {
  for (const id of ['overview', 'why']) {
    const f = fixture(`#${id}`, true), other = id === 'overview' ? 'why' : 'overview';
    const direction = id === 'overview' ? 1 : -1;
    f.window.scrollY = 180; f.document.activeElement = f.headings[id];
    f.touch('touchstart', 180, 200, { target: f.target(id) });
    assert.equal(f.views[other].hidden, false, 'incoming content can be laid out before the first drag frame');
    assert.equal(f.views[other].style.transform, `translateX(${direction * 390}px)`);
    assert.equal(f.views[other].style.top, '180px');
    assert.equal(f.views[other].inert, true);
    assert.equal(f.views[other].getAttribute('aria-hidden'), 'true');
    assert.equal(f.window.location.hash, `#${id}`);
    assert.equal(f.window.scrollY, 180);
    assert.equal(f.document.activeElement, f.headings[id]);
    assert.equal(f.document.documentElement.classList.contains('is-page-preparing'), true);
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false);
    const hiddenWrites = f.hiddenWrites;
    f.touch('touchmove', 180 - direction * 5);
    assert.equal(f.pendingFrames, 0, 'the recognition threshold remains unchanged');
    f.touch('touchmove', 180 - direction * 20);
    assert.equal(f.hiddenWrites, hiddenWrites, 'recognition does not reveal or relayout a page');
    f.paint();
    assert.equal(f.track.style.transform, `translateX(${-direction * 20}px)`);
    f.touch('touchend', 180 - direction * 20);
    assert.equal(f.animations[0].options.duration, 360);
    f.animations[0].onfinish();
    assert.equal(f.views[other].hidden, true);
    assert.equal(f.document.documentElement.classList.contains('is-page-preparing'), false);
  }
});

test('interruptions clean up an unrecognised prepared preview', () => {
  for (const kind of ['tab', 'history', 'sheet', 'multitouch', 'resize', 'hidden', 'pagehide', 'cancel']) {
    const f = fixture('#overview', true);
    f.touch('touchstart', 180);
    if (kind === 'tab') f.click('why');
    if (kind === 'history') f.window.emit('popstate');
    if (kind === 'sheet') { f.overlay(true); f.flushMutations(); }
    if (kind === 'multitouch') f.touch('touchmove', 180, 200, { touches: [{}, {}] });
    if (kind === 'resize') f.window.emit('resize');
    if (kind === 'hidden') { f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    if (kind === 'pagehide') f.window.emit('pagehide');
    if (kind === 'cancel') f.document.emit('touchcancel');
    assert.equal(f.pendingFrames, 0, kind);
    assert.equal(f.views[kind === 'tab' ? 'overview' : 'why'].hidden, true, kind);
    assert.equal(f.stage.classList.contains('is-page-preparing'), false, kind);
    assert.equal(f.document.documentElement.classList.contains('is-page-preparing'), false, kind);
    assert.equal(f.document.documentElement.classList.contains('is-page-moving'), false, kind);
  }
});


test('swipes commit strictly beyond halfway at integer and fractional widths in both directions', () => {
  for (const width of [390, 390.5, 960]) for (const motion of [false, true]) for (const id of ['overview', 'why']) {
    for (const delta of [-.01, 0, .01]) {
      const f = fixture(`#${id}`, motion, width), direction = id === 'overview' ? 1 : -1;
      const x = direction === 1 ? width * .85 : width * .15, end = x - direction * (width / 2 + delta);
      f.touch('touchstart', x); f.touch('touchmove', end); f.paint(); f.touch('touchend', end);
      const destination = delta > 0 ? (id === 'overview' ? 'why' : 'overview') : id;
      assert.equal(f.window.location.hash, `#${destination}`, `${id}, width ${width}, delta ${delta}, motion ${motion}`);
      assert.equal(f.history.length, delta > 0 ? 1 : 0);
      assert.equal(f.pendingFrames, 0);
      if (motion) assert.equal(f.animations.at(-1).options.duration, 360);
    }
  }
});

test('crossing halfway then retreating returns, and slow short drags return', () => {
  for (const id of ['overview', 'why']) for (const retreat of [false, true]) {
    const f = fixture(`#${id}`, true), direction = id === 'overview' ? 1 : -1;
    const x = direction === 1 ? 280 : 100;
    f.touch('touchstart', x);
    if (retreat) { f.touch('touchmove', x - direction * 240); f.paint(); }
    const end = x - direction * 80;
    f.touch('touchmove', end); f.touch('touchend', end);
    assert.equal(f.window.location.hash, `#${id}`);
    assert.equal(f.history.length, 0);
    assert.equal(f.pendingFrames, 0);
    assert.equal(f.animations[0].frames[0].transform, `translateX(${retreat ? -direction * 240 : 0}px)`);
    f.animations[0].onfinish();
    assert.equal(f.views[id === 'overview' ? 'why' : 'overview'].hidden, true);
  }
});

test('midpoint commitment uses touch-down width and final release travel before queued painting', () => {
  for (const id of ['overview', 'why']) {
    const f = fixture(`#${id}`, true), direction = id === 'overview' ? 1 : -1;
    const x = direction === 1 ? 280 : 100;
    f.touch('touchstart', x); f.touch('touchmove', x - direction * 30); f.paint();
    const reads = f.geometryReads;
    f.width(780); // Geometry changed without a resize event: release still uses the captured width.
    f.touch('touchmove', x - direction * 190);
    f.touch('touchend', x - direction * 196);
    assert.equal(f.window.location.hash, id === 'overview' ? '#why' : '#overview');
    assert.equal(f.geometryReads, reads);
    assert.equal(f.pendingFrames, 0);
    assert.equal(f.animations.at(-2).frames[0].transform, `translateX(${-direction * 30}px)`);
    assert.equal(f.animations.at(-1).frames[0].transform, `translateX(${direction * 360}px)`);
  }
});

test('deliberate flicks honour travel and velocity boundaries in both directions', () => {
  for (const id of ['overview', 'why']) for (const motion of [false, true]) {
    for (const [travel, duration, committed] of [[47.99, 80, false], [48, 96, true], [48, 96.01, false], [60, 100, true], [60, 100.01, false]]) {
      const f = fixture(`#${id}`, motion), direction = id === 'overview' ? 1 : -1;
      const x = id === 'overview' ? 280 : 100;
      f.touch('touchstart', x, 200, { timeStamp: 1000 });
      f.touch('touchmove', x - direction * 20, 200, { timeStamp: 1020 });
      f.touch('touchend', x - direction * travel, 200, { timeStamp: 1000 + duration });
      const expected = committed;
      assert.equal(f.window.location.hash, `#${expected ? (id === 'overview' ? 'why' : 'overview') : id}`,
        `${id}, ${travel}px / ${duration}ms`);
      assert.equal(f.pendingFrames, 0, 'release cancels a frame that has not painted');
      if (motion) {
        assert.equal(f.animations[0].frames[0].transform, 'translateX(0px)');
        assert.equal(f.animations[0].options.duration, 360);
      }
    }
  }
});

test('the final 100ms and at most 32 samples determine release velocity', () => {
  for (const id of ['overview', 'why']) {
    const direction = id === 'overview' ? 1 : -1, x = id === 'overview' ? 280 : 100;
    const f = fixture(`#${id}`);
    f.touch('touchstart', x, 200, { timeStamp: 0 });
    f.touch('touchmove', x - direction * 20, 200, { timeStamp: 900 });
    f.touch('touchend', x - direction * 80, 200, { timeStamp: 1000 });
    assert.equal(f.window.location.hash, id === 'overview' ? '#why' : '#overview', 'recent velocity beats slow overall travel');

    const bounded = fixture(`#${id}`);
    bounded.touch('touchstart', x, 200, { timeStamp: 0 });
    for (let i = 0; i < 32; i++) bounded.touch('touchmove', x - direction * (48 + i / 10), 200, { timeStamp: 40 + i });
    bounded.touch('touchend', x - direction * 51.2, 200, { timeStamp: 72 });
    assert.equal(bounded.window.location.hash, `#${id}`, 'dropping old samples avoids a misleading fast average');
  }
});

test('pauses, reversed final movement and invalid timing never trigger a flick', () => {
  for (const id of ['overview', 'why']) for (const kind of ['pause', 'reversal', 'release-reversal', 'zero', 'invalid', 'backwards', 'missing-release', 'no-position']) {
    const f = fixture(`#${id}`), direction = id === 'overview' ? 1 : -1, x = id === 'overview' ? 280 : 100;
    f.touch('touchstart', x, 200, { timeStamp: 1000 });
    f.touch('touchmove', x - direction * 80, 200, { timeStamp: kind === 'zero' ? 1000 : 1020 });
    if (kind === 'reversal') f.touch('touchmove', x - direction * 70, 200, { timeStamp: 1030 });
    const timeStamp = ({ pause: 1121, zero: 1000, invalid: NaN, backwards: 1010, 'missing-release': undefined })[kind] ?? 1040;
    f.touch('touchend', x - direction * (kind.includes('reversal') ? 70 : 80), 200,
      { timeStamp: kind === 'missing-release' ? undefined : timeStamp, ...(kind === 'no-position' ? { changedTouches: [] } : {}) });
    assert.equal(f.window.location.hash, `#${id}`, kind);
  }
});

test('missing initial event timing uses only the injected monotonic clock for the gesture', () => {
  for (const id of ['overview', 'why']) {
    const f = fixture(`#${id}`), direction = id === 'overview' ? 1 : -1, x = id === 'overview' ? 280 : 100;
    f.clock(-200); f.touch('touchstart', x, 200, { timeStamp: undefined });
    f.clock(-160); f.touch('touchmove', x - direction * 20, 200, { timeStamp: 999999 });
    f.clock(-120); f.touch('touchend', x - direction * 48, 200, { timeStamp: -1 });
    assert.equal(f.window.location.hash, id === 'overview' ? '#why' : '#overview');
  }
});

test('invalid timing stays invalid and never interferes with midpoint commitment', () => {
  for (const id of ['overview', 'why']) for (const travel of [80, 240]) {
    const f = fixture(`#${id}`), direction = id === 'overview' ? 1 : -1, x = id === 'overview' ? 280 : 100;
    f.touch('touchstart', x, 200, { timeStamp: 1000 });
    f.touch('touchmove', x - direction * 20, 200, { timeStamp: undefined });
    f.touch('touchmove', x - direction * 40, 200, { timeStamp: 1020 });
    f.touch('touchend', x - direction * travel, 200, { timeStamp: 1040 });
    assert.equal(f.window.location.hash, `#${travel > 195 ? (id === 'overview' ? 'why' : 'overview') : id}`);
  }
  for (const kind of ['zero', 'backwards', 'invalid']) {
    const f = fixture();
    f.clock(-200); f.touch('touchstart', 280, 200, { timeStamp: undefined });
    f.clock(kind === 'zero' ? -200 : -180); f.touch('touchmove', 260, 200, { timeStamp: undefined });
    f.clock(kind === 'zero' ? -200 : kind === 'backwards' ? -190 : NaN);
    f.touch('touchend', 200, 200, { timeStamp: undefined });
    assert.equal(f.window.location.hash, '#overview', `monotonic fallback: ${kind}`);
  }
});
