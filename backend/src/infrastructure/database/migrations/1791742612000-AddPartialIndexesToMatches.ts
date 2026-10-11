import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartialIndexesToMatches1791742612000 implements MigrationInterface {
    name = 'AddPartialIndexesToMatches1791742612000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_matches_user1_finished" ON "matches" ("user1_id", "created_at" DESC) WHERE "status" = 'FINISHED'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_matches_user2_finished" ON "matches" ("user2_id", "created_at" DESC) WHERE "status" = 'FINISHED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_matches_user2_finished"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_matches_user1_finished"`);
    }
}
