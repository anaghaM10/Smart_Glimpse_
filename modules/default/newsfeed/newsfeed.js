Module.register("newsfeed", {
	defaults: {
		feeds: [
			{
				title: "Times of India",
				url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
				encoding: "UTF-8" //ISO-8859-1
			}
		],
		showAsList: false,
		showSourceTitle: true,
		showPublishDate: true,
		broadcastNewsFeeds: true,
		broadcastNewsUpdates: true,
		showDescription: false,
		showTitleAsUrl: false,
		lengthDescription: 400,
		hideLoading: false,
		reloadInterval: 5 * 60 * 1000, // every 5 minutes
		updateInterval: 10 * 1000,
		animationSpeed: 2.5 * 1000,
		maxNewsItems: 0, // 0 for unlimited
		ignoreOldItems: false,
		ignoreOlderThan: 24 * 60 * 60 * 1000, // 1 day
		removeStartTags: "",
		removeEndTags: "", 
		startTags: [],
		endTags: [],
		prohibitedWords: [],
		scrollLength: 500,
	},

	getUrlPrefix (item) {
		if (item.useCorsProxy) {
			return `${location.protocol}//${location.host}/cors?url=`;
		} else {
			return "";
		}
	},
	getScripts () {
		return ["moment.js"];
	},
	getStyles () {
		return ["newsfeed.css"];
	},
	getTranslations () {
		return false;
	},
	start () {
		Log.info(`Starting module: ${this.name}`);
		moment.locale(config.language);

		this.newsItems = [];
		this.loaded = false;
		this.error = null;
		this.activeItem = 0;
		this.scrollPosition = 0;

		this.registerFeeds();

		this.isShowingDescription = this.config.showDescription;
	},
	socketNotificationReceived (notification, payload) {
		if (notification === "NEWS_ITEMS") {
			this.generateFeed(payload);

			if (!this.loaded) {
				if (this.config.hideLoading) {
					this.show();
				}
				this.scheduleUpdateInterval();
			}

			this.loaded = true;
			this.error = null;
		} else if (notification === "NEWSFEED_ERROR") {
			this.error = this.translate(payload.error_type);
			this.scheduleUpdateInterval();
		}
	},
	getTemplate () {
		if (this.config.feedUrl) {
			return "oldconfig.njk";
		} else if (this.config.showFullArticle) {
			return "fullarticle.njk";
		}
		return "newsfeed.njk";
	},
	getTemplateData () {
		if (this.config.showFullArticle) {
			return {
				url: this.getActiveItemURL()
			};
		}
		if (this.error) {
			return {
				error: this.error
			};
		}
		if (this.newsItems.length === 0) {
			return {
				empty: true
			};
		}
		if (this.activeItem >= this.newsItems.length) {
			this.activeItem = 0;
		}

		const item = this.newsItems[this.activeItem];
		const items = this.newsItems.map(function (item) {
			item.publishDate = moment(new Date(item.pubdate)).fromNow();
			return item;
		});

		return {
			loaded: true,
			config: this.config,
			sourceTitle: item.sourceTitle,
			publishDate: moment(new Date(item.pubdate)).fromNow(),
			title: item.title,
			url: this.getUrlPrefix(item) + item.url,
			description: item.description,
			items: items
		};
	},

	getActiveItemURL () {
		const item = this.newsItems[this.activeItem];
		if (item) {
			return typeof item.url === "string" ? this.getUrlPrefix(item) + item.url : this.getUrlPrefix(item) + item.url.href;
		} else {
			return "";
		}
	},

	registerFeeds () {
		for (let feed of this.config.feeds) {
			this.sendSocketNotification("ADD_FEED", {
				feed: feed,
				config: this.config
			});
		}
	},

	generateFeed (feeds) {
		let newsItems = [];
		for (let feed in feeds) {
			const feedItems = feeds[feed];
			if (this.subscribedToFeed(feed)) {
				for (let item of feedItems) {
					item.sourceTitle = this.titleForFeed(feed);
					if (!(this.config.ignoreOldItems && Date.now() - new Date(item.pubdate) > this.config.ignoreOlderThan)) {
						newsItems.push(item);
					}
				}
			}
		}
		newsItems.sort(function (a, b) {
			const dateA = new Date(a.pubdate);
			const dateB = new Date(b.pubdate);
			return dateB - dateA;
		});

		if (this.config.maxNewsItems > 0) {
			newsItems = newsItems.slice(0, this.config.maxNewsItems);
		}

		if (this.config.prohibitedWords.length > 0) {
			newsItems = newsItems.filter(function (item) {
				for (let word of this.config.prohibitedWords) {
					if (item.title.toLowerCase().indexOf(word.toLowerCase()) > -1) {
						return false;
					}
				}
				return true;
			}, this);
		}
		newsItems.forEach((item) => {
			if (this.config.removeStartTags === "title" || this.config.removeStartTags === "both") {
				for (let startTag of this.config.startTags) {
					if (item.title.slice(0, startTag.length) === startTag) {
						item.title = item.title.slice(startTag.length, item.title.length);
					}
				}
			}

			if (this.config.removeStartTags === "description" || this.config.removeStartTags === "both") {
				if (this.isShowingDescription) {
					for (let startTag of this.config.startTags) {
						if (item.description.slice(0, startTag.length) === startTag) {
							item.description = item.description.slice(startTag.length, item.description.length);
						}
					}
				}
			}

			if (this.config.removeEndTags) {
				for (let endTag of this.config.endTags) {
					if (item.title.slice(-endTag.length) === endTag) {
						item.title = item.title.slice(0, -endTag.length);
					}
				}

				if (this.isShowingDescription) {
					for (let endTag of this.config.endTags) {
						if (item.description.slice(-endTag.length) === endTag) {
							item.description = item.description.slice(0, -endTag.length);
						}
					}
				}
			}
		});

		const updatedItems = [];
		newsItems.forEach((value) => {
			if (this.newsItems.findIndex((value1) => value1 === value) === -1) {
				// Add item to updated items list
				updatedItems.push(value);
			}
		});

		if (this.config.broadcastNewsUpdates && updatedItems.length > 0) {
			this.sendNotification("NEWS_FEED_UPDATE", { items: updatedItems });
		}

		this.newsItems = newsItems;
	},

	subscribedToFeed (feedUrl) {
		for (let feed of this.config.feeds) {
			if (feed.url === feedUrl) {
				return true;
			}
		}
		return false;
	},

	titleForFeed (feedUrl) {
		for (let feed of this.config.feeds) {
			if (feed.url === feedUrl) {
				return feed.title || "";
			}
		}
		return "";
	},

	scheduleUpdateInterval () {
		this.updateDom(this.config.animationSpeed);

		// Broadcast NewsFeed if needed
		if (this.config.broadcastNewsFeeds) {
			this.sendNotification("NEWS_FEED", { items: this.newsItems });
		}

		if (this.timer) clearInterval(this.timer);

		this.timer = setInterval(() => {
			this.activeItem++;
			this.updateDom(this.config.animationSpeed);

			if (this.config.broadcastNewsFeeds) {
				this.sendNotification("NEWS_FEED", { items: this.newsItems });
			}
		}, this.config.updateInterval);
	},

	resetDescrOrFullArticleAndTimer () {
		this.isShowingDescription = this.config.showDescription;
		this.config.showFullArticle = false;
		this.scrollPosition = 0;
		document.getElementsByClassName("region bottom bar")[0].classList.remove("newsfeed-fullarticle");
		if (!this.timer) {
			this.scheduleUpdateInterval();
		}
	},

	notificationReceived (notification, payload, sender) {
		const before = this.activeItem;
		if (notification === "MODULE_DOM_CREATED" && this.config.hideLoading) {
			this.hide();
		} else if (notification === "ARTICLE_NEXT") {
			this.activeItem++;
			if (this.activeItem >= this.newsItems.length) {
				this.activeItem = 0;
			}
			this.resetDescrOrFullArticleAndTimer();
			Log.debug(`${this.name} - going from article #${before} to #${this.activeItem} (of ${this.newsItems.length})`);
			this.updateDom(100);
		} else if (notification === "ARTICLE_PREVIOUS") {
			this.activeItem--;
			if (this.activeItem < 0) {
				this.activeItem = this.newsItems.length - 1;
			}
			this.resetDescrOrFullArticleAndTimer();
			Log.debug(`${this.name} - going from article #${before} to #${this.activeItem} (of ${this.newsItems.length})`);
			this.updateDom(100);
		}
		else if (notification === "ARTICLE_MORE_DETAILS") {
			if (this.config.showFullArticle === true) {
				this.scrollPosition += this.config.scrollLength;
				window.scrollTo(0, this.scrollPosition);
				Log.debug(`${this.name} - scrolling down`);
				Log.debug(`${this.name} - ARTICLE_MORE_DETAILS, scroll position: ${this.config.scrollLength}`);
			} else {
				this.showFullArticle();
			}
		} else if (notification === "ARTICLE_SCROLL_UP") {
			if (this.config.showFullArticle === true) {
				this.scrollPosition -= this.config.scrollLength;
				window.scrollTo(0, this.scrollPosition);
				Log.debug(`${this.name} - scrolling up`);
				Log.debug(`${this.name} - ARTICLE_SCROLL_UP, scroll position: ${this.config.scrollLength}`);
			}
		} else if (notification === "ARTICLE_LESS_DETAILS") {
			this.resetDescrOrFullArticleAndTimer();
			Log.debug(`${this.name} - showing only article titles again`);
			this.updateDom(100);
		} else if (notification === "ARTICLE_TOGGLE_FULL") {
			if (this.config.showFullArticle) {
				this.activeItem++;
				this.resetDescrOrFullArticleAndTimer();
			} else {
				this.showFullArticle();
			}
		} else if (notification === "ARTICLE_INFO_REQUEST") {
			this.sendNotification("ARTICLE_INFO_RESPONSE", {
				title: this.newsItems[this.activeItem].title,
				source: this.newsItems[this.activeItem].sourceTitle,
				date: this.newsItems[this.activeItem].pubdate,
				desc: this.newsItems[this.activeItem].description,
				url: this.getActiveItemURL()
			});
		}
	},

	showFullArticle () {
		this.isShowingDescription = !this.isShowingDescription;
		this.config.showFullArticle = !this.isShowingDescription;
		
		if (this.config.showFullArticle === true) {
			document.getElementsByClassName("region bottom bar")[0].classList.add("newsfeed-fullarticle");
		}
		clearInterval(this.timer);
		this.timer = null;
		Log.debug(`${this.name} - showing ${this.isShowingDescription ? "article description" : "full article"}`);
		this.updateDom(100);
	}
});