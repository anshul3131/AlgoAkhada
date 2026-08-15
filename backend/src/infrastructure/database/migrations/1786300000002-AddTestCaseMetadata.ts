import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTestCaseMetadata1786300000002 implements MigrationInterface {
    name = 'AddTestCaseMetadata1786300000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "name" character varying`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "explanation" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "explanation"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "name"`);
    }
}
