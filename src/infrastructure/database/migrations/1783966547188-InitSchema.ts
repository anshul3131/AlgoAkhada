import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1783966547188 implements MigrationInterface {
    name = 'InitSchema1783966547188'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d7613a2172f2115adb054c4c16e"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "input_data"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "expected_output"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "is_hidden"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "time_limit_ms"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "memory_limit_kb"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "execution_time_ms"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "submitted_at"`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "input" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "expectedOutput" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "isHidden" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE TYPE "public"."problems_difficulty_enum" AS ENUM('Easy', 'Medium', 'Hard')`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "difficulty" "public"."problems_difficulty_enum" NOT NULL DEFAULT 'Medium'`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "timeLimit" double precision NOT NULL DEFAULT '2'`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "memoryLimit" integer NOT NULL DEFAULT '256'`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "executionTimeMs" double precision`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "memoryUsedMb" double precision`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "submittedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "problems" DROP CONSTRAINT "UQ_22348d871ecdb71ce590afcedda"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "title" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "language" SET DEFAULT 'cpp'`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_status_enum" RENAME TO "submissions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum" AS ENUM('Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error', 'Runtime Error', 'Memory Limit Exceeded')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" TYPE "public"."submissions_status_enum" USING "status"::"text"::"public"."submissions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'Pending'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d7613a2172f2115adb054c4c16e" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d7613a2172f2115adb054c4c16e"`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum_old" AS ENUM('PENDING', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" TYPE "public"."submissions_status_enum_old" USING "status"::"text"::"public"."submissions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_status_enum_old" RENAME TO "submissions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "language" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "title" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "problems" ADD CONSTRAINT "UQ_22348d871ecdb71ce590afcedda" UNIQUE ("title")`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "submittedAt"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "memoryUsedMb"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "executionTimeMs"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "memoryLimit"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "timeLimit"`);
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "difficulty"`);
        await queryRunner.query(`DROP TYPE "public"."problems_difficulty_enum"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "isHidden"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "expectedOutput"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP COLUMN "input"`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "submitted_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "execution_time_ms" integer`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "memory_limit_kb" integer NOT NULL DEFAULT '256000'`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "time_limit_ms" integer NOT NULL DEFAULT '2000'`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "is_hidden" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "expected_output" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD "input_data" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d7613a2172f2115adb054c4c16e" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
