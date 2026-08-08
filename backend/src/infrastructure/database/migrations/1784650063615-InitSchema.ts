import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1784650063615 implements MigrationInterface {
    name = 'InitSchema1784650063615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."matches_status_enum" AS ENUM('IN_PROGRESS', 'FINISHED', 'ABORTED')`);
        await queryRunner.query(`CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."matches_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user1_id" uuid, "user2_id" uuid, "problem_id" uuid, CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_c9e62024af84ca48e2b7b8a4e16" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_a345a7adb5eb2df399142403661" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_1d672aa10477597c8e9a7a6ba1e" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_1d672aa10477597c8e9a7a6ba1e"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_a345a7adb5eb2df399142403661"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_c9e62024af84ca48e2b7b8a4e16"`);
        await queryRunner.query(`DROP TABLE "matches"`);
        await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
    }

}
