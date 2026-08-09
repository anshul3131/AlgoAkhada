import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import "reflect-metadata";
import { AppDataSource } from "../src/infrastructure/database/data_source";
import { Problem } from "../src/domain/entities/Problem";
import { ProblemTag } from "../src/domain/enums/ProblemTag";
import { geminiClient } from "../src/infrastructure/ai/GeminiClient";


if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY is not set in the .env file!");
    console.error("Please add GEMINI_API_KEY=your_api_key_here to backend/.env");
    process.exit(1);
}

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 10000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function tagProblems() {
    try {
        console.log("Initializing database connection...");
        await AppDataSource.initialize();
        console.log("Database connected.");

        const problemRepository = AppDataSource.getRepository(Problem);
        const allAvailableTags = Object.values(ProblemTag);
        
        // Fetch problems that have no tags yet
        const problemsToTag = await problemRepository.createQueryBuilder("problem")
             .where("cardinality(problem.tags) = 0 OR problem.tags IS NULL")
             .getMany();

        console.log(`Found ${problemsToTag.length} problems to tag.`);

        for (let i = 0; i < problemsToTag.length; i += BATCH_SIZE) {
            const batch = problemsToTag.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(problemsToTag.length / BATCH_SIZE)} (${batch.length} problems)...`);

            // Map down to necessary fields to save tokens
            const batchPayload = batch.map(p => ({
                id: p.id,
                title: p.title,
                // Truncate description slightly if incredibly long to be extra safe on tokens
                description: p.description.length > 3000 ? p.description.substring(0, 3000) + '...' : p.description
            }));

            // Bulk call Gemini
            const tagsMap = await geminiClient.generateTagsForBulkProblems(batchPayload, allAvailableTags);

            if (Object.keys(tagsMap).length > 0) {
                // Prepare DB updates
                for (const problem of batch) {
                    const assignedTags = tagsMap[problem.id];
                    if (assignedTags && assignedTags.length > 0) {
                        problem.tags = assignedTags as ProblemTag[];
                        console.log(`  -> Tagged '${problem.title}' with: ${assignedTags.join(", ")}`);
                    } else {
                        console.log(`  -> No tags assigned for '${problem.title}'`);
                    }
                }
                // Save the whole batch in one DB query!
                await problemRepository.save(batch);
            } else {
                console.log("  -> Batch returned empty or failed.");
            }

            if (i + BATCH_SIZE < problemsToTag.length) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
                await delay(DELAY_BETWEEN_BATCHES_MS);
            }
        }

        console.log("Tagging complete!");
        process.exit(0);
    } catch (error) {
        console.error("Error during tagging process:", error);
        process.exit(1);
    }
}

tagProblems();
