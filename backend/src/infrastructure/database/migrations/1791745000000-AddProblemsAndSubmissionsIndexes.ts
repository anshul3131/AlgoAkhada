/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Database indexes for problems filtering (difficulty, GIN tags, title prefix) and user solved submissions
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProblemsAndSubmissionsIndexes1791745000000 implements MigrationInterface {
    name = "AddProblemsAndSubmissionsIndexes1791745000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Difficulty + CreatedAt composite index for pagination and filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_problems_difficulty_created" ON "problems" ("difficulty", "createdAt" DESC)`);

        // 2. GIN index on problem tags array for instant ANY(tags) filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_problems_tags_gin" ON "problems" USING GIN ("tags")`);

        // 3. Pattern ops index for case-insensitive title prefix searching
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_problems_title_lower" ON "problems" (lower("title") varchar_pattern_ops)`);

        // 4. Composite index covering pastSubmissions, getLastAcceptedSubmission, and isSolved
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_submissions_user_problem_status_date" ON "submissions" ("user_id", "problem_id", "status", "submittedAt" DESC)`);

        // 5. User submissions global history pagination index (getUserSubmissions)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_submissions_user_date" ON "submissions" ("user_id", "submittedAt" DESC)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_user_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_user_problem_status_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_problems_title_lower"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_problems_tags_gin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_problems_difficulty_created"`);
    }
}
