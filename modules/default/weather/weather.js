
Module.register("weather", {
	
	defaults: {
		weatherProvider: "openweathermap",
		roundTemp: false,
		type: "current", 
		lang: config.language,
		units: config.units,
		tempUnits: config.units,
		windUnits: config.units,
		timeFormat: config.timeFormat,
		updateInterval: 10 * 60 * 1000, 
		animationSpeed: 1000,
		showFeelsLike: true,
		showHumidity: false,
		showIndoorHumidity: false,
		showIndoorTemperature: false,
		allowOverrideNotification: false,
		showPeriod: true,
		showPeriodUpper: false,
		showPrecipitationAmount: false,
		showPrecipitationProbability: false,
		showUVIndex: false,
		showSun: true,
		showWindDirection: true,
		showWindDirectionAsArrow: false,
		degreeLabel: false,
		decimalSymbol: ".",
		maxNumberOfDays: 5,
		maxEntries: 5,
		ignoreToday: false,
		fade: true,
		fadePoint: 0.25, 
		initialLoadDelay: 0, 
		appendLocationNameToHeader: true,
		calendarClass: "calendar",
		tableClass: "small",
		onlyTemp: false,
		colored: false,
		absoluteDates: false,
		hourlyForecastIncrements: 1
	},

	weatherProvider: null,

	firstEvent: null,

	getStyles () {
		return ["font-awesome.css", "weather-icons.css", "weather.css"];
	},

	getScripts () {
		return ["moment.js", "weatherutils.js", "weatherobject.js", this.file("providers/overrideWrapper.js"), "weatherprovider.js", "suncalc.js", this.file(`providers/${this.config.weatherProvider.toLowerCase()}.js`)];
	},

	getHeader () {
		if (this.config.appendLocationNameToHeader && this.weatherProvider) {
			if (this.data.header) return `${this.data.header} ${this.weatherProvider.fetchedLocation()}`;
			else return this.weatherProvider.fetchedLocation();
		}

		return this.data.header ? this.data.header : "";
	},

	start () {
		moment.locale(this.config.lang);

		if (this.config.useKmh) {
			Log.warn("Your are using the deprecated config values 'useKmh'. Please switch to windUnits!");
			this.windUnits = "kmh";
		} else if (this.config.useBeaufort) {
			Log.warn("Your are using the deprecated config values 'useBeaufort'. Please switch to windUnits!");
			this.windUnits = "beaufort";
		}

		this.weatherProvider = WeatherProvider.initialize(this.config.weatherProvider, this);

		this.weatherProvider.start();

		this.addFilters();

		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	notificationReceived (notification, payload, sender) {
		if (notification === "CALENDAR_EVENTS") {
			const senderClasses = sender.data.classes.toLowerCase().split(" ");
			if (senderClasses.indexOf(this.config.calendarClass.toLowerCase()) !== -1) {
				this.firstEvent = null;
				for (let event of payload) {
					if (event.location || event.geo) {
						this.firstEvent = event;
						Log.debug("First upcoming event with location: ", event);
						break;
					}
				}
			}
		} else if (notification === "INDOOR_TEMPERATURE") {
			this.indoorTemperature = this.roundValue(payload);
			this.updateDom(300);
		} else if (notification === "INDOOR_HUMIDITY") {
			this.indoorHumidity = this.roundValue(payload);
			this.updateDom(300);
		} else if (notification === "CURRENT_WEATHER_OVERRIDE" && this.config.allowOverrideNotification) {
			this.weatherProvider.notificationReceived(payload);
		}
	},

	getTemplate () {
		switch (this.config.type.toLowerCase()) {
			case "current":
				return "current.njk";
			case "hourly":
				return "hourly.njk";
			case "daily":
			case "forecast":
				return "forecast.njk";
			default:
				return "forecast.njk";
		}
	},

	getTemplateData () {
		const currentData = this.weatherProvider.currentWeather();
		const forecastData = this.weatherProvider.weatherForecast();

		const hourlyData = this.weatherProvider.weatherHourly()?.filter((e, i) => (i + 1) % this.config.hourlyForecastIncrements === this.config.hourlyForecastIncrements - 1);

		return {
			config: this.config,
			current: currentData,
			forecast: forecastData,
			hourly: hourlyData,
			indoor: {
				humidity: this.indoorHumidity,
				temperature: this.indoorTemperature
			}
		};
	},

	updateAvailable () {
		Log.log("New weather information available.");
		this.updateDom(0);
		this.scheduleUpdate();

		if (this.weatherProvider.currentWeather()) {
			this.sendNotification("CURRENTWEATHER_TYPE", { type: this.weatherProvider.currentWeather().weatherType.replace("-", "_") });
		}

		const notificationPayload = {
			currentWeather: this.weatherProvider?.currentWeatherObject?.simpleClone() ?? null,
			forecastArray: this.weatherProvider?.weatherForecastArray?.map((ar) => ar.simpleClone()) ?? [],
			hourlyArray: this.weatherProvider?.weatherHourlyArray?.map((ar) => ar.simpleClone()) ?? [],
			locationName: this.weatherProvider?.fetchedLocationName,
			providerName: this.weatherProvider.providerName
		};
		this.sendNotification("WEATHER_UPDATED", notificationPayload);
	},

	scheduleUpdate (delay = null) {
		let nextLoad = this.config.updateInterval;
		if (delay !== null && delay >= 0) {
			nextLoad = delay;
		}

		setTimeout(() => {
			switch (this.config.type.toLowerCase()) {
				case "current":
					this.weatherProvider.fetchCurrentWeather();
					break;
				case "hourly":
					this.weatherProvider.fetchWeatherHourly();
					break;
				case "daily":
				case "forecast":
					this.weatherProvider.fetchWeatherForecast();
					break;
				default:
					Log.error(`Invalid type ${this.config.type} configured (must be one of 'current', 'hourly', 'daily' or 'forecast')`);
			}
		}, nextLoad);
	},

	roundValue (temperature) {
		const decimals = this.config.roundTemp ? 0 : 1;
		const roundValue = parseFloat(temperature).toFixed(decimals);
		return roundValue === "-0" ? 0 : roundValue;
	},

	addFilters () {
		this.nunjucksEnvironment().addFilter(
			"formatTime",
			function (date) {
				return formatTime(this.config, date);
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"unit",
			function (value, type, valueUnit) {
				let formattedValue;
				if (type === "temperature") {
					formattedValue = `${this.roundValue(WeatherUtils.convertTemp(value, this.config.tempUnits))}°`;
					if (this.config.degreeLabel) {
						if (this.config.tempUnits === "metric") {
							formattedValue += "C";
						} else if (this.config.tempUnits === "imperial") {
							formattedValue += "F";
						} else {
							formattedValue += "K";
						}
					}
				} else if (type === "precip") {
					if (value === null || isNaN(value) || value === 0 || value.toFixed(2) === "0.00") {
						formattedValue = "";
					} else {
						formattedValue = WeatherUtils.convertPrecipitationUnit(value, valueUnit, this.config.units);
					}
				} else if (type === "humidity") {
					formattedValue = `${value}%`;
				} else if (type === "wind") {
					formattedValue = WeatherUtils.convertWind(value, this.config.windUnits);
				}
				return formattedValue;
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"roundValue",
			function (value) {
				return this.roundValue(value);
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"decimalSymbol",
			function (value) {
				return value.toString().replace(/\./g, this.config.decimalSymbol);
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"calcNumSteps",
			function (forecast) {
				return Math.min(forecast.length, this.config.maxNumberOfDays);
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"calcNumEntries",
			function (dataArray) {
				return Math.min(dataArray.length, this.config.maxEntries);
			}.bind(this)
		);

		this.nunjucksEnvironment().addFilter(
			"opacity",
			function (currentStep, numSteps) {
				if (this.config.fade && this.config.fadePoint < 1) {
					if (this.config.fadePoint < 0) {
						this.config.fadePoint = 0;
					}
					const startingPoint = numSteps * this.config.fadePoint;
					const numFadesteps = numSteps - startingPoint;
					if (currentStep >= startingPoint) {
						return 1 - (currentStep - startingPoint) / numFadesteps;
					} else {
						return 1;
					}
				} else {
					return 1;
				}
			}.bind(this)
		);
	}
});
