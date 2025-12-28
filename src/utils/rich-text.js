import katex from "katex";

function escapeHtml(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function renderMarkdown(text) {
	let rendered = text.replace(/`([^`]+)`/g, "<code>$1</code>");
	rendered = rendered.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
	rendered = rendered.replace(
		/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g,
		"<em>$1</em>",
	);
	rendered = rendered.replace(/(?<!_)_(?!_)([^_]+?)_(?!_)/g, "<em>$1</em>");
	return rendered;
}

function convertLineBreaks(text) {
	// Preserve intentional line breaks in plain text sections
	return text.replace(/\n/g, "<br>");
}

export function renderRichText(value) {
	if (value === null || value === undefined) return "";
	const str = String(value);
	const parts = str.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);

	return parts
		.map((part) => {
			if (part.startsWith("$$") && part.endsWith("$$")) {
				try {
					return katex.renderToString(part.slice(2, -2), {
						trust: true,
						displayMode: true,
						throwOnError: false,
						output: "html",
					});
				} catch (e) {
					return part;
				}
			}
			if (part.startsWith("$") && part.endsWith("$")) {
				try {
					return katex.renderToString(part.slice(1, -1), {
						trust: true,
						displayMode: false,
						throwOnError: false,
						output: "html",
					});
				} catch (e) {
					return part;
				}
			}
			const escaped = escapeHtml(part);
			return convertLineBreaks(renderMarkdown(escaped));
		})
		.join("");
}
