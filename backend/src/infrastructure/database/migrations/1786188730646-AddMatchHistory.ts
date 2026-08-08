import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMatchHistory1786188730646 implements MigrationInterface {
    name = 'AddMatchHistory1786188730646'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "match_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "match_id" uuid, "user_id" uuid, "submission_id" uuid, CONSTRAINT "PK_0ea4b9eb19918b0713fbafe3709" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "winner_id" uuid`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_5d665d4ed9ae6cf089ece227754" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_histories" ADD CONSTRAINT "FK_13120a1e777ac10002a4fc5b9dc" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_histories" ADD CONSTRAINT "FK_3ca9d1960e1721fc8012fd7dad9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_histories" ADD CONSTRAINT "FK_62485dfee809b0021b9afc5b677" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "match_histories" DROP CONSTRAINT "FK_62485dfee809b0021b9afc5b677"`);
        await queryRunner.query(`ALTER TABLE "match_histories" DROP CONSTRAINT "FK_3ca9d1960e1721fc8012fd7dad9"`);
        await queryRunner.query(`ALTER TABLE "match_histories" DROP CONSTRAINT "FK_13120a1e777ac10002a4fc5b9dc"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_5d665d4ed9ae6cf089ece227754"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "winner_id"`);
        await queryRunner.query(`DROP TABLE "match_histories"`);
    }

}
