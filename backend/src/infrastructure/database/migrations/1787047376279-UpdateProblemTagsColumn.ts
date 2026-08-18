import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProblemTagsColumn1787047376279 implements MigrationInterface {
    name = 'UpdateProblemTagsColumn1787047376279'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "tags"`);
        await queryRunner.query(`DROP TYPE "public"."problems_tags_enum"`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "tags" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "tags"`);
        await queryRunner.query(`CREATE TYPE "public"."problems_tags_enum" AS ENUM('arrays', 'strings', 'sorting', 'binary search', 'two pointers', 'sliding window', 'prefix sums', 'hashing', 'bit manipulation', 'recursion', 'backtracking', 'greedy', 'dynamic programming', 'math', 'number theory', 'combinatorics', 'geometry', 'linked list', 'stack', 'queue', 'deque', 'heap', 'trie', 'trees', 'binary search tree', 'tree algorithms', 'graph', 'graph traversal', 'shortest path', 'minimum spanning tree', 'topological sort', 'disjoint set union', 'strongly connected components', 'network flow', 'range queries', 'segment tree', 'fenwick tree', 'sparse table', 'string algorithms', 'divide and conquer', 'meet in the middle', 'sqrt decomposition', 'mo''s algorithm', 'binary lifting', 'heavy light decomposition', 'game theory', 'constructive algorithms', 'simulation', 'probability', 'advanced data structures')`);
        await queryRunner.query(`ALTER TABLE "problems" ADD "tags" "public"."problems_tags_enum" array NOT NULL DEFAULT '{}'`);
    }

}
