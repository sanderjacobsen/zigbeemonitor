'use strict';

const Homey = require('homey');

// One overview device: red dot when a monitored router does not respond.
class OverviewDriver extends Homey.Driver {

  async onPairListDevices() {
    if (this.getDevices().length) return []; // only one overview device is needed
    return [{ name: this.homey.__('overview.name'), data: { id: 'zigbee-monitor-overview' } }];
  }

}

module.exports = OverviewDriver;
