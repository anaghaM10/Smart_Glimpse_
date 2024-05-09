
WeatherProvider.register("openweathermap", {
	
	providerName: "OpenWeatherMap",

	defaults: {
		apiVersion: "2.5",
		apiBase: "https://api.openweathermap.org/data/",
		weatherEndpoint: "", 
		location: false,
		lat: 0, 
		lon: 0,
		apiKey: ""
	},

	fetchCurrentWeather () {
		this.fetchData(this.getUrl())
			.then((data) => {
				let currentWeather;
				if (this.config.weatherEndpoint === "/onecall") {
					currentWeather = this.generateWeatherObjectsFromOnecall(data).current;
					this.setFetchedLocation(`${data.timezone}`);
				} else {
					currentWeather = this.generateWeatherObjectFromCurrentWeather(data);
				}
				this.setCurrentWeather(currentWeather);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	fetchWeatherForecast () {
		this.fetchData(this.getUrl())
			.then((data) => {
				let forecast;
				let location;
				if (this.config.weatherEndpoint === "/onecall") {
					forecast = this.generateWeatherObjectsFromOnecall(data).days;
					location = `${data.timezone}`;
				} else {
					forecast = this.generateWeatherObjectsFromForecast(data.list);
					location = `${data.city.name}, ${data.city.country}`;
				}
				this.setWeatherForecast(forecast);
				this.setFetchedLocation(location);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	fetchWeatherHourly () {
		this.fetchData(this.getUrl())
			.then((data) => {
				if (!data) {
					return;
				}

				this.setFetchedLocation(`(${data.lat},${data.lon})`);

				const weatherData = this.generateWeatherObjectsFromOnecall(data);
				this.setWeatherHourly(weatherData.hours);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	
	setConfig (config) {
		this.config = config;
		if (!this.config.weatherEndpoint) {
			switch (this.config.type) {
				case "hourly":
					this.config.weatherEndpoint = "/onecall";
					break;
				case "daily":
				case "forecast":
					this.config.weatherEndpoint = "/forecast";
					break;
				case "current":
					this.config.weatherEndpoint = "/weather";
					break;
				default:
					Log.error("weatherEndpoint not configured and could not resolve it based on type");
			}
		}
	},

	
	getUrl () {
		return this.config.apiBase + this.config.apiVersion + this.config.weatherEndpoint + this.getParams();
	},

	
	generateWeatherObjectFromCurrentWeather (currentWeatherData) {
		const currentWeather = new WeatherObject();

		currentWeather.date = moment.unix(currentWeatherData.dt);
		currentWeather.humidity = currentWeatherData.main.humidity;
		currentWeather.temperature = currentWeatherData.main.temp;
		currentWeather.feelsLikeTemp = currentWeatherData.main.feels_like;
		currentWeather.windSpeed = currentWeatherData.wind.speed;
		currentWeather.windFromDirection = currentWeatherData.wind.deg;
		currentWeather.weatherType = this.convertWeatherType(currentWeatherData.weather[0].icon);
		currentWeather.sunrise = moment.unix(currentWeatherData.sys.sunrise);
		currentWeather.sunset = moment.unix(currentWeatherData.sys.sunset);

		return currentWeather;
	},

	
	generateWeatherObjectsFromForecast (forecasts) {
		if (this.config.weatherEndpoint === "/forecast") {
			return this.generateForecastHourly(forecasts);
		} else if (this.config.weatherEndpoint === "/forecast/daily") {
			return this.generateForecastDaily(forecasts);
		}
		return [new WeatherObject()];
	},

	
	generateWeatherObjectsFromOnecall (data) {
		if (this.config.weatherEndpoint === "/onecall") {
			return this.fetchOnecall(data);
		}

		return { current: new WeatherObject(), hours: [], days: [] };
	},

	
	generateForecastHourly (forecasts) {
		const days = [];
		let minTemp = [];
		let maxTemp = [];
		let rain = 0;
		let snow = 0;
		let date = "";
		let weather = new WeatherObject();

		for (const forecast of forecasts) {
			if (date !== moment.unix(forecast.dt).format("YYYY-MM-DD")) {
				weather.minTemperature = Math.min.apply(null, minTemp);
				weather.maxTemperature = Math.max.apply(null, maxTemp);
				weather.rain = rain;
				weather.snow = snow;
				weather.precipitationAmount = (weather.rain ?? 0) + (weather.snow ?? 0);
				days.push(weather);
				weather = new WeatherObject();

				minTemp = [];
				maxTemp = [];
				rain = 0;
				snow = 0;

				date = moment.unix(forecast.dt).format("YYYY-MM-DD");

				weather.date = moment.unix(forecast.dt);

				weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			}

			if (moment.unix(forecast.dt).format("H") >= 8 && moment.unix(forecast.dt).format("H") <= 17) {
				weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			}

			minTemp.push(forecast.main.temp_min);
			maxTemp.push(forecast.main.temp_max);

			if (forecast.hasOwnProperty("rain") && !isNaN(forecast.rain["3h"])) {
				rain += forecast.rain["3h"];
			}

			if (forecast.hasOwnProperty("snow") && !isNaN(forecast.snow["3h"])) {
				snow += forecast.snow["3h"];
			}
		}

		weather.minTemperature = Math.min.apply(null, minTemp);
		weather.maxTemperature = Math.max.apply(null, maxTemp);
		weather.rain = rain;
		weather.snow = snow;
		weather.precipitationAmount = (weather.rain ?? 0) + (weather.snow ?? 0);
		days.push(weather);
		return days.slice(1);
	},

	
	generateForecastDaily (forecasts) {
		
		const days = [];

		for (const forecast of forecasts) {
			const weather = new WeatherObject();

			weather.date = moment.unix(forecast.dt);
			weather.minTemperature = forecast.temp.min;
			weather.maxTemperature = forecast.temp.max;
			weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			weather.rain = 0;
			weather.snow = 0;

			
			if (forecast.hasOwnProperty("rain") && !isNaN(forecast.rain)) {
				weather.rain = forecast.rain;
			}

			
			if (forecast.hasOwnProperty("snow") && !isNaN(forecast.snow)) {
				weather.snow = forecast.snow;
			}

			weather.precipitationAmount = weather.rain + weather.snow;
			weather.precipitationProbability = forecast.pop ? forecast.pop * 100 : undefined;

			days.push(weather);
		}

		return days;
	},

	
	fetchOnecall (data) {
		let precip = false;

		const current = new WeatherObject();
		if (data.hasOwnProperty("current")) {
			current.date = moment.unix(data.current.dt).utcOffset(data.timezone_offset / 60);
			current.windSpeed = data.current.wind_speed;
			current.windFromDirection = data.current.wind_deg;
			current.sunrise = moment.unix(data.current.sunrise).utcOffset(data.timezone_offset / 60);
			current.sunset = moment.unix(data.current.sunset).utcOffset(data.timezone_offset / 60);
			current.temperature = data.current.temp;
			current.weatherType = this.convertWeatherType(data.current.weather[0].icon);
			current.humidity = data.current.humidity;
			current.uv_index = data.current.uvi;
			if (data.current.hasOwnProperty("rain") && !isNaN(data.current["rain"]["1h"])) {
				current.rain = data.current["rain"]["1h"];
				precip = true;
			}
			if (data.current.hasOwnProperty("snow") && !isNaN(data.current["snow"]["1h"])) {
				current.snow = data.current["snow"]["1h"];
				precip = true;
			}
			if (precip) {
				current.precipitationAmount = (current.rain ?? 0) + (current.snow ?? 0);
			}
			current.feelsLikeTemp = data.current.feels_like;
		}

		let weather = new WeatherObject();

		const hours = [];
		if (data.hasOwnProperty("hourly")) {
			for (const hour of data.hourly) {
				weather.date = moment.unix(hour.dt).utcOffset(data.timezone_offset / 60);
				weather.temperature = hour.temp;
				weather.feelsLikeTemp = hour.feels_like;
				weather.humidity = hour.humidity;
				weather.windSpeed = hour.wind_speed;
				weather.windFromDirection = hour.wind_deg;
				weather.weatherType = this.convertWeatherType(hour.weather[0].icon);
				weather.precipitationProbability = hour.pop ? hour.pop * 100 : undefined;
				weather.uv_index = hour.uvi;
				precip = false;
				if (hour.hasOwnProperty("rain") && !isNaN(hour.rain["1h"])) {
					weather.rain = hour.rain["1h"];
					precip = true;
				}
				if (hour.hasOwnProperty("snow") && !isNaN(hour.snow["1h"])) {
					weather.snow = hour.snow["1h"];
					precip = true;
				}
				if (precip) {
					weather.precipitationAmount = (weather.rain ?? 0) + (weather.snow ?? 0);
				}

				hours.push(weather);
				weather = new WeatherObject();
			}
		}

		const days = [];
		if (data.hasOwnProperty("daily")) {
			for (const day of data.daily) {
				weather.date = moment.unix(day.dt).utcOffset(data.timezone_offset / 60);
				weather.sunrise = moment.unix(day.sunrise).utcOffset(data.timezone_offset / 60);
				weather.sunset = moment.unix(day.sunset).utcOffset(data.timezone_offset / 60);
				weather.minTemperature = day.temp.min;
				weather.maxTemperature = day.temp.max;
				weather.humidity = day.humidity;
				weather.windSpeed = day.wind_speed;
				weather.windFromDirection = day.wind_deg;
				weather.weatherType = this.convertWeatherType(day.weather[0].icon);
				weather.precipitationProbability = day.pop ? day.pop * 100 : undefined;
				weather.uv_index = day.uvi;
				precip = false;
				if (!isNaN(day.rain)) {
					weather.rain = day.rain;
					precip = true;
				}
				if (!isNaN(day.snow)) {
					weather.snow = day.snow;
					precip = true;
				}
				if (precip) {
					weather.precipitationAmount = (weather.rain ?? 0) + (weather.snow ?? 0);
				}

				days.push(weather);
				weather = new WeatherObject();
			}
		}

		return { current: current, hours: hours, days: days };
	},

	convertWeatherType (weatherType) {
		const weatherTypes = {
			"01d": "day-sunny",
			"02d": "day-cloudy",
			"03d": "cloudy",
			"04d": "cloudy-windy",
			"09d": "showers",
			"10d": "rain",
			"11d": "thunderstorm",
			"13d": "snow",
			"50d": "fog",
			"01n": "night-clear",
			"02n": "night-cloudy",
			"03n": "night-cloudy",
			"04n": "night-cloudy",
			"09n": "night-showers",
			"10n": "night-rain",
			"11n": "night-thunderstorm",
			"13n": "night-snow",
			"50n": "night-alt-cloudy-windy"
		};

		return weatherTypes.hasOwnProperty(weatherType) ? weatherTypes[weatherType] : null;
	},

	
	getParams () {
		let params = "?";
		if (this.config.weatherEndpoint === "/onecall") {
			params += `lat=${this.config.lat}`;
			params += `&lon=${this.config.lon}`;
			if (this.config.type === "current") {
				params += "&exclude=minutely,hourly,daily";
			} else if (this.config.type === "hourly") {
				params += "&exclude=current,minutely,daily";
			} else if (this.config.type === "daily" || this.config.type === "forecast") {
				params += "&exclude=current,minutely,hourly";
			} else {
				params += "&exclude=minutely";
			}
		} else if (this.config.lat && this.config.lon) {
			params += `lat=${this.config.lat}&lon=${this.config.lon}`;
		} else if (this.config.locationID) {
			params += `id=${this.config.locationID}`;
		} else if (this.config.location) {
			params += `q=${this.config.location}`;
		} else if (this.firstEvent && this.firstEvent.geo) {
			params += `lat=${this.firstEvent.geo.lat}&lon=${this.firstEvent.geo.lon}`;
		} else if (this.firstEvent && this.firstEvent.location) {
			params += `q=${this.firstEvent.location}`;
		} else {
			this.hide(this.config.animationSpeed, { lockString: this.identifier });
			return;
		}

		params += "&units=metric"; 
		params += `&lang=${this.config.lang}`;
		params += `&APPID=${this.config.apiKey}`;

		return params;
	}
});
