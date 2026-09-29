import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1790674052333 implements MigrationInterface {
    name = 'InitSchema1790674052333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD "name" character varying NOT NULL DEFAULT 'Custom Match'`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD "difficulty" character varying NOT NULL DEFAULT 'Medium'`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD "isPublic" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "max_elo_rating" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "max_elo_rating" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN "isPublic"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN "difficulty"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN "name"`);
    }

}
