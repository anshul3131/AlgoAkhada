import * as fs from "fs/promises";
import * as path from "path";

const API_URL = "http://localhost:3000/api/problems/bulk";
const BATCH_SIZE = 5; // Process 5 problems per transaction

async function seedAppsDirectory() {
    // Point this to your APPS/test directory
    const baseDir = path.join(__dirname, "../data/APPS/test");
    console.log(`🚀 Scanning APPS directory at ${baseDir}...`);

    try {
        // Read all folder names (0000 to 4999)
        const folders = await fs.readdir(baseDir);
        const dataset = [];

        // Sort folders so they import sequentially
        folders.sort();

        for (const folder of folders) {
            const folderPath = path.join(baseDir, folder);

            // Skip system files like .DS_Store
            const stat = await fs.stat(folderPath);
            if (!stat.isDirectory()) continue;

            try {
                const questionPath = path.join(folderPath, "question.txt");
                const ioPath = path.join(folderPath, "input_output.json");

                // 1. Read the Problem Description
                const description = await fs.readFile(questionPath, "utf-8");

                // 2. Read and Parse the Test Cases
                const ioDataRaw = await fs.readFile(ioPath, "utf-8");
                const ioData = JSON.parse(ioDataRaw);

                // Map the parallel inputs and outputs arrays into our TestCase schema
                const testCases = ioData.inputs.map((inputStr: string, index: number) => ({
                    input: inputStr,
                    expectedOutput: ioData.outputs[index],
                    // We make the very first test case public for the UI, and hide the rest
                    isHidden: index > 0
                }));

                // 3. Construct the Problem Object
                dataset.push({
                    title: `Problem ${folder}`,
                    description: description,
                    testCases: testCases
                });

            } catch (err: any) {
                console.warn(`⚠️ Skipping folder ${folder} due to missing/invalid files: ${err.message}`);
            }
        }

        console.log(`📊 Successfully parsed ${dataset.length} problems. Batching by ${BATCH_SIZE}...`);

        // 4. Send to the Bulk API in chunks
        for (let i = 0; i < dataset.length; i += BATCH_SIZE) {
            const batch = dataset.slice(i, i + BATCH_SIZE);
            console.log(`\n📤 Sending batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} problems)...`);
            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dataset: batch})
                });

                const result = await response.json();

                if (!response.ok) {
                    console.error(`❌ Batch failed:`, result);
                    continue;
                }

                console.log(`✅ Batch successful! Added ${result?.data?.stats?.problemsAdded} problems and ${result?.data?.stats?.testCasesAdded} test cases.`);

                // Add a 500ms delay to prevent overwhelming the local Postgres connection pool
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Unable to upload Batch:${Math.floor(i / BATCH_SIZE) + 1} `, error);
            }
        }

        console.log("\n🏁 All batches processed and seeded completely!");

    } catch (error) {
        console.error("❌ Fatal error reading directory:", error);
    }
}

seedAppsDirectory();