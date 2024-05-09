
const path = require("path");
const moment = require("moment");

const zoneTable = require(path.join(__dirname, "windowsZones.json"));
const Log = require("../../../js/logger");

const CalendarFetcherUtils = {


	calculateTimezoneAdjustment (event, date) {
		let adjustHours = 0;

		if (!event.start.tz) {
			Log.debug(" if no tz, guess based on now");
			event.start.tz = moment.tz.guess();
		}
		Log.debug(`initial tz=${event.start.tz}`);


		if (event.start.tz) {

			if (event.start.tz.includes(" ")) {

				let tz = CalendarFetcherUtils.getIanaTZFromMS(event.start.tz);
				Log.debug(`corrected TZ=${tz}`);

				if (tz) {

					event.start.tz = tz;

				}
			}
			Log.debug(`corrected tz=${event.start.tz}`);
			let current_offset = 0;
			let mm = 0;
			let start_offset = 0;

			if (event.start.tz.startsWith("(")) {
				const regex = /[+|-]\d*:\d*/;
				const start_offsetString = event.start.tz.match(regex).toString().split(":");
				let start_offset = parseInt(start_offsetString[0]);
				start_offset *= event.start.tz[1] === "-" ? -1 : 1;
				adjustHours = start_offset;
				Log.debug(`defined offset=${start_offset} hours`);
				current_offset = start_offset;
				event.start.tz = "";
				Log.debug(`ical offset=${current_offset} date=${date}`);
				mm = moment(date);
				let x = parseInt(moment(new Date()).utcOffset());
				Log.debug(`net mins=${current_offset * 60 - x}`);

				mm = mm.add(x - current_offset * 60, "minutes");
				adjustHours = (current_offset * 60 - x) / 60;
				event.start = mm.toDate();
				Log.debug(`adjusted date=${event.start}`);
			} else {

				let es = moment(event.start);

				if (es.format("YYYY") < 2007) {
					es.set("year", 2013);
				}
				Log.debug(`start date/time=${es.toDate()}`);
				start_offset = moment.tz(es, event.start.tz).utcOffset();
				Log.debug(`start offset=${start_offset}`);

				Log.debug(`start date/time w tz =${moment.tz(moment(event.start), event.start.tz).toDate()}`);


				mm = moment.tz(moment(date), event.start.tz);
				Log.debug(`event date=${mm.toDate()}`);
				current_offset = mm.utcOffset();
			}
			Log.debug(`event offset=${current_offset} hour=${mm.format("H")} event date=${mm.toDate()}`);


			if (current_offset !== start_offset) {

				Log.debug("offset");
				let h = parseInt(mm.format("H"));

				if (h > 0 && h < Math.abs(current_offset) / 60) {

				}

				if (current_offset > start_offset) {
					adjustHours -= 1;
					Log.debug("adjust down 1 hour dst change");

				} else if (current_offset < start_offset) {
					adjustHours += 1;
					Log.debug("adjust up 1 hour dst change");
				}
			}
		}
		Log.debug(`adjustHours=${adjustHours}`);
		return adjustHours;
	},


	filterEvents (data, config) {
		const newEvents = [];


		const limitFunction = function (date, i) {
			return true;
		};

		const eventDate = function (event, time) {
			return CalendarFetcherUtils.isFullDayEvent(event) ? moment(event[time], "YYYYMMDD") : moment(new Date(event[time]));
		};

		Log.debug(`There are ${Object.entries(data).length} calendar entries.`);
		Object.entries(data).forEach(([key, event]) => {
			Log.debug("Processing entry...");
			const now = new Date();
			const today = moment().startOf("day").toDate();
			const future
				= moment()
					.startOf("day")
					.add(config.maximumNumberOfDays, "days")
					.subtract(1, "seconds")
					.toDate();
			let past = today;

			if (config.includePastEvents) {
				past = moment().startOf("day").subtract(config.maximumNumberOfDays, "days").toDate();
			}


			let isFacebookBirthday = false;
			if (typeof event.uid !== "undefined") {
				if (event.uid.indexOf("@facebook.com") !== -1) {
					isFacebookBirthday = true;
				}
			}

			if (event.type === "VEVENT") {
				Log.debug(`Event:\n${JSON.stringify(event)}`);
				let startDate = eventDate(event, "start");
				let endDate;

				if (typeof event.end !== "undefined") {
					endDate = eventDate(event, "end");
				} else if (typeof event.duration !== "undefined") {
					endDate = startDate.clone().add(moment.duration(event.duration));
				} else {
					if (!isFacebookBirthday) {

						endDate = moment(startDate.format("x"), "x");
					} else {
						endDate = moment(startDate).add(1, "days");
					}
				}

				Log.debug(`start: ${startDate.toDate()}`);
				Log.debug(`end:: ${endDate.toDate()}`);


				let duration = parseInt(endDate.format("x")) - parseInt(startDate.format("x"));
				Log.debug(`duration: ${duration}`);


				if (event.start.length === 8) {
					startDate = startDate.startOf("day");
				}

				const title = CalendarFetcherUtils.getTitleFromEvent(event);
				Log.debug(`title: ${title}`);

				let excluded = false,
					dateFilter = null;

				for (let f in config.excludedEvents) {
					let filter = config.excludedEvents[f],
						testTitle = title.toLowerCase(),
						until = null,
						useRegex = false,
						regexFlags = "g";

					if (filter instanceof Object) {
						if (typeof filter.until !== "undefined") {
							until = filter.until;
						}

						if (typeof filter.regex !== "undefined") {
							useRegex = filter.regex;
						}


						if (filter.caseSensitive) {
							filter = filter.filterBy;
							testTitle = title;
						} else if (useRegex) {
							filter = filter.filterBy;
							testTitle = title;
							regexFlags += "i";
						} else {
							filter = filter.filterBy.toLowerCase();
						}
					} else {
						filter = filter.toLowerCase();
					}

					if (CalendarFetcherUtils.titleFilterApplies(testTitle, filter, useRegex, regexFlags)) {
						if (until) {
							dateFilter = until;
						} else {
							excluded = true;
						}
						break;
					}
				}

				if (excluded) {
					return;
				}

				const location = event.location || false;
				const geo = event.geo || false;
				const description = event.description || false;

				if (typeof event.rrule !== "undefined" && event.rrule !== null && !isFacebookBirthday) {
					const rule = event.rrule;

					const pastMoment = moment(past);
					const futureMoment = moment(future);


					if ((rule.options && rule.origOptions && rule.origOptions.dtstart && rule.origOptions.dtstart.getFullYear() < 1900) || (rule.options && rule.options.dtstart && rule.options.dtstart.getFullYear() < 1900)) {
						rule.origOptions.dtstart.setYear(1900);
						rule.options.dtstart.setYear(1900);
					}


					let pastLocal = 0;
					let futureLocal = 0;
					if (CalendarFetcherUtils.isFullDayEvent(event)) {
						Log.debug("fullday");

						pastLocal = pastMoment.toDate();
						futureLocal = futureMoment.toDate();

						Log.debug(`pastLocal: ${pastLocal}`);
						Log.debug(`futureLocal: ${futureLocal}`);
					} else {

						if (config.includePastEvents) {

							pastLocal = pastMoment.toDate();
						} else {

							pastLocal = moment().toDate();
						}
						futureLocal = futureMoment.toDate();
					}
					Log.debug(`Search for recurring events between: ${pastLocal} and ${futureLocal}`);
					let dates = rule.between(pastLocal, futureLocal, true, limitFunction);
					Log.debug(`Title: ${event.summary}, with dates: ${JSON.stringify(dates)}`);
					dates = dates.filter((d) => {
						if (JSON.stringify(d) === "null") return false;
						else return true;
					});

					Log.debug(`event.recurrences: ${event.recurrences}`);
					if (event.recurrences !== undefined) {
						for (let r in event.recurrences) {

							if (moment(new Date(r)).isBetween(pastMoment, futureMoment) !== true) {
								dates.push(new Date(r));
							}
						}
					}

					for (let d in dates) {
						let date = dates[d];
						let curEvent = event;
						let showRecurrence = true;


						date.setUTCHours(curEvent.start.getUTCHours(), curEvent.start.getUTCMinutes(), curEvent.start.getUTCSeconds(), curEvent.start.getUTCMilliseconds());


						let nowOffset = new Date().getTimezoneOffset();

						let dateoffset = date.getTimezoneOffset();


						Log.debug(` recurring date is ${date} offset is ${dateoffset}`);

						let dh = moment(date).format("HH");
						Log.debug(` recurring date is ${date} offset is ${dateoffset / 60} Hour is ${dh}`);

						if (CalendarFetcherUtils.isFullDayEvent(event)) {
							Log.debug("Fullday");

							if (dateoffset < 0) {
								if (dh < Math.abs(dateoffset / 60)) {

									if (curEvent.rrule.origOptions.byweekday !== undefined) {

										date = new Date(date.getTime() - Math.abs(24 * 60) * 60000);
									}

									Log.debug(`new recurring date1 fulldate is ${date}`);
								}
							} else {

								if (24 - dh <= Math.abs(dateoffset / 60)) {

									if (curEvent.rrule.origOptions.byweekday !== undefined) {

										date = new Date(date.getTime() + Math.abs(24 * 60) * 60000);
									}

									Log.debug(`new recurring date2 fulldate is ${date}`);
								}

							}
						} else {

							if (dateoffset < 0) {

								if (dh <= Math.abs(dateoffset / 60)) {

									if (curEvent.rrule.origOptions.byweekday !== undefined) {

										date = new Date(date.getTime() - Math.abs(24 * 60) * 60000);
									}

									Log.debug(`new recurring date1 is ${date}`);
								}
							} else {

								if (24 - dh <= Math.abs(dateoffset / 60)) {

									if (curEvent.rrule.origOptions.byweekday !== undefined) {

										date = new Date(date.getTime() + Math.abs(24 * 60) * 60000);
									}

									Log.debug(`new recurring date2 is ${date}`);
								}

							}
						}
						startDate = moment(date);
						Log.debug(`Corrected startDate: ${startDate.toDate()}`);

						let adjustDays = CalendarFetcherUtils.calculateTimezoneAdjustment(event, date);


						const dateKey = date.toISOString().substring(0, 10);


						if (curEvent.recurrences !== undefined && curEvent.recurrences[dateKey] !== undefined) {

							curEvent = curEvent.recurrences[dateKey];
							startDate = moment(curEvent.start);
							duration = parseInt(moment(curEvent.end).format("x")) - parseInt(startDate.format("x"));
						}

						else if (curEvent.exdate !== undefined && curEvent.exdate[dateKey] !== undefined) {

							showRecurrence = false;
						}
						Log.debug(`duration: ${duration}`);

						endDate = moment(parseInt(startDate.format("x")) + duration, "x");
						if (startDate.format("x") === endDate.format("x")) {
							endDate = endDate.endOf("day");
						}

						const recurrenceTitle = CalendarFetcherUtils.getTitleFromEvent(curEvent);


						if (endDate.isBefore(past) || startDate.isAfter(future)) {
							showRecurrence = false;
						}

						if (CalendarFetcherUtils.timeFilterApplies(now, endDate, dateFilter)) {
							showRecurrence = false;
						}

						if (showRecurrence === true) {
							Log.debug(`saving event: ${description}`);
							newEvents.push({
								title: recurrenceTitle,
								startDate: (adjustDays ? (adjustDays > 0 ? startDate.add(adjustDays, "hours") : startDate.subtract(Math.abs(adjustDays), "hours")) : startDate).format("x"),
								endDate: (adjustDays ? (adjustDays > 0 ? endDate.add(adjustDays, "hours") : endDate.subtract(Math.abs(adjustDays), "hours")) : endDate).format("x"),
								fullDayEvent: CalendarFetcherUtils.isFullDayEvent(event),
								recurringEvent: true,
								class: event.class,
								firstYear: event.start.getFullYear(),
								location: location,
								geo: geo,
								description: description
							});
						}
					}

				} else {

					const fullDayEvent = isFacebookBirthday ? true : CalendarFetcherUtils.isFullDayEvent(event);



					if (fullDayEvent && startDate.format("x") === endDate.format("x")) {
						endDate = endDate.endOf("day");
					}

					if (config.includePastEvents) {

						if (endDate < past) {
							return;
						}
					} else {

						if (!fullDayEvent && endDate < new Date()) {
							return;
						}


						if (fullDayEvent && endDate <= today) {
							return;
						}
					}


					if (startDate > future) {
						return;
					}

					if (CalendarFetcherUtils.timeFilterApplies(now, endDate, dateFilter)) {
						return;
					}


					let adjustDays = CalendarFetcherUtils.calculateTimezoneAdjustment(event, startDate.toDate());

					newEvents.push({
						title: title,
						startDate: (adjustDays ? (adjustDays > 0 ? startDate.add(adjustDays, "hours") : startDate.subtract(Math.abs(adjustDays), "hours")) : startDate).format("x"),
						endDate: (adjustDays ? (adjustDays > 0 ? endDate.add(adjustDays, "hours") : endDate.subtract(Math.abs(adjustDays), "hours")) : endDate).format("x"),
						fullDayEvent: fullDayEvent,
						class: event.class,
						location: location,
						geo: geo,
						description: description
					});
				}
			}
		});

		newEvents.sort(function (a, b) {
			return a.startDate - b.startDate;
		});

		return newEvents;
	},


	getIanaTZFromMS (msTZName) {

		const he = zoneTable[msTZName];

		return he ? he.iana[0] : null;
	},


	getTitleFromEvent (event) {
		let title = "Event";
		if (event.summary) {
			title = typeof event.summary.val !== "undefined" ? event.summary.val : event.summary;
		} else if (event.description) {
			title = event.description;
		}

		return title;
	},


	isFullDayEvent (event) {
		if (event.start.length === 8 || event.start.dateOnly || event.datetype === "date") {
			return true;
		}

		const start = event.start || 0;
		const startDate = new Date(start);
		const end = event.end || 0;
		if ((end - start) % (24 * 60 * 60 * 1000) === 0 && startDate.getHours() === 0 && startDate.getMinutes() === 0) {

			return true;
		}

		return false;
	},


	timeFilterApplies (now, endDate, filter) {
		if (filter) {
			const until = filter.split(" "),
				value = parseInt(until[0]),
				increment = until[1].slice(-1) === "s" ? until[1] : `${until[1]}s`,
				filterUntil = moment(endDate.format()).subtract(value, increment);

			return now < filterUntil.format("x");
		}

		return false;
	},

	titleFilterApplies (title, filter, useRegex, regexFlags) {
		if (useRegex) {
			let regexFilter = filter;

			if (filter[0] === "/") {

				regexFilter = filter.substr(1).slice(0, -1);
			}
			return new RegExp(regexFilter, regexFlags).test(title);
		} else {
			return title.includes(filter);
		}
	}
};

if (typeof module !== "undefined") {
	module.exports = CalendarFetcherUtils;
}
