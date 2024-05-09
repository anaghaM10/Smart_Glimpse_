async function performWebRequest (url, type = "json", useCorsProxy = false, requestHeaders = undefined, expectedResponseHeaders = undefined) {
	const request = {};
	let requestUrl;
	if (useCorsProxy) {
		requestUrl = getCorsUrl(url, requestHeaders, expectedResponseHeaders);
	} else {
		requestUrl = url;
		request.headers = getHeadersToSend(requestHeaders);
	}
	const response = await fetch(requestUrl, request);
	const data = await response.text();

	if (type === "xml") {
		return new DOMParser().parseFromString(data, "text/html");
	} else {
		if (!data || !data.length > 0) return undefined;

		const dataResponse = JSON.parse(data);
		if (!dataResponse.headers) {
			dataResponse.headers = getHeadersFromResponse(expectedResponseHeaders, response);
		}
		return dataResponse;
	}
}
const getCorsUrl = function (url, requestHeaders, expectedResponseHeaders) {
	if (!url || url.length < 1) {
		throw new Error(`Invalid URL: ${url}`);
	} else {
		let corsUrl = `${location.protocol}//${location.host}/cors?`;

		const requestHeaderString = getRequestHeaderString(requestHeaders);
		if (requestHeaderString) corsUrl = `${corsUrl}sendheaders=${requestHeaderString}`;

		const expectedResponseHeadersString = getExpectedResponseHeadersString(expectedResponseHeaders);
		if (requestHeaderString && expectedResponseHeadersString) {
			corsUrl = `${corsUrl}&expectedheaders=${expectedResponseHeadersString}`;
		} else if (expectedResponseHeadersString) {
			corsUrl = `${corsUrl}expectedheaders=${expectedResponseHeadersString}`;
		}

		if (requestHeaderString || expectedResponseHeadersString) {
			return `${corsUrl}&url=${url}`;
		}
		return `${corsUrl}url=${url}`;
	}
};
const getRequestHeaderString = function (requestHeaders) {
	let requestHeaderString = "";
	if (requestHeaders) {
		for (const header of requestHeaders) {
			if (requestHeaderString.length === 0) {
				requestHeaderString = `${header.name}:${encodeURIComponent(header.value)}`;
			} else {
				requestHeaderString = `${requestHeaderString},${header.name}:${encodeURIComponent(header.value)}`;
			}
		}
		return requestHeaderString;
	}
	return undefined;
};
const getHeadersToSend = (requestHeaders) => {
	const headersToSend = {};
	if (requestHeaders) {
		for (const header of requestHeaders) {
			headersToSend[header.name] = header.value;
		}
	}

	return headersToSend;
};
const getExpectedResponseHeadersString = function (expectedResponseHeaders) {
	let expectedResponseHeadersString = "";
	if (expectedResponseHeaders) {
		for (const header of expectedResponseHeaders) {
			if (expectedResponseHeadersString.length === 0) {
				expectedResponseHeadersString = `${header}`;
			} else {
				expectedResponseHeadersString = `${expectedResponseHeadersString},${header}`;
			}
		}
		return expectedResponseHeaders;
	}
	return undefined;
};
const getHeadersFromResponse = (expectedResponseHeaders, response) => {
	const responseHeaders = [];

	if (expectedResponseHeaders) {
		for (const header of expectedResponseHeaders) {
			const headerValue = response.headers.get(header);
			responseHeaders.push({ name: header, value: headerValue });
		}
	}

	return responseHeaders;
};
const formatTime = (config, time) => {
	let date = moment(time);

	if (config.timezone) {
		date = date.tz(config.timezone);
	}

	if (config.timeFormat !== 24) {
		if (config.showPeriod) {
			if (config.showPeriodUpper) {
				return date.format("h:mm A");
			} else {
				return date.format("h:mm a");
			}
		} else {
			return date.format("h:mm");
		}
	}

	return date.format("HH:mm");
};

if (typeof module !== "undefined") module.exports = {
	performWebRequest,
	formatTime
};
