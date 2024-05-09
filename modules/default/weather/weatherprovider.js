const WeatherProvider = Class.extend({
	providerName: null,
	defaults: {},

	currentWeatherObject: null,
	weatherForecastArray: null,
	weatherHourlyArray: null,
	fetchedLocationName: null,
	config: null,
	delegate: null,
	providerIdentifier: null,
	init (config) {
		this.config = config;
		Log.info(`Weather provider: ${this.providerName} initialized.`);
	},
	setConfig (config) {
		this.config = config;
		Log.info(`Weather provider: ${this.providerName} config set.`, this.config);
	},
	start () {
		Log.info(`Weather provider: ${this.providerName} started.`);
	},
	fetchCurrentWeather () {
		Log.warn(`Weather provider: ${this.providerName} does not subclass the fetchCurrentWeather method.`);
	},
	fetchWeatherForecast () {
		Log.warn(`Weather provider: ${this.providerName} does not subclass the fetchWeatherForecast method.`);
	},
	fetchWeatherHourly () {
		Log.warn(`Weather provider: ${this.providerName} does not subclass the fetchWeatherHourly method.`);
	},

	currentWeather () {
		return this.currentWeatherObject;
	},

	weatherForecast () {
		return this.weatherForecastArray;
	},

	weatherHourly () {
		return this.weatherHourlyArray;
	},

	fetchedLocation () {
		return this.fetchedLocationName || "";
	},

	setCurrentWeather (currentWeatherObject) {
		this.currentWeatherObject = currentWeatherObject;
	},

	setWeatherForecast (weatherForecastArray) {
		this.weatherForecastArray = weatherForecastArray;
	},

	setWeatherHourly (weatherHourlyArray) {
		this.weatherHourlyArray = weatherHourlyArray;
	},

	setFetchedLocation (name) {
		this.fetchedLocationName = name;
	},

	updateAvailable () {
		this.delegate.updateAvailable(this);
	},


	async fetchData (url, type = "json", requestHeaders = undefined, expectedResponseHeaders = undefined) {
		const mockData = this.config.mockData;
		if (mockData) {
			const data = mockData.substring(1, mockData.length - 1);
			return JSON.parse(data);
		}
		const useCorsProxy = typeof this.config.useCorsProxy !== "undefined" && this.config.useCorsProxy;
		return performWebRequest(url, type, useCorsProxy, requestHeaders, expectedResponseHeaders);
	}
});


WeatherProvider.providers = [];


WeatherProvider.register = function (providerIdentifier, providerDetails) {
	WeatherProvider.providers[providerIdentifier.toLowerCase()] = WeatherProvider.extend(providerDetails);
};


WeatherProvider.initialize = function (providerIdentifier, delegate) {
	const pi = providerIdentifier.toLowerCase();

	const provider = new WeatherProvider.providers[pi]();
	const config = Object.assign({}, provider.defaults, delegate.config);

	provider.delegate = delegate;
	provider.setConfig(config);

	provider.providerIdentifier = pi;
	if (!provider.providerName) {
		provider.providerName = pi;
	}

	if (config.allowOverrideNotification) {
		return new OverrideWrapper(provider);
	}

	return provider;
};
