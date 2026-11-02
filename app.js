'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('homey-api');
const { initialState, apply, probeCapability } = require('./lib/monitor');

const ANY = '*';
const PROBE_TIMEOUT_MS = 15000;
const RETEST_MS = 60 * 1000; // a router that failed once is re-tested after a minute
const GAP_MS = 2000; // between routers, so the mesh is not flooded
const LOG_LENGTH = 50;
const DEFAULTS = {
  intervalMin: 10, failsBeforeAlarm: 2, notifyDown: true, notifyUp: true, monitored: null, // null = all routers
};

// Friendly names for the apps that are typically behind Zigbee routers (apps cannot read other apps' names).
const APP_NAMES = {
  'com.philips.hue.zigbee': 'Philips Hue (without bridge)',
  'com.ikea.tradfri': 'IKEA Home smart',
  'com.xiaomi-mi': 'Aqara & Xiaomi',
  'com.tuya.zigbee': 'Tuya Zigbee',
  'com.sonoff': 'SONOFF',
  'com.innr': 'Innr',
  'com.gledopto': 'Gledopto',
};

class ZigbeeMonitorApp extends Homey.App {

  async onInit() {
    this.startedAt = Date.now();
    this.states = this.homey.settings.get('states') || {};
    this._running = false;
    this._registerFlowCards();
    this.homey.setTimeout(() => this.runRound(), 30 * 1000);
    this._schedule();
    this.homey.settings.on('set', key => { if (key === 'config') this._schedule(); });
    this.log('Zigbee Monitor started');
  }

  // ---------- configuration ----------

  config() {
    return { ...DEFAULTS, ...(this.homey.settings.get('config') || {}) };
  }

  _schedule() {
    if (this._timer) this.homey.clearInterval(this._timer);
    const minutes = Math.min(120, Math.max(1, Number(this.config().intervalMin) || DEFAULTS.intervalMin));
    this._timer = this.homey.setInterval(() => this.runRound(), minutes * 60 * 1000);
  }

  async getApi() {
    if (!this._api) this._api = await HomeyAPI.createAppAPI({ homey: this.homey });
    return this._api;
  }

  // ---------- routers ----------

  appIdOf(device) {
    return String(device.driverId || '').split(':')[2] || '';
  }

  appName(appId) {
    return APP_NAMES[appId] || appId;
  }

  // All mains-powered Zigbee devices (routers), from any app: Homey marks them with zb_device_type = router.
  async getRouters() {
    const api = await this.getApi();
    const [devices, zones] = await Promise.all([api.devices.getDevices(), api.zones.getZones().catch(() => ({}))]);
    const cfg = this.config();
    return Object.values(devices)
      .filter(d => d.settings && d.settings.zb_device_type === 'router')
      .map(d => {
        const appId = this.appIdOf(d);
        return {
          id: d.id,
          name: String(d.name || '').trim(),
          zone: zones[d.zone] ? zones[d.zone].name : '',
          appId,
          appName: this.appName(appId),
          product: d.settings.zb_product_id || '',
          capability: probeCapability(d.capabilitiesObj),
          available: d.available !== false,
          monitored: cfg.monitored ? cfg.monitored.includes(d.id) : true,
          state: { ...initialState(), ...(this.states[d.id] || {}) },
        };
      })
      .sort((a, b) => a.appName.localeCompare(b.appName) || a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name));
  }

  // Test one router: set a capability to the value it already has. Nothing changes, but the command
  // really travels over Zigbee; an unreachable router answers with an error or not at all.
  async probe(router) {
    if (!router.capability) return { ok: false, error: this.homey.__('error.no_capability') };
    const api = await this.getApi();
    const t = Date.now();
    try {
      const dev = await api.devices.getDevice({ id: router.id, $cache: false, $updateCache: false });
      if (dev.available === false) return { ok: false, error: dev.unavailableMessage || this.homey.__('error.unavailable') };
      const value = dev.capabilitiesObj[router.capability].value;
      await Promise.race([
        dev.setCapabilityValue({ capabilityId: router.capability, value }),
        new Promise((_, reject) => this.homey.setTimeout(() => reject(new Error(this.homey.__('error.timeout'))), PROBE_TIMEOUT_MS)),
      ]);
      return { ok: true, ms: Date.now() - t };
    } catch (err) {
      return { ok: false, error: err.message || String(err), ms: Date.now() - t };
    }
  }

  async testRouter(router) {
    const result = await this.probe(router);
    const { state, event } = apply(this.states[router.id], result, Number(this.config().failsBeforeAlarm) || 2, Date.now());
    this.states[router.id] = state;
    this.homey.settings.set('states', this.states);
    if (event) await this._announce(event, router, state).catch(err => this.error('Announce failed:', err.message));
    if (state.status === 'suspect') this._retestSoon(router.id);
    await this.updateOverview().catch(() => {});
    return state;
  }

  _retestSoon(id) {
    this._retest = this._retest || {};
    if (this._retest[id]) return;
    this._retest[id] = this.homey.setTimeout(async () => {
      delete this._retest[id];
      const router = (await this.getRouters().catch(() => [])).find(r => r.id === id);
      if (router && router.monitored) await this.testRouter(router).catch(err => this.error(err.message));
    }, RETEST_MS);
  }

  async runRound() {
    if (this._running) return;
    this._running = true;
    try {
      const routers = (await this.getRouters()).filter(r => r.monitored);
      for (const router of routers) {
        await this.testRouter(router);
        await new Promise(resolve => this.homey.setTimeout(resolve, GAP_MS));
      }
    } catch (err) {
      this.error('Round failed:', err.message);
    } finally {
      this._running = false;
    }
  }

  // ---------- events ----------

  async _announce(event, router, state) {
    const cfg = this.config();
    const tokens = {
      device: router.name, zone: router.zone, app: router.appName, error: state.lastError || '',
    };
    const entry = {
      t: Date.now(), event, device: router.name, zone: router.zone, app: router.appName, detail: state.lastError || '',
    };
    this.homey.settings.set('log', [entry, ...(this.homey.settings.get('log') || [])].slice(0, LOG_LENGTH));
    this.log(`${event === 'down' ? 'Not responding' : 'Responding again'}: ${router.name} (${router.zone}, ${router.appId})`);

    if ((event === 'down' && cfg.notifyDown) || (event === 'up' && cfg.notifyUp)) {
      await this.homey.notifications.createNotification({
        excerpt: this.homey.__(`notify.${event}`, { device: router.name, zone: router.zone, app: router.appName }),
      });
    }
    const flowState = { deviceId: router.id, appId: router.appId };
    if (event === 'down') {
      await this.homey.flow.getTriggerCard('router_down').trigger(tokens, flowState);
      await this.homey.flow.getTriggerCard('router_down_app').trigger(tokens, flowState);
    } else {
      await this.homey.flow.getTriggerCard('router_up').trigger(tokens, flowState);
    }
  }

  async updateOverview() {
    const driver = this.homey.drivers.getDriver('overview');
    const devices = driver.getDevices();
    if (!devices.length) return;
    const routers = (await this.getRouters()).filter(r => r.monitored);
    const down = routers.filter(r => r.state.status === 'down');
    const last = (this.homey.settings.get('log') || [])[0];
    const lastText = last
      ? `${this.homey.__(`overview.${last.event}`)}: ${last.device} (${new Date(last.t).toLocaleString(this.homey.i18n.getLanguage(), {
        timeZone: this.homey.clock.getTimezone(), day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })})`
      : this.homey.__('overview.none');
    for (const device of devices) {
      await device.setSummary({
        alarm: down.length > 0, down: down.length, monitored: routers.length, last: lastText,
      });
    }
  }

  // ---------- flow cards ----------

  async _routerChoices(query, withAny) {
    const q = String(query || '').toLowerCase();
    const list = (await this.getRouters()).map(r => ({ id: r.id, name: r.name, description: [r.zone, r.appName].filter(Boolean).join(' · ') }));
    if (withAny) list.unshift({ id: ANY, name: this.homey.__('flow.any_router') });
    return list.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
  }

  async _appChoices(query) {
    const q = String(query || '').toLowerCase();
    const apps = new Map((await this.getRouters()).map(r => [r.appId, { id: r.appId, name: r.appName }]));
    return [...apps.values()].filter(a => a.name.toLowerCase().includes(q));
  }

  async _routerById(id) {
    const router = (await this.getRouters()).find(r => r.id === id);
    if (!router) throw new Error(this.homey.__('error.not_found'));
    return router;
  }

  _registerFlowCards() {
    const routers = (query, withAny) => this._routerChoices(query, withAny);
    const apps = query => this._appChoices(query);

    for (const id of ['router_down', 'router_up']) {
      const card = this.homey.flow.getTriggerCard(id);
      card.registerArgumentAutocompleteListener('router', query => routers(query, true));
      card.registerRunListener(async (args, state) => !args.router || args.router.id === ANY || args.router.id === state.deviceId);
    }
    const byApp = this.homey.flow.getTriggerCard('router_down_app');
    byApp.registerArgumentAutocompleteListener('app', apps);
    byApp.registerRunListener(async (args, state) => args.app && args.app.id === state.appId);

    const responds = this.homey.flow.getConditionCard('router_responds');
    responds.registerArgumentAutocompleteListener('router', query => routers(query, false));
    responds.registerRunListener(async ({ router }) => (await this.testRouter(await this._routerById(router.id))).status === 'ok');

    const uptime = this.homey.flow.getConditionCard('running_longer_than');
    uptime.registerRunListener(async ({ minutes }) => Date.now() - this.startedAt >= (Number(minutes) || 0) * 60 * 1000);

    const test = this.homey.flow.getActionCard('test_router');
    test.registerArgumentAutocompleteListener('router', query => routers(query, false));
    test.registerRunListener(async ({ router }) => { await this.testRouter(await this._routerById(router.id)); });

    const testApp = this.homey.flow.getActionCard('test_app');
    testApp.registerArgumentAutocompleteListener('app', apps);
    testApp.registerRunListener(async ({ app }) => {
      for (const router of (await this.getRouters()).filter(r => r.monitored && r.appId === app.id)) await this.testRouter(router);
    });

    const testAll = this.homey.flow.getActionCard('test_all');
    testAll.registerRunListener(async () => { await this.runRound(); });
  }

}

module.exports = ZigbeeMonitorApp;
