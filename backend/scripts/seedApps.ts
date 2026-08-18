import * as fs from "fs/promises";
import * as path from "path";
import "reflect-metadata";
import { AppDataSource } from "../src/infrastructure/database/data_source";
import { problemService } from "../src/domain/services/ProblemService";

// @ts-ignore
import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const BATCH_SIZE = 10;
const PROGRESS_FILE = path.join(__dirname, ".seed_progress");

async function addTagToEnumFile(tag: string, existingKeysCache: Set<string>) {
    const enumFilePath = path.join(__dirname, "../src/domain/enums/ProblemTag.ts");
    try {
        let content = await fs.readFile(enumFilePath, "utf-8");
        let key = tag.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        
        // TypeScript enum keys cannot start with a number
        if (/^[0-9]/.test(key)) {
            key = 'TAG_' + key;
        }
        
        if (existingKeysCache.has(key) || content.includes(`${key} =`)) {
            return;
        }
        
        const lastBraceIndex = content.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
            const before = content.substring(0, lastBraceIndex).trimEnd();
            const comma = before.endsWith(',') || before.endsWith('{') ? '' : ',';
            const newEnumEntry = `\n    ${key} = "${tag}"\n`;
            const newContent = before + comma + newEnumEntry + "}\n";
            await fs.writeFile(enumFilePath, newContent, "utf-8");
            existingKeysCache.add(key);
        }
    } catch (e: any) {
        console.error("Failed to update ProblemTag.ts", e.message);
    }
}

async function seedAppsDirectory() {
    let browser;
    try {
        console.log("🔌 Initializing database connection...");
        await AppDataSource.initialize();
        console.log("✅ Database connected.");
    } catch (error) {
        console.error("❌ Failed to connect to database:", error);
        return;
    }

    const baseDir = path.join(__dirname, "../data/APPS/test");
    console.log(`🚀 Scanning APPS directory at ${baseDir}...`);

    console.log("🕸️  Launching Puppeteer browser...");
    browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    let page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");

    try {
        const folders = await fs.readdir(baseDir);
        folders.sort();

        const enumFilePath = path.join(__dirname, "../src/domain/enums/ProblemTag.ts");
        const initialEnumContent = await fs.readFile(enumFilePath, "utf-8");
        const existingKeysCache = new Set<string>();
        const keyRegex = /\s+([A-Z0-9_]+)\s*=/g;
        let match;
        while ((match = keyRegex.exec(initialEnumContent)) !== null) {
            existingKeysCache.add(match[1]);
        }

        let dataset: any[] = [];
        let totalProcessed = 0;
        let startIndex = 0;

        // --- READ PROGRESS FILE ---
        try {
            const progressData = await fs.readFile(PROGRESS_FILE, "utf-8");
            if (progressData && !isNaN(parseInt(progressData.trim()))) {
                startIndex = parseInt(progressData.trim());
                console.log(`\n💾 Found progress file! Resuming from index: ${startIndex} (Folder: ${folders[startIndex] || 'N/A'})\n`);
            }
        } catch(e) {
            console.log("\n🆕 No progress file found. Starting from the beginning (index 0).\n");
        }

        for (let i = startIndex; i < folders.length; i++) {
            
            // Flush Chromium Memory every 50 problems
            if (i > startIndex && i % 50 === 0) {
                console.log("🧹 Flushing Chromium memory to prevent OS crash...");
                await page.close();
                page = await browser.newPage();
                await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
            }

            const folder = folders[i];
            const folderPath = path.join(baseDir, folder);
            const stat = await fs.stat(folderPath);
            if (!stat.isDirectory()) continue;

            try {
                const questionPath = path.join(folderPath, "question.txt");
                const ioPath = path.join(folderPath, "input_output.json");
                const metadataPath = path.join(folderPath, "metadata.json");

                const description = await fs.readFile(questionPath, "utf-8");
                const ioDataRaw = await fs.readFile(ioPath, "utf-8");
                const ioData = JSON.parse(ioDataRaw);
                
                let metadata: any = {};
                try {
                    const metadataRaw = await fs.readFile(metadataPath, "utf-8");
                    metadata = JSON.parse(metadataRaw);
                } catch(e) {}

                const testCases = ioData.inputs.map((inputStr: string, index: number) => ({
                    input: inputStr,
                    expectedOutput: ioData.outputs[index],
                    isHidden: index > 0
                }));

                let title = `Problem ${folder}`;
                let tags: string[] = [];
                let timeLimit = 2.0;
                let memoryLimit = 256;

                if (metadata.url && metadata.url.includes("codeforces.com")) {
                    console.log(`[${i+1}/${folders.length}] Scraping ${metadata.url}...`);
                    await page.goto(metadata.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    
                    try {
                        await page.waitForSelector('.problem-statement .header .title', { timeout: 10000 });
                        
                        const scrapedData = await page.evaluate(() => {
                            const titleEl = document.querySelector('.problem-statement .header .title');
                            const timeEl = document.querySelector('.problem-statement .header .time-limit');
                            const memoryEl = document.querySelector('.problem-statement .header .memory-limit');
                            const tagEls = document.querySelectorAll('.tag-box');
                            
                            let scrapedTitle = titleEl ? titleEl.textContent?.trim() : null;
                            let scrapedTime = timeEl ? timeEl.lastChild?.textContent?.trim() : null;
                            let scrapedMemory = memoryEl ? memoryEl.lastChild?.textContent?.trim() : null;
                            
                            if (timeEl && !scrapedTime) {
                                scrapedTime = timeEl.textContent?.replace('time limit per test', '').trim();
                            }
                            if (memoryEl && !scrapedMemory) {
                                scrapedMemory = memoryEl.textContent?.replace('memory limit per test', '').trim();
                            }
                            
                            const scrapedTags: string[] = [];
                            tagEls.forEach(el => {
                                const t = el.textContent?.trim();
                                if (t) scrapedTags.push(t);
                            });
                            
                            return { scrapedTitle, scrapedTime, scrapedMemory, scrapedTags };
                        });
                        
                        if (scrapedData.scrapedTitle) {
                            title = scrapedData.scrapedTitle.replace(/^[A-Z][0-9]*\.\s+/, '');
                        }
                        if (scrapedData.scrapedTime) {
                            const match = scrapedData.scrapedTime.match(/([0-9.]+)/);
                            if (match) timeLimit = parseFloat(match[1]);
                        }
                        if (scrapedData.scrapedMemory) {
                            const match = scrapedData.scrapedMemory.match(/(\d+)/);
                            if (match) memoryLimit = parseInt(match[1]);
                        }
                        
                        if (scrapedData.scrapedTags && scrapedData.scrapedTags.length > 0) {
                            for (const t of scrapedData.scrapedTags) {
                                const cleanTag = t.toLowerCase();
                                if (cleanTag.startsWith('*')) continue;
                                
                                tags.push(cleanTag);
                                await addTagToEnumFile(cleanTag, existingKeysCache);
                            }
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ Could not scrape ${metadata.url}: ${e.message}`);
                    }
                }

                let difficulty = "Hard";
                if (metadata.url) {
                    const urlParts = metadata.url.split('/');
                    const problemIndex = urlParts[urlParts.length - 1].toUpperCase();
                    if (problemIndex.startsWith('A')) {
                        difficulty = "Easy";
                    } else if (problemIndex.startsWith('B') || problemIndex.startsWith('C')) {
                        difficulty = "Medium";
                    } else {
                        difficulty = "Hard";
                    }
                }

                dataset.push({
                    title: title,
                    description: description,
                    testCases: testCases,
                    tags: tags,
                    timeLimit: timeLimit,
                    memoryLimit: memoryLimit,
                    difficulty: difficulty
                });

                if (dataset.length >= BATCH_SIZE) {
                    try {
                        const result = await problemService.bulkCreateProblems(dataset);
                        totalProcessed += dataset.length;
                        console.log(`✅ Batch successful! Total Added so far: ${totalProcessed} problems.`);
                        
                        // --- SAVE PROGRESS AFTER SUCCESSFUL BATCH ---
                        await fs.writeFile(PROGRESS_FILE, (i + 1).toString(), "utf-8");

                    } catch (error) {
                        console.error(`❌ Unable to upload batch`, error);
                    }
                    dataset = [];
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (err: any) {
                console.warn(`⚠️ Skipping folder ${folder} due to missing/invalid files: ${err.message}`);
            }
        }

        if (dataset.length > 0) {
            try {
                const result = await problemService.bulkCreateProblems(dataset);
                totalProcessed += dataset.length;
                console.log(`✅ Final Batch successful! Total Added: ${totalProcessed} problems.`);
                
                // Done! Clean up progress file.
                await fs.unlink(PROGRESS_FILE).catch(() => {});
            } catch (error) {
                console.error(`❌ Unable to upload final batch`, error);
            }
        }

        console.log("\n🏁 All problems processed and seeded completely!");
        await browser.close();
        process.exit(0);

    } catch (error) {
        console.error("❌ Fatal error reading directory:", error);
        if (browser) await browser.close();
        process.exit(1);
    }
}

seedAppsDirectory();
