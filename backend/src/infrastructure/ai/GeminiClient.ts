import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
    }

    private getModel() {
        if (!this.model) {
            const apiKey = process.env.GEMINI_API_KEY || "";
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        }
        return this.model;
    }

    async generateTagsForProblem(title: string, description: string, availableTags: string[]): Promise<string[]> {
        const prompt = `
You are an expert in competitive programming. Your task is to classify a problem into the most appropriate tags from a strict predefined list.

Problem Title: ${title}
Problem Description: ${description}

Strictly available tags:
${availableTags.join(", ")}

Return ONLY a valid JSON array of strings containing the exact tags from the list that apply to this problem. Do not include any other text, markdown formatting like \`\`\`json, or explanation.
Example output: ["arrays", "greedy"]
`;
        const maxRetries = 1;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const model = this.getModel();
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const responseText = result.response.text().trim();

                // Clean up any potential markdown formatting from the AI response
                const cleanedText = responseText.replace(/^```(json)?/, '').replace(/```$/, '').trim();

                const tags = JSON.parse(cleanedText);

                // Filter out any tags that aren't strictly in the valid list
                return tags.filter((tag: string) => availableTags.includes(tag));
            } catch (error: any) {
                if (error?.status === 429 && attempt < maxRetries) {
                    console.warn(`⚠️ Rate limit hit. Retrying attempt ${attempt + 1} after 10 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }
                console.error(`[GeminiClient] Error generating tags for problem '${title}':`, error.message || error);
                return [];
            }
        }
        return [];
    }

    async generateTagsForBulkProblems(problems: {id: string, title: string, description: string}[], availableTags: string[]): Promise<Record<string, string[]>> {
        const prompt = `
You are an expert in competitive programming. Your task is to classify a list of problems into the most appropriate tags from a strict predefined list.

Strictly available tags:
${availableTags.join(", ")}

Here are the problems (JSON format):
${JSON.stringify(problems.map(p => ({ id: p.id, title: p.title, description: p.description })))}

Return ONLY a valid JSON object mapping each problem's 'id' to an array of valid tags from the list. Do not include any markdown formatting like \`\`\`json, or any explanation.
Example output:
{
    "uuid-1": ["arrays", "greedy"],
    "uuid-2": ["dynamic programming"]
}
`;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const model = this.getModel();
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const responseText = result.response.text().trim();
                const cleanedText = responseText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
                
                const tagsMap = JSON.parse(cleanedText);
                
                // Sanitize output strictly against availableTags
                const sanitizedMap: Record<string, string[]> = {};
                for (const [id, tags] of Object.entries(tagsMap)) {
                    if (Array.isArray(tags)) {
                        sanitizedMap[id] = tags.filter((tag: any) => availableTags.includes(tag));
                    }
                }
                return sanitizedMap;
            } catch (error: any) {
                if (error?.status === 429 && attempt < maxRetries) {
                    console.warn(`⚠️ Bulk Rate limit hit. Retrying attempt ${attempt + 1} after 15 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    continue;
                }
                console.error(`[GeminiClient] Error in bulk tagging:`, error.message || error);
                return {};
            }
        }
        return {};
    }
}

export const geminiClient = new GeminiClient();
