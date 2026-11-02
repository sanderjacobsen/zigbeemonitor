'use strict';

// Pure bookkeeping of router health (no Homey dependencies, easy to test).
//
// state per device: { status: 'unknown' | 'ok' | 'suspect' | 'down', fails, lastCheck, lastOk, lastMs, lastError, since }
//  - 'suspect': failed, but fewer times than the threshold (re-tested quickly)
//  - 'down':    failed `threshold` times in a row -> "does not respond" (announced once)
// apply() returns the event to announce: 'down' | 'up' | null.

function initialState() {
  return {
    status: 'unknown', fails: 0, lastCheck: null, lastOk: null, lastMs: null, lastError: null, since: null,
  };
}

function apply(prev, result, threshold, now) {
  const state = { ...initialState(), ...(prev || {}) };
  state.lastCheck = now;
  if (result.ok) {
    const wasDown = state.status === 'down';
    Object.assign(state, {
      status: 'ok', fails: 0, lastOk: now, lastMs: result.ms ?? null, lastError: null,
    });
    if (wasDown) state.since = now;
    return { state, event: wasDown ? 'up' : null };
  }
  state.fails = (state.fails || 0) + 1;
  state.lastError = result.error || 'unknown error';
  if (state.status !== 'down' && state.fails >= Math.max(1, threshold)) {
    state.status = 'down';
    state.since = now;
    return { state, event: 'down' };
  }
  if (state.status !== 'down') state.status = 'suspect';
  return { state, event: null };
}

// Which capability can be "set to its own value" to test a device without changing anything.
function probeCapability(capabilitiesObj) {
  const caps = capabilitiesObj || {};
  for (const id of ['onoff', 'dim']) {
    const c = caps[id];
    if (c && c.setable !== false && c.value !== null && c.value !== undefined) return id;
  }
  return null;
}

module.exports = { initialState, apply, probeCapability };
