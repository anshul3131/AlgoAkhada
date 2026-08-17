import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomMatchUpdate1786905411534 implements MigrationInterface {
    name = 'CustomMatchUpdate1786905411534'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" RENAME COLUMN "targetAcceptances" TO "maxParticipants"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" RENAME COLUMN "maxParticipants" TO "targetAcceptances"`);
    }

}
