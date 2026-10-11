import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1790674052333 implements MigrationInterface {
    name = 'InitSchema1790674052333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD COLUMN IF NOT EXISTS "name" character varying NOT NULL DEFAULT 'Custom Match'`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD COLUMN IF NOT EXISTS "difficulty" character varying NOT NULL DEFAULT 'Medium'`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "max_elo_rating" integer NOT NULL DEFAULT 1200`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "max_elo_rating"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN IF EXISTS "isPublic"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN IF EXISTS "difficulty"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN IF EXISTS "name"`);
    }

}
