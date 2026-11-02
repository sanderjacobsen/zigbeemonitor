'use strict';

// Web API for the settings page.
module.exports = {
  async getRouters({ homey }) {
    return homey.app.getRouters();
  },

  async getConfig({ homey }) {
    return homey.app.config();
  },

  async setConfig({ homey, body }) {
    const cur = homey.app.config();
    const next = {
      intervalMin: Math.min(120, Math.max(1, Math.round(Number(body.intervalMin) || cur.intervalMin))),
      failsBeforeAlarm: Math.min(5, Math.max(1, Math.round(Number(body.failsBeforeAlarm) || cur.failsBeforeAlarm))),
      notifyDown: 'notifyDown' in body ? Boolean(body.notifyDown) : cur.notifyDown,
      notifyUp: 'notifyUp' in body ? Boolean(body.notifyUp) : cur.notifyUp,
      monitored: Array.isArray(body.monitored) ? body.monitored.map(String) : cur.monitored,
    };
    homey.settings.set('config', next);
    await homey.app.updateOverview().catch(() => {});
    return next;
  },

  async testRouter({ homey, params }) {
    const router = (await homey.app.getRouters()).find(r => r.id === params.id);
    if (!router) throw new Error(homey.__('error.not_found'));
    return homey.app.testRouter(router);
  },

  async getLog({ homey }) {
    return homey.settings.get('log') || [];
  },
};
