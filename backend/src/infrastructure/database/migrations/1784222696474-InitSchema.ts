import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1784222696474 implements MigrationInterface {
    name = 'InitSchema1784222696474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "language"`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_language_enum" AS ENUM('C++', 'PYTHON', 'TYPESCRIPT', 'JAVASCRIPT', 'C', 'JAVA')`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "language" "public"."submissions_language_enum" NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_status_enum" ADD VALUE 'Success'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum_old" AS ENUM('Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error', 'Runtime Error', 'Memory Limit Exceeded')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" TYPE "public"."submissions_status_enum_old" USING "status"::"text"::"public"."submissions_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_status_enum_old" RENAME TO "submissions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "language"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_language_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "language" character varying NOT NULL DEFAULT 'cpp'`);
    }

}
