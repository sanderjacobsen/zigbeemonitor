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

console.log('monitor tests ok');
