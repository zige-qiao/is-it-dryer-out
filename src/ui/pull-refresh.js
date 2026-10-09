

export function createPullRefresh({
  state,
  elements,
  fetchWeather,
} = {}, environment = globalThis) {
  const { window, document, setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame } = environment;

  function bindPullToRefresh() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let start = null;
    let distance = 0;
    let threshold = 100;
    let pullLimit = 0;
    let active = false;
    let visibleDistance = 0;
    let footerClearance = 0;
    let animationFrame = null;
    let settling = false;
    let resultTimer = null;
    let requestActive = false;
    let feedbackBlocked = false;
    let suppressClick = false;
    let followers = [];
    let paintedDistance = 0, paintedFollow = 0;
    const overlayOpen = () => Boolean(document.querySelector(
      'dialog[open], .camera-help-content:not([hidden]), .timer-help[open], #pageLayoutMenu:not([hidden]), [popover]:popover-open'));
    const markFollowers = () => {
      const recommendation = elements.verdictPanel.closest?.('[data-page-box]');
      const siblings = recommendation?.parentElement?.children;
      if (!siblings) return;
      followers.forEach(node => delete node.dataset.pullFollower);
      followers = [...siblings].slice([...siblings].indexOf(recommendation) + 1);
      followers.forEach(node => { node.dataset.pullFollower = ''; });
    };
    const clearDistance = () => {
      document.body.style.removeProperty('--pull-distance');
      document.body.style.removeProperty('--pull-follow-distance');
      followers.forEach(node => delete node.dataset.pullFollower);
      followers = []; paintedDistance = 0; paintedFollow = 0;
    };
    const measureFooterClearance = () => {
      // DOM offset dimensions round to integers; use rendered fractional geometry.
      if (elements.forecastPanel.getBoundingClientRect && elements.verdictPanel.getBoundingClientRect)
        return Math.max(0, elements.forecastPanel.getBoundingClientRect().bottom -
          elements.verdictPanel.getBoundingClientRect().bottom + paintedDistance - paintedFollow);
      return Math.max(0, elements.forecastPanel.offsetTop + elements.forecastPanel.offsetHeight -
        elements.verdictPanel.offsetTop - elements.verdictPanel.offsetHeight);
    };
    const paintDistance = value => {
      footerClearance = measureFooterClearance();
      visibleDistance = Math.max(0, value);
      const followDistance = Math.max(0, visibleDistance - footerClearance);
      paintedDistance = Math.round(visibleDistance * 100) / 100;
      paintedFollow = Math.round(followDistance * 100) / 100;
      document.body.style.setProperty('--pull-distance', `${paintedDistance}px`);
      document.body.style.setProperty('--pull-follow-distance', `${paintedFollow}px`);
    };
    const stopAnimation = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      settling = false;
    };
    const settleTo = (target, onComplete = () => {}) => {
      stopAnimation();
      if (reducedMotion.matches || Math.abs(visibleDistance - target) < 0.5) {
        paintDistance(target);
        if (target === 0) {
          clearDistance();
        }
        onComplete();
        return;
      }
      const from = visibleDistance;
      let startedAt = null;
      settling = true;
      const frame = time => {
        if (startedAt === null) startedAt = time;
        const progress = Math.min(1, (time - startedAt) / 450);
        const spring = 1 - Math.exp(-8 * progress) * Math.cos(7 * progress);
        paintDistance(from + (target - from) * spring);
        if (progress < 1) {
          animationFrame = requestAnimationFrame(frame);
        } else {
          animationFrame = null;
          settling = false;
          paintDistance(target);
          if (target === 0) {
            clearDistance();
          }
          onComplete();
        }
      };
      animationFrame = requestAnimationFrame(frame);
    };
    const resetGesture = () => {
      start = null;
      distance = 0;
      active = false;
      document.body.classList.remove('pull-active', 'pull-mid', 'pull-ready');
    };
    const closePull = (immediate = false) => {
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = null;
      resetGesture();
      document.body.classList.remove('pull-refreshing');
      const resetResult = () => {
        document.body.classList.remove('pull-result', 'pull-failed');
        elements.pullRefreshText.textContent = 'Keep pulling';
      };
      if (immediate) {
        stopAnimation();
        paintDistance(0);
        clearDistance();
        resetResult();
      } else {
        settleTo(0, resetResult);
      }
    };
    const cancelForOverlay = () => {
      if (!overlayOpen()) return;
      if (requestActive) feedbackBlocked = true;
      if (start || visibleDistance || requestActive || resultTimer) closePull(true);
    };
    if (environment.MutationObserver) new environment.MutationObserver(cancelForOverlay).observe(document.body,
      { subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-expanded'] });
    document.addEventListener('toggle', cancelForOverlay, true);
    const resize = () => {
      if (visibleDistance && !feedbackBlocked) {
        paintDistance(visibleDistance);
        if (requestActive && !settling) settleTo(elements.pullRefresh.offsetHeight);
      }
    };
    if (environment.ResizeObserver) {
      const observer = new environment.ResizeObserver(resize);
      [elements.verdictPanel, elements.forecastPanel, elements.pullRefresh].forEach(node => observer.observe(node));
    }
    window.addEventListener?.('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    document.addEventListener('pointerdown', () => { suppressClick = false; }, true);
    document.addEventListener('click', event => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    document.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { if (start) closePull(); return; }
      suppressClick = false;
      if (event.touches.length !== 1 || window.scrollY > 0 || settling || state.weatherRequestPending ||
          document.body.classList.contains('pull-refreshing') || document.body.classList.contains('pull-result') ||
          overlayOpen() || requestActive ||
          event.target.closest('input, select, textarea, [contenteditable="true"]') ||
          document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      markFollowers();
      footerClearance = measureFooterClearance();
      pullLimit = elements.verdictPanel.offsetHeight / 2;
      const cueHeight = elements.pullRefresh.offsetHeight;
      threshold = pullLimit > cueHeight
        ? Math.max(100, Math.ceil(-pullLimit * Math.log(1 - cueHeight / pullLimit)))
        : 100;
      distance = 0;
      active = false;
    }, { passive: true });
    document.addEventListener('touchmove', event => {
      if (!start) return;
      if (overlayOpen()) { cancelForOverlay(); return; }
      if (event.touches.length !== 1) { closePull(); return; }
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (window.scrollY > 0 || dy < -8 || Math.abs(dx) > Math.max(12, dy * 0.7)) { closePull(); return; }
      if (dy <= 0) {
        if (active) {
          event.preventDefault(); active = false; distance = 0;
          document.body.classList.remove('pull-active', 'pull-mid', 'pull-ready'); paintDistance(0);
        }
        return;
      }
      if (dy < 12) {
        if (active) {
          active = false;
          document.body.classList.remove('pull-active', 'pull-mid', 'pull-ready');
          paintDistance(0);
        }
        return;
      }
      event.preventDefault();
      suppressClick = true;
      active = true;
      distance = dy;
      document.body.classList.add('pull-active');
      paintDistance(pullLimit * (1 - Math.exp(-dy / pullLimit)));
      document.body.classList.toggle('pull-mid', dy >= threshold / 2);
      document.body.classList.toggle('pull-ready', dy >= threshold);
      elements.pullRefreshText.textContent = dy >= threshold ? 'Release to re-check' : 'Keep pulling';
    }, { passive: false });
    document.addEventListener('touchend', async () => {
      if (!start) return;
      if (overlayOpen()) { cancelForOverlay(); return; }
      const refresh = active && distance >= threshold && !state.weatherRequestPending;
      if (!refresh) { closePull(); return; }
      resetGesture();
      requestActive = true; feedbackBlocked = false;
      document.body.classList.add('pull-refreshing');
      settleTo(elements.pullRefresh.offsetHeight);
      elements.pullRefreshText.textContent = 'Updating weather…';
      try {
        const update = fetchWeather();
        footerClearance = measureFooterClearance();
        paintDistance(visibleDistance);
        await update;
        if (feedbackBlocked || overlayOpen() || document.hidden) return;
        elements.pullRefreshText.textContent = state.weatherLoadFailed ? 'Weather update failed' : 'Weather updated';
        document.body.classList.toggle('pull-failed', state.weatherLoadFailed);
      } catch {
        if (feedbackBlocked || overlayOpen() || document.hidden) return;
        elements.pullRefreshText.textContent = 'Weather update failed';
        document.body.classList.add('pull-failed');
      } finally {
        requestActive = false;
        if (feedbackBlocked || overlayOpen() || document.hidden) { closePull(true); return; }
        footerClearance = measureFooterClearance();
        paintDistance(visibleDistance);
        document.body.classList.remove('pull-refreshing');
        document.body.classList.add('pull-result');
        resultTimer = setTimeout(closePull, 1400);
      }
    }, { passive: true });
    document.addEventListener('touchcancel', () => { if (start) closePull(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (requestActive) feedbackBlocked = true; closePull(true); } });
  }

  return { bindPullToRefresh };
}
