import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCustomMatch1786880322612 implements MigrationInterface {
    name = 'UpdateCustomMatch1786880322612'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."custom_match_participants_status_enum" AS ENUM('JOINED', 'FORFEITED', 'FINISHED')`);
        await queryRunner.query(`CREATE TABLE "custom_match_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."custom_match_participants_status_enum" NOT NULL DEFAULT 'JOINED', "score" integer, "custom_match_id" uuid, "user_id" uuid, CONSTRAINT "PK_41c59ac8eef66897818373e4bc3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."custom_matches_status_enum" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'FINISHED', 'ABORTED')`);
        await queryRunner.query(`CREATE TABLE "custom_matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "timeLimit" integer NOT NULL, "targetAcceptances" integer NOT NULL, "topic" character varying NOT NULL, "status" "public"."custom_matches_status_enum" NOT NULL DEFAULT 'NOT_STARTED', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "host_id" uuid, "problem_id" uuid, CONSTRAINT "PK_719c994a16812cc7e3f1db86918" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."matches_status_enum" ADD VALUE 'NOT_STARTED'`);
        await queryRunner.query(`ALTER TABLE "custom_match_participants" ADD CONSTRAINT "FK_0da7bb9d51f68084f61d8b2aa5f" FOREIGN KEY ("custom_match_id") REFERENCES "custom_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_match_participants" ADD CONSTRAINT "FK_7c15a5496a94aebe677ea83e744" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD CONSTRAINT "FK_9e43b77f0d6d6b16ba80c15e301" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_matches" ADD CONSTRAINT "FK_d264c9d829f47a0d93715ed473c" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP CONSTRAINT "FK_d264c9d829f47a0d93715ed473c"`);
        await queryRunner.query(`ALTER TABLE "custom_matches" DROP CONSTRAINT "FK_9e43b77f0d6d6b16ba80c15e301"`);
        await queryRunner.query(`ALTER TABLE "custom_match_participants" DROP CONSTRAINT "FK_7c15a5496a94aebe677ea83e744"`);
        await queryRunner.query(`ALTER TABLE "custom_match_participants" DROP CONSTRAINT "FK_0da7bb9d51f68084f61d8b2aa5f"`);
        await queryRunner.query(`CREATE TYPE "public"."matches_status_enum_old" AS ENUM('IN_PROGRESS', 'FINISHED', 'ABORTED')`);
        await queryRunner.query(`ALTER TABLE "matches" ALTER COLUMN "status" TYPE "public"."matches_status_enum_old" USING "status"::"text"::"public"."matches_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."matches_status_enum_old" RENAME TO "matches_status_enum"`);
        await queryRunner.query(`DROP TABLE "custom_matches"`);
        await queryRunner.query(`DROP TYPE "public"."custom_matches_status_enum"`);
        await queryRunner.query(`DROP TABLE "custom_match_participants"`);
        await queryRunner.query(`DROP TYPE "public"."custom_match_participants_status_enum"`);
    }

}
