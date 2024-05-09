
const NodeHelper = require("node_helper");
const Log = require("logger");
const CalendarFetcher = require("./calendarfetcher");

module.exports = NodeHelper.create({

	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.fetchers = [];
	},


	socketNotificationReceived (notification, payload) {
		if (notification === "ADD_CALENDAR") {
			this.createFetcher(payload.url, payload.fetchInterval, payload.excludedEvents, payload.maximumEntries, payload.maximumNumberOfDays, payload.auth, payload.broadcastPastEvents, payload.selfSignedCert, payload.id);
		} else if (notification === "FETCH_CALENDAR") {
			const key = payload.id + payload.url;
			if (typeof this.fetchers[key] === "undefined") {
				Log.error("Calendar Error. No fetcher exists with key: ", key);
				this.sendSocketNotification("CALENDAR_ERROR", { error_type: "MODULE_ERROR_UNSPECIFIED" });
				return;
			}
			this.fetchers[key].startFetch();
		}
	},


	createFetcher (url, fetchInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, broadcastPastEvents, selfSignedCert, identifier) {
		try {
			new URL(url);
		} catch (error) {
			Log.error("Calendar Error. Malformed calendar url: ", url, error);
			this.sendSocketNotification("CALENDAR_ERROR", { error_type: "MODULE_ERROR_MALFORMED_URL" });
			return;
		}

		let fetcher;
		if (typeof this.fetchers[identifier + url] === "undefined") {
			Log.log(`Create new calendarfetcher for url: ${url} - Interval: ${fetchInterval}`);
			fetcher = new CalendarFetcher(url, fetchInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, broadcastPastEvents, selfSignedCert);

			fetcher.onReceive((fetcher) => {
				this.broadcastEvents(fetcher, identifier);
			});

			fetcher.onError((fetcher, error) => {
				Log.error("Calendar Error. Could not fetch calendar: ", fetcher.url(), error);
				let error_type = NodeHelper.checkFetchError(error);
				this.sendSocketNotification("CALENDAR_ERROR", {
					id: identifier,
					error_type
				});
			});

			this.fetchers[identifier + url] = fetcher;
		} else {
			Log.log(`Use existing calendarfetcher for url: ${url}`);
			fetcher = this.fetchers[identifier + url];
			fetcher.broadcastEvents();
		}

		fetcher.startFetch();
	},


	broadcastEvents (fetcher, identifier) {
		this.sendSocketNotification("CALENDAR_EVENTS", {
			id: identifier,
			url: fetcher.url(),
			events: fetcher.events()
		});
	}
});
