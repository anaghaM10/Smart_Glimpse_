
const WeatherUtils = {

	
	beaufortWindSpeed (speedInMS) {
		const windInKmh = this.convertWind(speedInMS, "kmh");
		const speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
		for (const [index, speed] of speeds.entries()) {
			if (speed > windInKmh) {
				return index;
			}
		}
		return 12;
	},

	
	convertPrecipitationUnit (value, valueUnit, outputUnit) {
		if (valueUnit === "%") return `${value.toFixed(0)} ${valueUnit}`;

		let convertedValue = value;
		let conversionUnit = valueUnit;
		if (outputUnit === "imperial") {
			if (valueUnit && valueUnit.toLowerCase() === "cm") convertedValue = convertedValue * 0.3937007874;
			else convertedValue = convertedValue * 0.03937007874;
			conversionUnit = "in";
		} else {
			conversionUnit = valueUnit ? valueUnit : "mm";
		}

		return `${convertedValue.toFixed(2)} ${conversionUnit}`;
	},

	
	convertTemp (tempInC, unit) {
		return unit === "imperial" ? tempInC * 1.8 + 32 : tempInC;
	},

	
	convertWind (windInMS, unit) {
		switch (unit) {
			case "beaufort":
				return this.beaufortWindSpeed(windInMS);
			case "kmh":
				return (windInMS * 3600) / 1000;
			case "knots":
				return windInMS * 1.943844;
			case "imperial":
				return windInMS * 2.2369362920544;
			case "metric":
			default:
				return windInMS;
		}
	},

	
	convertWindDirection (windDirection) {
		const windCardinals = {
			N: 0,
			NNE: 22,
			NE: 45,
			ENE: 67,
			E: 90,
			ESE: 112,
			SE: 135,
			SSE: 157,
			S: 180,
			SSW: 202,
			SW: 225,
			WSW: 247,
			W: 270,
			WNW: 292,
			NW: 315,
			NNW: 337
		};

		return windCardinals.hasOwnProperty(windDirection) ? windCardinals[windDirection] : null;
	},

	convertWindToMetric (mph) {
		return mph / 2.2369362920544;
	},

	convertWindToMs (kmh) {
		return kmh * 0.27777777777778;
	},

	calculateFeelsLike (temperature, windSpeed, humidity) {
		const windInMph = this.convertWind(windSpeed, "imperial");
		const tempInF = this.convertTemp(temperature, "imperial");
		let feelsLike = tempInF;

		if (windInMph > 3 && tempInF < 50) {
			feelsLike = Math.round(35.74 + 0.6215 * tempInF - 35.75 * Math.pow(windInMph, 0.16) + 0.4275 * tempInF * Math.pow(windInMph, 0.16));
		} else if (tempInF > 80 && humidity > 40) {
			feelsLike
				= -42.379
				+ 2.04901523 * tempInF
				+ 10.14333127 * humidity
				- 0.22475541 * tempInF * humidity
				- 6.83783 * Math.pow(10, -3) * tempInF * tempInF
				- 5.481717 * Math.pow(10, -2) * humidity * humidity
				+ 1.22874 * Math.pow(10, -3) * tempInF * tempInF * humidity
				+ 8.5282 * Math.pow(10, -4) * tempInF * humidity * humidity
				- 1.99 * Math.pow(10, -6) * tempInF * tempInF * humidity * humidity;
		}

		return ((feelsLike - 32) * 5) / 9;
	}
};

if (typeof module !== "undefined") {
	module.exports = WeatherUtils;
}
