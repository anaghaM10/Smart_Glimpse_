"use strict";
(function () {
	const config = {};
	function getServerAddress () {
		function getCommandLineParameter (key, defaultValue = undefined) {
			const index = process.argv.indexOf(`--${key}`);
			const value = index > -1 ? process.argv[index + 1] : undefined;
			return value !== undefined ? String(value) : defaultValue;
		}
		["address", "port"].forEach((key) => {
			config[key] = getCommandLineParameter(key, process.env[key.toUpperCase()]);
		});
		config["tls"] = process.argv.indexOf("--use-tls") > 0;
	}

	function getServerConfig (url) {
		return new Promise((resolve, reject) => {
			const lib = url.startsWith("https") ? require("https") : require("http");
			const request = lib.get(url, (response) => {
				let configData = "";
				response.on("data", function (chunk) {
					configData += chunk;
				});
				response.on("end", function () {
					resolve(JSON.parse(configData));
				});
			});

			request.on("error", function (error) {
				reject(new Error(`Unable to read config from server (${url} (${error.message}`));
			});
		});
	}
	function fail (message, code = 1) {
		if (message !== undefined && typeof message === "string") {
			console.log(message);
		} else {
			console.log("Usage: 'node clientonly --address 192.168.1.10 --port 8080 [--use-tls]'");
		}
		process.exit(code);
	}

	getServerAddress();

	(config.address && config.port) || fail();
	const prefix = config.tls ? "https://" : "http://";
	if (["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1", undefined].indexOf(config.address) === -1) {
		getServerConfig(`${prefix}${config.address}:${config.port}/config/`)
			.then(function (configReturn) {
				const env = Object.create(process.env);
				env.clientonly = true; 
				const options = { env: env };
				configReturn.address = config.address;
				configReturn.port = config.port;
				configReturn.tls = config.tls;
				env.config = JSON.stringify(configReturn);
				const electron = require("electron");
				const child = require("child_process").spawn(electron, ["js/electron.js"], options);
				child.stdout.on("data", function (buf) {
					process.stdout.write(`Client: ${buf}`);
				});
				child.stderr.on("data", function (buf) {
					process.stderr.write(`Client: ${buf}`);
				});

				child.on("error", function (err) {
					process.stdout.write(`Client: ${err}`);
				});

				child.on("close", (code) => {
					if (code !== 0) {
						console.log(`There something wrong. The clientonly is not running code ${code}`);
					}
				});
			})
			.catch(function (reason) {
				fail(`Unable to connect to server: (${reason})`);
			});
	} else {
		fail();
	}
}());
