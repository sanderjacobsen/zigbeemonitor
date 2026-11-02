'use strict';

const Homey = require('homey');

class OverviewDevice extends Homey.Device {

  async onInit() {
    await this.homey.app.updateOverview().catch(err => this.error(err.message));
  }

  async setSummary({
    alarm, down, monitored, last,
  }) {
    const values = {
      alarm_zigbee: alarm, zigbee_down: down, zigbee_monitored: monitored, zigbee_last: last,
    };
    for (const [capability, value] of Object.entries(values)) {
      if (this.hasCapability(capability) && this.getCapabilityValue(capability) !== value) {
        await this.setCapabilityValue(capability, value).catch(err => this.error(capability, err.message));
      }
    }
  }

}

module.exports = OverviewDevice;
