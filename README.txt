Zigbee Monitor keeps an eye on your Zigbee routers: the mains-powered devices (lamps, plugs, relays) that pass on the signals of your other Zigbee devices. Every few minutes it gives each router its current state again. Nothing changes, but the command really travels over Zigbee, so a router that stopped responding is noticed before you do.

When a router does not respond several times in a row, you get a notification and a flow can repair it: restart the app of that router with Homey's own 'Restart app' card, test again, and if needed restart Homey.

Works with routers of any app (Philips Hue without bridge, IKEA, Aqara and more). One overview device shows a red dot when a router does not respond.
