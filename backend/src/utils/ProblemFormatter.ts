export class ProblemFormatter {
    /**
     * Formats raw scraped problem descriptions into structured HTML
     * specifically tailored for the frontend's dangerouslySetInnerHTML.
     */
    public static formatCodeforces(description: string): string {
        if (!description) return "";

        let formatted = description;

        // 0. Escape HTML tags to prevent broken rendering of < and > in math (e.g., 1 < k < 10)
        formatted = formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 1. Strip the Examples section completely to avoid redundancy with the samples array.
        // It looks for -----Examples----- and removes everything until it hits -----Note----- or the end of the string.
        formatted = formatted.replace(/-----Examples-----[^]*?(-----Note-----|$)/gi, '$1');

        // 2. Replace known Codeforces markers with styled HTML headers
        const headerClass = "text-lg font-bold text-white mt-8 mb-3";
        
        formatted = formatted.replace(/-----Input-----/gi, `\n\n<h3 class="${headerClass}">Input</h3>\n\n`);
        formatted = formatted.replace(/-----Output-----/gi, `\n\n<h3 class="${headerClass}">Output</h3>\n\n`);
        formatted = formatted.replace(/-----Note-----/gi, `\n\n<h3 class="${headerClass}">Note</h3>\n\n`);

        // 3. Render common LaTeX symbols (Order matters! Replace longer macros first)
        formatted = formatted.replace(/\\leq/g, '≤');
        formatted = formatted.replace(/\\geq/g, '≥');
        formatted = formatted.replace(/\\le/g, '≤');
        formatted = formatted.replace(/\\ge/g, '≥');
        formatted = formatted.replace(/\\ne/g, '≠');
        formatted = formatted.replace(/\\neq/g, '≠');
        formatted = formatted.replace(/\\cdot/g, '·');
        formatted = formatted.replace(/\\times/g, '×');
        formatted = formatted.replace(/\\dots/g, '...');
        formatted = formatted.replace(/\\ldots/g, '...');
        formatted = formatted.replace(/\\infty/g, '∞');
        formatted = formatted.replace(/\\equiv/g, '≡');
        formatted = formatted.replace(/\\approx/g, '≈');
        formatted = formatted.replace(/\\quad/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
        formatted = formatted.replace(/\\textrm\{mod\}\\;/g, 'mod ');
        formatted = formatted.replace(/\\pmod/g, 'mod');
        formatted = formatted.replace(/\\pmod\{([^}]+)\}/g, '(mod $1)');

        // 4. Render basic LaTeX-style math (subscripts and superscripts)
        // Tailwind resets <sub> and <sup>, so we MUST apply styles to them to actually look like math!
        const subStyle = 'vertical-align: sub; font-size: 0.7em; line-height: 0;';
        const supStyle = 'vertical-align: super; font-size: 0.7em; line-height: 0;';
        
        // Handle explicit brackets like _{10} or ^{10}
        formatted = formatted.replace(/_\{([^}]+)\}/g, `<sub style="${subStyle}">$1</sub>`);
        formatted = formatted.replace(/\^\{([^}]+)\}/g, `<sup style="${supStyle}">$1</sup>`);
        
        // Handle cases without brackets. Numbers can be multiple digits (like 10^18 -> 18).
        // Variables are usually single letters (like a_1k -> 1, or 2^n -> n).
        formatted = formatted.replace(/_([0-9]+|[a-zA-Z])/g, `<sub style="${subStyle}">$1</sub>`);
        formatted = formatted.replace(/\^([0-9]+|[a-zA-Z])/g, `<sup style="${supStyle}">$1</sup>`);

        // 5. Clean up $ tags and wrap math text to make it stand out
        // The user specifically requested white color instead of green/gray
        formatted = formatted.replace(/\$\$(.*?)\$\$/g, '<span class="font-mono text-white">$1</span>');
        formatted = formatted.replace(/\$(.*?)\$/g, '<span class="font-mono text-white">$1</span>');

        // 6. Convert text to HTML paragraphs and line breaks
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
                return `<p class="mb-4 text-white leading-relaxed">${block.trim().replace(/\n/g, '<br/>')}</p>`;
            })
            .join('\n');

        return formatted;
    }
}
