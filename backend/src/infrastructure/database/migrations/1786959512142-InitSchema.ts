import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1786959512142 implements MigrationInterface {
    name = 'InitSchema1786959512142'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD "joinCode" character varying(6) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD CONSTRAINT "UQ_4b2e9027977cba39be1b3a24483" UNIQUE ("joinCode")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP CONSTRAINT "UQ_4b2e9027977cba39be1b3a24483"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN "joinCode"`);
    }

}
