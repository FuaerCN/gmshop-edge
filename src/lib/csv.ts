const spreadsheetFormulaPrefix = /^[=+\-@]/;
const spreadsheetControlPrefix = /^[\t\r\n]/;

export function csvCell(value: string) {
	const trimmedStart = value.trimStart();
	const safeValue =
		spreadsheetControlPrefix.test(value) ||
		spreadsheetFormulaPrefix.test(trimmedStart)
			? `'${value}`
			: value;
	return `"${safeValue.replaceAll('"', '""')}"`;
}
