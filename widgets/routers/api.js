'use strict';

const ORDER = ['ok', 'unknown', 'suspect', 'down'];

module.exports = {

  // Monitored routers, the ones with a problem first.
  async getRouters({ homey }) {
    const routers = (await homey.app.getRouters()).filter(r => r.monitored);
    const list = await Promise.all(routers.map(async r => ({
      id: r.id,
      name: r.name,
      zone: r.zone,
      app: r.appName,
      status: r.state.status,
      lastCheck: r.state.lastCheck,
      lastMs: r.state.lastMs,
      iconUri: await homey.app.getDeviceIcon(r.id).catch(() => null),
    })));
    return list.sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status) || a.name.localeCompare(b.name));
  },

  async testRouter({ homey, body }) {
    const router = (await homey.app.getRouters()).find(r => r.id === body.id);
    if (!router) throw new Error('Router not found');
    return homey.app.testRouter(router);
  },

  async testAll({ homey }) {
    await homey.app.runRound();
    return true;
  },

};
