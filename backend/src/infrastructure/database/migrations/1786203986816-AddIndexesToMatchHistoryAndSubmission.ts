import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesToMatchHistoryAndSubmission1786203986816 implements MigrationInterface {
    name = 'AddIndexesToMatchHistoryAndSubmission1786203986816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "index_submission_status" ON "submissions"  ("status") `);
        await queryRunner.query(`CREATE INDEX "index_match_histories_match_user_submission" ON "match_histories"  ("match_id", "user_id", "submission_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."index_match_histories_match_user_submission"`);
        await queryRunner.query(`DROP INDEX "public"."index_submission_status"`);
    }

}
