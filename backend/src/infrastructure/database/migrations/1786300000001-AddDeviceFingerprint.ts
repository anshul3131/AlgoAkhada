import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeviceFingerprint1786300000001 implements MigrationInterface {
    name = 'AddDeviceFingerprint1786300000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "last_login_ip" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_login_device" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_device"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_ip"`);
    }
}
