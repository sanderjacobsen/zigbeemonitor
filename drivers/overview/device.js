'use strict';

const Homey = require('homey');

class OverviewDevice extends Homey.Device {

  async onInit() {
    // Added in 0.4.0: also for overview devices paired before.
    if (!this.hasCapability('zigbee_checked')) await this.addCapability('zigbee_checked').catch(err => this.error(err.message));
    await this.homey.app.updateOverview().catch(err => this.error(err.message));
  }

  async setSummary({
    alarm, down, monitored, last, checked,
  }) {
    const values = {
      alarm_zigbee: alarm, zigbee_down: down, zigbee_monitored: monitored, zigbee_last: last, zigbee_checked: checked,
    };
    for (const [capability, value] of Object.entries(values)) {
      if (this.hasCapability(capability) && this.getCapabilityValue(capability) !== value) {
        await this.setCapabilityValue(capability, value).catch(err => this.error(capability, err.message));
      }
    }
  }

}

module.exports = OverviewDevice;
