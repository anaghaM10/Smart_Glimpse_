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
		sendNotifications: false
	},
	
	getScripts () {
		return ["moment.js", "moment-timezone.js"];
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

		const digitalWrapper = document.createElement("div");
		digitalWrapper.className = "digital";
		digitalWrapper.style.gridArea = "center";
		const dateWrapper = document.createElement("div");
		const timeWrapper = document.createElement("div");
		const secondsWrapper = document.createElement("sup");
		const periodWrapper = document.createElement("span");
		const weekWrapper = document.createElement("div");

		dateWrapper.className = "date normal medium";
		timeWrapper.className = "time bright large light";
		secondsWrapper.className = "seconds dimmed";
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

		if (this.config.showWeek) {
			weekWrapper.innerHTML = this.translate("WEEK", { weekNumber: now.week() });
			digitalWrapper.appendChild(weekWrapper);
		}

		if (this.config.displayType === "digital") {
			wrapper.appendChild(digitalWrapper);
		}
		
		return wrapper;
	}
});
