
const CalendarUtils = {


	capFirst (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},


	getLocaleSpecification (timeFormat) {
		switch (timeFormat) {
			case 12: {
				return { longDateFormat: { LT: "h:mm A" } };
			}
			case 24: {
				return { longDateFormat: { LT: "HH:mm" } };
			}
			default: {
				return { longDateFormat: { LT: moment.localeData().longDateFormat("LT") } };
			}
		}
	},


	shorten (string, maxLength, wrapEvents, maxTitleLines) {
		if (typeof string !== "string") {
			return "";
		}

		if (wrapEvents === true) {
			const words = string.split(" ");
			let temp = "";
			let currentLine = "";
			let line = 0;

			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) {

					currentLine += `${word} `;
				} else {
					line++;
					if (line > maxTitleLines - 1) {
						if (i < words.length) {
							currentLine += "…";
						}
						break;
					}

					if (currentLine.length > 0) {
						temp += `${currentLine}<br>${word} `;
					} else {
						temp += `${word}<br>`;
					}
					currentLine = "";
				}
			}

			return (temp + currentLine).trim();
		} else {
			if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
				return `${string.trim().slice(0, maxLength)}…`;
			} else {
				return string.trim();
			}
		}
	},


	titleTransform (title, titleReplace) {
		let transformedTitle = title;
		for (let tr in titleReplace) {
			let transform = titleReplace[tr];
			if (typeof transform === "object") {
				if (typeof transform.search !== "undefined" && transform.search !== "" && typeof transform.replace !== "undefined") {
					let regParts = transform.search.match(/^\/(.+)\/([gim]*)$/);
					let needle = new RegExp(transform.search, "g");
					if (regParts) {

						needle = new RegExp(regParts[1], regParts[2]);
					}

					let replacement = transform.replace;
					if (typeof transform.yearmatchgroup !== "undefined" && transform.yearmatchgroup !== "") {
						const yearmatch = [...title.matchAll(needle)];
						if (yearmatch[0].length >= transform.yearmatchgroup + 1 && yearmatch[0][transform.yearmatchgroup] * 1 >= 1900) {
							let calcage = new Date().getFullYear() - yearmatch[0][transform.yearmatchgroup] * 1;
							let searchstr = `$${transform.yearmatchgroup}`;
							replacement = replacement.replace(searchstr, calcage);
						}
					}
					transformedTitle = transformedTitle.replace(needle, replacement);
				}
			}
		}
		return transformedTitle;
	}
};

if (typeof module !== "undefined") {
	module.exports = CalendarUtils;
}
