import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicCustomMatchesPartialIndex1791742614000 implements MigrationInterface {
    name = 'AddPublicCustomMatchesPartialIndex1791742614000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_matches_public_not_started" ON "custom_matches" ("created_at" DESC) WHERE "isPublic" = true AND "status" = 'NOT_STARTED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_custom_matches_public_not_started"`);
    }
}
