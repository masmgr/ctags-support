import split = require("split");
import EventEmitter = require("events");

function find(stream, reg) {
	const e = new EventEmitter();
	const regExp = new RegExp(reg);
	let lineNumber = 0;
	let found = 0;
	stream
		.pipe(split())
		.on("data", (line) => {
			lineNumber += 1;
			const foundItems = regExp.exec(line);
			if (foundItems && foundItems.length > 0 && foundItems[0] !== "") {
				const item = foundItems[0]; //Only use the first found
				e.emit("found", item, lineNumber);
				found += 1;
			}
		})
		.on("end", () => {
			e.emit("end", found);
		})
		.on("error", (error) => {
			e.emit("error", error);
		});
	return e;
}
export { find };
