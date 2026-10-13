import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLiveMatchesPartialIndex1791742613000 implements MigrationInterface {
    name = 'AddLiveMatchesPartialIndex1791742613000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_matches_inprogress_created_at" ON "matches" ("created_at" DESC) WHERE "status" = 'IN_PROGRESS'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_matches_inprogress_created_at"`);
    }
}
