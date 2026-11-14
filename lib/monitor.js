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
// On/off and dim first; otherwise only standard Homey capabilities that simply hold a value (sub-capabilities like
// onoff.light, light colour/temperature/mode, a position, a target temperature, a fan speed) or an LED indicator.
// Never anything else: an app may start an action when the same value comes in again.
const SAFE = /^(onoff|dim)(\.|$)|^light_(hue|saturation|temperature|mode)$|^windowcoverings_set$|^target_temperature(\.|$)|^thermostat_mode$|^fan_(speed|mode)$|(^|_)(led|indicator)(_|$)/;
const TYPES = ['boolean', 'enum', 'number'];

function probeCapability(capabilitiesObj) {
  const caps = capabilitiesObj || {};
  const usable = id => {
    const c = caps[id];
    return c && c.setable !== false && c.getable !== false && c.value !== null && c.value !== undefined;
  };
  for (const id of ['onoff', 'dim']) if (usable(id)) return id;
  const others = Object.keys(caps)
    .filter(id => SAFE.test(id) && usable(id) && TYPES.includes(caps[id].type))
    .sort((a, b) => TYPES.indexOf(caps[a].type) - TYPES.indexOf(caps[b].type) || a.localeCompare(b));
  return others[0] || null;
}

module.exports = { initialState, apply, probeCapability };
