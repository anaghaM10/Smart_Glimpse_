
require("module-alias/register");

const fs = require("fs");
const path = require("path");
const envsub = require("envsub");
const Log = require("logger");

const Server = require(`${__dirname}/server`);
const Utils = require(`${__dirname}/utils`);
const defaultModules = require(`${__dirname}/../modules/default/defaultmodules`);

// Get version number.
global.version = require(`${__dirname}/../package.json`).version;
Log.log(`Starting MagicMirror: v${global.version}`);

// global absolute root path
global.root_path = path.resolve(`${__dirname}/../`);

if (process.env.MM_CONFIG_FILE) {
	global.configuration_file = process.env.MM_CONFIG_FILE.replace(`${global.root_path}/`, "");
}
if (process.env.MM_PORT) {
	global.mmPort = process.env.MM_PORT;
}

process.on("uncaughtException", function (err) {
	Log.error("Whoops! There was an uncaught exception...");
	Log.error(err);
	Log.error("MagicMirror² will not quit, but it might be a good idea to check why this happened. Maybe no internet connection?");
});

/**
 * The core app.
 * @class
 */
function App () {
	let nodeHelpers = [];
	let httpServer;

	/**
	 * Loads the config file. Combines it with the defaults and returns the config
	 * @async
	 * @returns {Promise<object>} the loaded config or the defaults if something goes wrong
	 */
	async function loadConfig () {
		Log.log("Loading config ...");
		const defaults = require(`${__dirname}/defaults`);

		// For this check proposed to TestSuite
		const configFilename = path.resolve(global.configuration_file || `${global.root_path}/config/config.js`);
		let templateFile = `${configFilename}.template`;

		// check if templateFile exists
		try {
			fs.accessSync(templateFile, fs.F_OK);
		} catch (err) {
			templateFile = null;
			Log.debug("config template file not exists, no envsubst");
		}

		if (templateFile) {
			// save current config.js
			try {
				if (fs.existsSync(configFilename)) {
					fs.copyFileSync(configFilename, `${configFilename}-old`);
				}
			} catch (err) {
				Log.warn(`Could not copy ${configFilename}: ${err.message}`);
			}

			// check if config.env exists
			const envFiles = [];
			const configEnvFile = `${configFilename.substr(0, configFilename.lastIndexOf("."))}.env`;
			try {
				if (fs.existsSync(configEnvFile)) {
					envFiles.push(configEnvFile);
				}
			} catch (err) {
				Log.debug(`${configEnvFile} does not exist. ${err.message}`);
			}

			let options = {
				all: true,
				diff: false,
				envFiles: envFiles,
				protect: false,
				syntax: "default",
				system: true
			};

			// envsubst variables in templateFile and create new config.js
			// naming for envsub must be templateFile and outputFile
			const outputFile = configFilename;
			try {
				await envsub({ templateFile, outputFile, options });
			} catch (err) {
				Log.error(`Could not envsubst variables: ${err.message}`);
			}
		}

		try {
			fs.accessSync(configFilename, fs.F_OK);
			const c = require(configFilename);
			checkDeprecatedOptions(c);
			return Object.assign(defaults, c);
		} catch (e) {
			if (e.code === "ENOENT") {
				Log.error(Utils.colors.error("WARNING! Could not find config file. Please create one. Starting with default configuration."));
			} else if (e instanceof ReferenceError || e instanceof SyntaxError) {
				Log.error(Utils.colors.error(`WARNING! Could not validate config file. Starting with default configuration. Please correct syntax errors at or above this line: ${e.stack}`));
			} else {
				Log.error(Utils.colors.error(`WARNING! Could not load config file. Starting with default configuration. Error found: ${e}`));
			}
		}

		return defaults;
	}
	function checkDeprecatedOptions (userConfig) {
		const deprecated = require(`${global.root_path}/js/deprecated`);
		const deprecatedOptions = deprecated.configs;

		const usedDeprecated = deprecatedOptions.filter((option) => userConfig.hasOwnProperty(option));
		if (usedDeprecated.length > 0) {
			Log.warn(Utils.colors.warn(`WARNING! Your config is using deprecated options: ${usedDeprecated.join(", ")}. Check README and CHANGELOG for more up-to-date ways of getting the same functionality.`));
		}
	}

	function loadModule (module) {
		const elements = module.split("/");
		const moduleName = elements[elements.length - 1];
		let moduleFolder = `${__dirname}/../modules/${module}`;

		if (defaultModules.includes(moduleName)) {
			moduleFolder = `${__dirname}/../modules/default/${module}`;
		}

		const moduleFile = `${moduleFolder}/${module}.js`;

		try {
			fs.accessSync(moduleFile, fs.R_OK);
		} catch (e) {
			Log.warn(`No ${moduleFile} found for module: ${moduleName}.`);
		}

		const helperPath = `${moduleFolder}/node_helper.js`;

		let loadHelper = true;
		try {
			fs.accessSync(helperPath, fs.R_OK);
		} catch (e) {
			loadHelper = false;
			Log.log(`No helper found for module: ${moduleName}.`);
		}

		if (loadHelper) {
			const Module = require(helperPath);
			let m = new Module();

			if (m.requiresVersion) {
				Log.log(`Check MagicMirror² version for node helper '${moduleName}' - Minimum version: ${m.requiresVersion} - Current version: ${global.version}`);
				if (cmpVersions(global.version, m.requiresVersion) >= 0) {
					Log.log("Version is ok!");
				} else {
					Log.warn(`Version is incorrect. Skip module: '${moduleName}'`);
					return;
				}
			}

			m.setName(moduleName);
			m.setPath(path.resolve(moduleFolder));
			nodeHelpers.push(m);

			m.loaded();
		}
	}

	async function loadModules (modules) {
		Log.log("Loading module helpers ...");

		for (let module of modules) {
			await loadModule(module);
		}

		Log.log("All module helpers loaded.");
	}
	function cmpVersions (a, b) {
		let i, diff;
		const regExStrip0 = /(\.0+)+$/;
		const segmentsA = a.replace(regExStrip0, "").split(".");
		const segmentsB = b.replace(regExStrip0, "").split(".");
		const l = Math.min(segmentsA.length, segmentsB.length);

		for (i = 0; i < l; i++) {
			diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10);
			if (diff) {
				return diff;
			}
		}
		return segmentsA.length - segmentsB.length;
	}

	this.start = async function () {
		config = await loadConfig();

		Log.setLogLevel(config.logLevel);

		let modules = [];
		for (const module of config.modules) {
			if (!modules.includes(module.module) && !module.disabled) {
				modules.push(module.module);
			}
		}

		await loadModules(modules);

		httpServer = new Server(config);
		const { app, io } = await httpServer.open();
		Log.log("Server started ...");

		const nodePromises = [];
		for (let nodeHelper of nodeHelpers) {
			nodeHelper.setExpressApp(app);
			nodeHelper.setSocketIO(io);

			try {
				nodePromises.push(nodeHelper.start());
			} catch (error) {
				Log.error(`Error when starting node_helper for module ${nodeHelper.name}:`);
				Log.error(error);
			}
		}

		const results = await Promise.allSettled(nodePromises);

		results.forEach((result) => {
			if (result.status === "rejected") {
				Log.error(result.reason);
			}
		});

		Log.log("Sockets connected & modules started ...");

		return config;
	};


	this.stop = async function () {
		const nodePromises = [];
		for (let nodeHelper of nodeHelpers) {
			try {
				if (typeof nodeHelper.stop === "function") {
					nodePromises.push(nodeHelper.stop());
				}
			} catch (error) {
				Log.error(`Error when stopping node_helper for module ${nodeHelper.name}:`);
				console.error(error);
			}
		}

		const results = await Promise.allSettled(nodePromises);
		results.forEach((result) => {
			if (result.status === "rejected") {
				Log.error(result.reason);
			}
		});

		Log.log("Node_helpers stopped ...");
		if (!httpServer) {
			return Promise.resolve();
		}

		return httpServer.close();
	};
	process.on("SIGINT", async () => {
		Log.log("[SIGINT] Received. Shutting down server...");
		setTimeout(() => {
			process.exit(0);
		}, 3000); // Force quit after 3 seconds
		await this.stop();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		Log.log("[SIGTERM] Received. Shutting down server...");
		setTimeout(() => {
			process.exit(0);
		}, 3000); // Force quit after 3 seconds
		await this.stop();
		process.exit(0);
	});
}

module.exports = new App();
