
Module.register("clock", {
	defaults: {
		displayType: "digital", 

		timeFormat: config.timeFormat,
		timezone: null,

		displaySeconds: true,
		showPeriod: true,
		showPeriodUpper: false,
		clockBold: false,
		showDate: true,
		showTime: true,
		showWeek: false,
		dateFormat: "dddd, LL",
		sendNotifications: false,
		analogSize: "200px",
		analogFace: "simple", 
		analogPlacement: "bottom", 
		analogShowDate: "top", 
		secondsColor: "#888888",

		showSunTimes: false,
		showMoonTimes: false, 
		lat: 47.630539,
		lon: -122.344147
	},
	
	getScripts () {
		return ["moment.js", "moment-timezone.js", "suncalc.js"];
	},
	getStyles () {
		return ["clock_styles.css"];
	},
	start () {
		Log.info(`Starting module: ${this.name}`);

		this.second = moment().second();
		this.minute = moment().minute();

		const delayCalculator = (reducedSeconds) => {
			const EXTRA_DELAY = 50; 
			if (this.config.displaySeconds) {
				return 1000 - moment().milliseconds() + EXTRA_DELAY;
			} else {
				return (60 - reducedSeconds) * 1000 - moment().milliseconds() + EXTRA_DELAY;
			}
		};

		const notificationTimer = () => {
			this.updateDom();

			if (this.config.sendNotifications) {
			
				if (this.config.displaySeconds) {
					this.second = moment().second();
					if (this.second !== 0) {
						this.sendNotification("CLOCK_SECOND", this.second);
						setTimeout(notificationTimer, delayCalculator(0));
						return;
					}
				}

				this.minute = moment().minute();
				this.sendNotification("CLOCK_MINUTE", this.minute);
			}

			setTimeout(notificationTimer, delayCalculator(0));
		};
		setTimeout(notificationTimer, delayCalculator(this.second));
		moment.locale(config.language);
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.classList.add("clock-grid");

		const analogWrapper = document.createElement("div");
		analogWrapper.className = "clock-circle";
		const digitalWrapper = document.createElement("div");
		digitalWrapper.className = "digital";
		digitalWrapper.style.gridArea = "center";
		const dateWrapper = document.createElement("div");
		const timeWrapper = document.createElement("div");
		const secondsWrapper = document.createElement("sup");
		const periodWrapper = document.createElement("span");
		const sunWrapper = document.createElement("div");
		const moonWrapper = document.createElement("div");
		const weekWrapper = document.createElement("div");

		dateWrapper.className = "date normal medium";
		timeWrapper.className = "time bright large light";
		secondsWrapper.className = "seconds dimmed";
		sunWrapper.className = "sun dimmed small";
		moonWrapper.className = "moon dimmed small";
		weekWrapper.className = "week dimmed medium";
		let timeString;
		const now = moment();
		if (this.config.timezone) {
			now.tz(this.config.timezone);
		}

		let hourSymbol = "HH";
		if (this.config.timeFormat !== 24) {
			hourSymbol = "h";
		}

		if (this.config.clockBold) {
			timeString = now.format(`${hourSymbol}[<span class="bold">]mm[</span>]`);
		} else {
			timeString = now.format(`${hourSymbol}:mm`);
		}

		if (this.config.showDate) {
			dateWrapper.innerHTML = now.format(this.config.dateFormat);
			digitalWrapper.appendChild(dateWrapper);
		}

		if (this.config.displayType !== "analog" && this.config.showTime) {
			timeWrapper.innerHTML = timeString;
			secondsWrapper.innerHTML = now.format("ss");
			if (this.config.showPeriodUpper) {
				periodWrapper.innerHTML = now.format("A");
			} else {
				periodWrapper.innerHTML = now.format("a");
			}
			if (this.config.displaySeconds) {
				timeWrapper.appendChild(secondsWrapper);
			}
			if (this.config.showPeriod && this.config.timeFormat !== 24) {
				timeWrapper.appendChild(periodWrapper);
			}
			digitalWrapper.appendChild(timeWrapper);
		}
		if (this.config.showSunTimes) {
			const sunTimes = SunCalc.getTimes(now, this.config.lat, this.config.lon);
			const isVisible = now.isBetween(sunTimes.sunrise, sunTimes.sunset);
			let nextEvent;
			if (now.isBefore(sunTimes.sunrise)) {
				nextEvent = sunTimes.sunrise;
			} else if (now.isBefore(sunTimes.sunset)) {
				nextEvent = sunTimes.sunset;
			} else {
				const tomorrowSunTimes = SunCalc.getTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				nextEvent = tomorrowSunTimes.sunrise;
			}
			const untilNextEvent = moment.duration(moment(nextEvent).diff(now));
			const untilNextEventString = `${untilNextEvent.hours()}h ${untilNextEvent.minutes()}m`;
			sunWrapper.innerHTML
				= `<span class="${isVisible ? "bright" : ""}"><i class="fas fa-sun" aria-hidden="true"></i> ${untilNextEventString}</span>`
				+ `<span><i class="fas fa-arrow-up" aria-hidden="true"></i> ${formatTime(this.config, sunTimes.sunrise)}</span>`
				+ `<span><i class="fas fa-arrow-down" aria-hidden="true"></i> ${formatTime(this.config, sunTimes.sunset)}</span>`;
			digitalWrapper.appendChild(sunWrapper);
		}
		if (this.config.showMoonTimes) {
			const moonIllumination = SunCalc.getMoonIllumination(now.toDate());
			const moonTimes = SunCalc.getMoonTimes(now, this.config.lat, this.config.lon);
			const moonRise = moonTimes.rise;
			let moonSet;
			if (moment(moonTimes.set).isAfter(moonTimes.rise)) {
				moonSet = moonTimes.set;
			} else {
				const nextMoonTimes = SunCalc.getMoonTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				moonSet = nextMoonTimes.set;
			}
			const isVisible = now.isBetween(moonRise, moonSet) || moonTimes.alwaysUp === true;
			const showFraction = ["both", "percent"].includes(this.config.showMoonTimes);
			const showUnicode = ["both", "phase"].includes(this.config.showMoonTimes);
			const illuminatedFractionString = `${Math.round(moonIllumination.fraction * 100)}%`;
			const image = showUnicode ? [..."🌑🌒🌓🌔🌕🌖🌗🌘"][Math.floor(moonIllumination.phase * 8)] : "<i class=\"fas fa-moon\" aria-hidden=\"true\"></i>";

			moonWrapper.innerHTML
				= `<span class="${isVisible ? "bright" : ""}">${image} ${showFraction ? illuminatedFractionString : ""}</span>`
				+ `<span><i class="fas fa-arrow-up" aria-hidden="true"></i> ${moonRise ? formatTime(this.config, moonRise) : "..."}</span>`
				+ `<span><i class="fas fa-arrow-down" aria-hidden="true"></i> ${moonSet ? formatTime(this.config, moonSet) : "..."}</span>`;
			digitalWrapper.appendChild(moonWrapper);
		}

		if (this.config.showWeek) {
			weekWrapper.innerHTML = this.translate("WEEK", { weekNumber: now.week() });
			digitalWrapper.appendChild(weekWrapper);
		}
		if (this.config.displayType !== "digital") {
			if (this.config.timezone) {
				now.tz(this.config.timezone);
			}
			const second = now.seconds() * 6,
				minute = now.minute() * 6 + second / 60,
				hour = ((now.hours() % 12) / 12) * 360 + 90 + minute / 12;
			analogWrapper.style.width = this.config.analogSize;
			analogWrapper.style.height = this.config.analogSize;

			if (this.config.analogFace !== "" && this.config.analogFace !== "simple" && this.config.analogFace !== "none") {
				analogWrapper.style.background = `url(${this.data.path}faces/${this.config.analogFace}.svg)`;
				analogWrapper.style.backgroundSize = "100%";
				analogWrapper.style.border = "rgba(0, 0, 0, 0.1)"; 
			} else if (this.config.analogFace !== "none") {
				analogWrapper.style.border = "2px solid white";
			}
			const clockFace = document.createElement("div");
			clockFace.className = "clock-face";

			const clockHour = document.createElement("div");
			clockHour.id = "clock-hour";
			clockHour.style.transform = `rotate(${hour}deg)`;
			clockHour.className = "clock-hour";
			const clockMinute = document.createElement("div");
			clockMinute.id = "clock-minute";
			clockMinute.style.transform = `rotate(${minute}deg)`;
			clockMinute.className = "clock-minute";
			clockFace.appendChild(clockHour);
			clockFace.appendChild(clockMinute);

			if (this.config.displaySeconds) {
				const clockSecond = document.createElement("div");
				clockSecond.id = "clock-second";
				clockSecond.style.transform = `rotate(${second}deg)`;
				clockSecond.className = "clock-second";
				clockSecond.style.backgroundColor = this.config.secondsColor;
				clockFace.appendChild(clockSecond);
			}
			analogWrapper.appendChild(clockFace);
		}
		if (this.config.displayType === "analog") {
			
			if (this.config.showDate) {
				dateWrapper.innerHTML = now.format(this.config.dateFormat);
				wrapper.appendChild(dateWrapper);
			}
			if (this.config.analogShowDate === "bottom") {
				wrapper.classList.add("clock-grid-bottom");
			} else if (this.config.analogShowDate === "top") {
				wrapper.classList.add("clock-grid-top");
			}
			wrapper.appendChild(analogWrapper);
		} else if (this.config.displayType === "digital") {
			wrapper.appendChild(digitalWrapper);
		} else if (this.config.displayType === "both") {
			wrapper.classList.add(`clock-grid-${this.config.analogPlacement}`);
			wrapper.appendChild(analogWrapper);
			wrapper.appendChild(digitalWrapper);
		}
		return wrapper;
	}
});
