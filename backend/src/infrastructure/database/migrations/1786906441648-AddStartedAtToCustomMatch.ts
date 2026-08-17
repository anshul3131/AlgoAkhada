import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStartedAtToCustomMatch1786906441648 implements MigrationInterface {
    name = 'AddStartedAtToCustomMatch1786906441648'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD "startedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP COLUMN "startedAt"`);
    }

}
