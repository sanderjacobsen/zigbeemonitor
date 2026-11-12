[![Ko-fi](https://img.shields.io/badge/Buy%20me%20a%20coffee-Ko--fi-FF5E5B?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/sanderjacobsen)

# Zigbee Monitor — Homey App

Keeps an eye on your **Zigbee routers** — the mains-powered lamps, plugs and relays that pass on the signals of your other Zigbee devices — and lets a flow **repair** a router that stopped responding, before you notice.

---

## How it works

- Every few minutes (default 10, adjustable) Zigbee Monitor gives each router its **current state again** (on/off or dim). Nothing changes, but the command really travels over Zigbee: a router that stopped responding answers with an error or not at all
- One failure is re-tested after a minute; **several failures in a row** count as *does not respond* (notification + flow triggers, once)
- Works with routers of **any app**: Homey marks mains-powered Zigbee devices as routers, e.g. Philips Hue without bridge, IKEA Home smart, Aqara & Xiaomi, Tuya, SONOFF, Innr
- In the app settings you choose which routers to monitor, the interval and the notifications, and see a log of all events
- One **overview device** with a red dot when a router does not respond

## Repairing with a flow

Apps cannot restart other apps or Homey themselves, but a flow can. Example Advanced Flow, one lane per app:

```
WHEN  A router of [Philips Hue] does not respond
THEN  Restart app [Philips Hue]  →  wait 30 s
AND   A router of [Philips Hue] still does not respond
AND   Zigbee Monitor is running longer than 60 minutes      (prevents a restart loop)
THEN  Notification + Restart Homey
ELSE  Notification "repaired by restarting the app"
```

## Flow cards

**Triggers** — *[router] does not respond* · *A router of [app] does not respond* · *[router] responds again*
**Conditions** — *[router] responds* (tests right away) · *A router of [app] still does not respond* · *Zigbee Monitor is running longer than [minutes] minutes*
**Actions** — *Test [router] now* · *Test the routers of [app] now* · *Test all routers now*

## Installation

Homey App Store (test): https://homey.app/a/nl.jacobsen.zigbeemonitor/test/ Works on Homey Pro (2023 or later), Homey Pro mini and Homey Self-Hosted Server.

```bash
npm install -g homey && npm install
homey app run       # test on your Homey
npm test            # unit tests
```

## Notes

- The app uses the Homey Web API (`homey:manager:api`) to find the routers and send them their current state. No cloud, everything stays on your Homey
- Most lamps and plugs ignore a command that does not change anything. If a device reacts to it anyway, switch off monitoring for that router in the settings

## Support

Questions, ideas or bugs? Reply in the [Homey Community topic](https://community.homey.app/t/app-pro-shs-zigbee-monitor-notice-and-repair-unresponsive-zigbee-routers-automatically/162152) or open an [issue](https://github.com/sanderjacobsen/zigbeemonitor/issues).
Like the app? [Buy me a coffee](https://ko-fi.com/sanderjacobsen) ☕

---

## Credits

Zigbee logo: [Simple Icons](https://simpleicons.org) (CC0); Zigbee is a trademark of the Connectivity Standards Alliance.

## License

MIT
