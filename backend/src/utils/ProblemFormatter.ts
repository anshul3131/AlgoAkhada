export class ProblemFormatter {
    /**
     * Formats raw scraped problem descriptions into structured HTML
     * specifically tailored for the frontend's dangerouslySetInnerHTML.
     */
    public static formatCodeforces(description: string): string {
        if (!description) return "";

        let formatted = description;

        // 1. Strip the Examples section completely to avoid redundancy with the samples array.
        // It looks for -----Examples----- and removes everything until it hits -----Note----- or the end of the string.
        formatted = formatted.replace(/-----Examples-----[^]*?(-----Note-----|$)/gi, '$1');

        // 2. Replace known Codeforces markers with styled HTML headers
        const headerClass = "text-lg font-bold text-white mt-8 mb-3";
        
        formatted = formatted.replace(/-----Input-----/gi, `\n\n<h3 class="${headerClass}">Input</h3>\n\n`);
        formatted = formatted.replace(/-----Output-----/gi, `\n\n<h3 class="${headerClass}">Output</h3>\n\n`);
        formatted = formatted.replace(/-----Note-----/gi, `\n\n<h3 class="${headerClass}">Note</h3>\n\n`);

        // 3. Render basic LaTeX-style math (subscripts and superscripts)
        // Handle explicit brackets like _{10} or ^{10}
        formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
        formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
        
        // Handle cases without brackets. Numbers can be multiple digits (like 10^18 -> 18).
        // Variables are usually single letters (like a_1k -> 1, or 2^n -> n).
        formatted = formatted.replace(/_([0-9]+|[a-zA-Z])/g, '<sub>$1</sub>');
        formatted = formatted.replace(/\^([0-9]+|[a-zA-Z])/g, '<sup>$1</sup>');

        // 4. Convert text to HTML paragraphs and line breaks
        // Normalize newlines
        formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Wrap blocks separated by double-newlines in <p> tags
        formatted = formatted
            .split(/\n\n+/)
            .filter(block => block.trim().length > 0)
            .map(block => {
                // If the block is already an HTML tag (like our headers), don't wrap it in <p>
                if (block.trim().startsWith('<h3')) {
                    return block.trim();
                }
                // Otherwise wrap in <p> and convert single newlines to <br/>
                return `<p class="mb-4">${block.trim().replace(/\n/g, '<br/>')}</p>`;
            })
            .join('\n');

        return formatted;
    }
}
