import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1783860640604 implements MigrationInterface {
    name = 'InitSchema1783860640604'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "input_data" text NOT NULL, "expected_output" text NOT NULL, "is_hidden" boolean NOT NULL DEFAULT false, "problem_id" uuid, CONSTRAINT "PK_39eb2dc90c54d7a036b015f05c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "problems" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text NOT NULL, "time_limit_ms" integer NOT NULL DEFAULT '2000', "memory_limit_kb" integer NOT NULL DEFAULT '256000', CONSTRAINT "UQ_22348d871ecdb71ce590afcedda" UNIQUE ("title"), CONSTRAINT "PK_b3994afba6ab64a42cda1ccaeff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum" AS ENUM('PENDING', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR')`);
        await queryRunner.query(`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "language" character varying NOT NULL, "code" text NOT NULL, "status" "public"."submissions_status_enum" NOT NULL DEFAULT 'PENDING', "execution_time_ms" integer, "submitted_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, "problem_id" uuid, CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD CONSTRAINT "FK_b64ac4d24cd9a87eda34b2a9457" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_fca12c4ddd646dea4572c6815a9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d7613a2172f2115adb054c4c16e" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d7613a2172f2115adb054c4c16e"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_fca12c4ddd646dea4572c6815a9"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP CONSTRAINT "FK_b64ac4d24cd9a87eda34b2a9457"`);
        await queryRunner.query(`DROP TABLE "submissions"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`DROP TABLE "problems"`);
        await queryRunner.query(`DROP TABLE "test_cases"`);
    }

}
