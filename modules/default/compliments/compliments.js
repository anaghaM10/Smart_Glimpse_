
Module.register("compliments", {
	
	defaults: {
		compliments: {
			anytime: ["Hey there beautiful!"],
			morning: ["Good morning, Gorgeous!", "Enjoy your day!", "How was your sleep?","Your positivity is the perfect start to the day"],
			afternoon: ["Your energy is still going strong!","Hope your afternoon is as vibrant and energetic as you are!","Hello, beauty!","You look confident", "You look smart!", "Looking good today!"],
			evening: ["Your presence is soothing after a long day","As the day winds down, your warmth and kindness continue to shine brightly","Wow, you look superrrr!", "You look nice!", "Hey you should be proud of yourself !"],
			"....-01-01": ["Happy new year!"],
			day_sunny: [
				"Today is a sunny day",
			],
			rain: [
				"Don't forget your umbrella"
			]
		},
		updateInterval: 30000,
		remoteFile: null,
		fadeSpeed: 4000,
		morningStartTime: 3,
		morningEndTime: 12,
		afternoonStartTime: 12,
		afternoonEndTime: 17,
		random: true
	},
	lastIndexUsed: -1,
	
	currentWeatherType: "",
	getScripts () {
		return ["moment.js"];
	},

	async start () {
		Log.info(`Starting module: ${this.name}`);

		this.lastComplimentIndex = -1;

		if (this.config.remoteFile !== null) {
			const response = await this.loadComplimentFile();
			this.config.compliments = JSON.parse(response);
			this.updateDom();
		}

		
		setInterval(() => {
			this.updateDom(this.config.fadeSpeed);
		}, this.config.updateInterval);
	},
	randomIndex (compliments) {
		if (compliments.length === 1) {
			return 0;
		}

		const generate = function () {
			return Math.floor(Math.random() * compliments.length);
		};

		let complimentIndex = generate();

		while (complimentIndex === this.lastComplimentIndex) {
			complimentIndex = generate();
		}

		this.lastComplimentIndex = complimentIndex;

		return complimentIndex;
	},
	complimentArray () {
		const hour = moment().hour();
		const date = moment().format("YYYY-MM-DD");
		let compliments = [];
		if (hour >= this.config.morningStartTime && hour < this.config.morningEndTime && this.config.compliments.hasOwnProperty("morning")) {
			compliments = [...this.config.compliments.morning];
		} else if (hour >= this.config.afternoonStartTime && hour < this.config.afternoonEndTime && this.config.compliments.hasOwnProperty("afternoon")) {
			compliments = [...this.config.compliments.afternoon];
		} else if (this.config.compliments.hasOwnProperty("evening")) {
			compliments = [...this.config.compliments.evening];
		}

		if (this.currentWeatherType in this.config.compliments) {
			Array.prototype.push.apply(compliments, this.config.compliments[this.currentWeatherType]);
		}
		Array.prototype.push.apply(compliments, this.config.compliments.anytime);
		for (let entry in this.config.compliments) {
			if (new RegExp(entry).test(date)) {
				Array.prototype.push.apply(compliments, this.config.compliments[entry]);
			}
		}

		return compliments;
	},
	async loadComplimentFile () {
		const isRemote = this.config.remoteFile.indexOf("http://") === 0 || this.config.remoteFile.indexOf("https://") === 0,
			url = isRemote ? this.config.remoteFile : this.file(this.config.remoteFile);
		const response = await fetch(url);
		return await response.text();
	},
	getRandomCompliment () {
		const compliments = this.complimentArray();
		let index;
		if (this.config.random) {
			
			index = this.randomIndex(compliments);
		} else {
			index = this.lastIndexUsed >= compliments.length - 1 ? 0 : ++this.lastIndexUsed;
		}

		return compliments[index] || "";
	},
	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = this.config.classes ? this.config.classes : "thin xlarge bright pre-line";
		const complimentText = this.getRandomCompliment();
		const parts = complimentText.split("\n");
		const compliment = document.createElement("span");
		for (const part of parts) {
			if (part !== "") {
				compliment.appendChild(document.createTextNode(part));
				compliment.appendChild(document.createElement("BR"));
			}
		}
		if (compliment.children.length > 0) {
			compliment.lastElementChild.remove();
			wrapper.appendChild(compliment);
		}
		return wrapper;
	},
	notificationReceived (notification, payload, sender) {
		if (notification === "CURRENTWEATHER_TYPE") {
			this.currentWeatherType = payload.type;
		}
	}
});
