'use strict';

// Plain node tests for the router health bookkeeping: `npm test`
const assert = require('assert');
const { apply, probeCapability } = require('../lib/monitor');

let r = apply(null, { ok: true, ms: 250 }, 2, 1);
assert.deepStrictEqual([r.state.status, r.event], ['ok', null]);

r = apply(r.state, { ok: false, error: 'Timeout' }, 2, 2);
assert.deepStrictEqual([r.state.status, r.state.fails, r.event], ['suspect', 1, null]);

r = apply(r.state, { ok: false, error: 'Timeout' }, 2, 3);
assert.deepStrictEqual([r.state.status, r.state.fails, r.event], ['down', 2, 'down']);

// Still down: announced only once.
r = apply(r.state, { ok: false, error: 'Timeout' }, 2, 4);
assert.deepStrictEqual([r.state.status, r.event], ['down', null]);

r = apply(r.state, { ok: true, ms: 300 }, 2, 5);
assert.deepStrictEqual([r.state.status, r.state.fails, r.event, r.state.since], ['ok', 0, 'up', 5]);

// A single failure that recovers is not an event.
r = apply(r.state, { ok: false, error: 'x' }, 2, 6);
r = apply(r.state, { ok: true }, 2, 7);
assert.deepStrictEqual([r.state.status, r.event], ['ok', null]);

// Threshold 1: down at once.
assert.strictEqual(apply(null, { ok: false }, 1, 1).event, 'down');

assert.strictEqual(probeCapability({ onoff: { value: false }, dim: { value: 0.4 } }), 'onoff');
assert.strictEqual(probeCapability({ dim: { value: 0.4 } }), 'dim');
assert.strictEqual(probeCapability({ onoff: { value: null } }), null);
assert.strictEqual(probeCapability({ measure_power: { value: 3 } }), null);
// No on/off or dimmer: another settable value that stays as it is (e.g. an LED indicator of a range extender).
assert.strictEqual(probeCapability({ measure_power: { value: 3, type: 'number' }, led_indicator: { value: true, type: 'boolean', setable: true } }), 'led_indicator');
assert.strictEqual(probeCapability({ light_temperature: { value: 0.4, type: 'number', setable: true }, light_mode: { value: 'temperature', type: 'enum', setable: true } }), 'light_mode');
// Never something that starts an action when it is sent again.
assert.strictEqual(probeCapability({ windowcoverings_state: { value: 'up', type: 'enum', setable: true }, button: { value: null, type: 'boolean', setable: true } }), null);
assert.strictEqual(probeCapability({ windowcoverings_state: { value: 'up', type: 'enum', setable: true }, windowcoverings_set: { value: 0.5, type: 'number', setable: true } }), 'windowcoverings_set');
assert.strictEqual(probeCapability({ identify: { value: false, type: 'boolean', setable: true } }), null);
for (const id of ['hap-identify', 'vacuumcleaner_state', 'blocked', 'volume_set', 'speaker_playing', 'thermostat_state']) {
  assert.strictEqual(probeCapability({ [id]: { value: true, type: 'boolean', setable: true } }), null, id);
}

console.log('monitor tests ok');
