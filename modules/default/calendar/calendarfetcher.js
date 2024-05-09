

const https = require("https");
const ical = require("node-ical");
const Log = require("logger");
const NodeHelper = require("node_helper");
const CalendarFetcherUtils = require("./calendarfetcherutils");


const CalendarFetcher = function (url, reloadInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, includePastEvents, selfSignedCert) {
	let reloadTimer = null;
	let events = [];

	let fetchFailedCallback = function () {};
	let eventsReceivedCallback = function () {};


	const fetchCalendar = () => {
		clearTimeout(reloadTimer);
		reloadTimer = null;
		const nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
		let httpsAgent = null;
		let headers = {
			"User-Agent": `Mozilla/5.0 (Node.js ${nodeVersion}) MagicMirror/${global.version}`
		};

		if (selfSignedCert) {
			httpsAgent = new https.Agent({
				rejectUnauthorized: false
			});
		}
		if (auth) {
			if (auth.method === "bearer") {
				headers.Authorization = `Bearer ${auth.pass}`;
			} else {
				headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString("base64")}`;
			}
		}

		fetch(url, { headers: headers, agent: httpsAgent })
			.then(NodeHelper.checkFetchStatus)
			.then((response) => response.text())
			.then((responseData) => {
				let data = [];

				try {
					data = ical.parseICS(responseData);
					Log.debug(`parsed data=${JSON.stringify(data)}`);
					events = CalendarFetcherUtils.filterEvents(data, {
						excludedEvents,
						includePastEvents,
						maximumEntries,
						maximumNumberOfDays
					});
				} catch (error) {
					fetchFailedCallback(this, error);
					scheduleTimer();
					return;
				}
				this.broadcastEvents();
				scheduleTimer();
			})
			.catch((error) => {
				fetchFailedCallback(this, error);
				scheduleTimer();
			});
	};


	const scheduleTimer = function () {
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function () {
			fetchCalendar();
		}, reloadInterval);
	};


	this.startFetch = function () {
		fetchCalendar();
	};


	this.broadcastEvents = function () {
		Log.info(`Calendar-Fetcher: Broadcasting ${events.length} events from ${url}.`);
		eventsReceivedCallback(this);
	};


	this.onReceive = function (callback) {
		eventsReceivedCallback = callback;
	};


	this.onError = function (callback) {
		fetchFailedCallback = callback;
	};


	this.url = function () {
		return url;
	};


	this.events = function () {
		return events;
	};
};

module.exports = CalendarFetcher;
