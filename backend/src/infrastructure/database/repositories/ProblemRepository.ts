/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for Problem entity operations and complex filtered searches
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { Problem } from "../../../domain/entities/Problem";
import { SubmissionStatus } from "../../../domain/entities/Submission";
import { AppDataSource } from "../data_source";
import { COMMA } from "../../../constants/AppConstant";

@Service()
export class ProblemRepository extends Repository<Problem> {
    constructor() {
        super(Problem, AppDataSource.createEntityManager());
    }

    async saveEntity(problem: Problem, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(Problem).save(problem);
        }
        return await this.save(problem);
    }

    async getProblemById(id: string) {
        return await this.findOne({ where: { id }, relations: { testCases: true } });
    }

    async getProblemWithSamples(id: string): Promise<Problem | null> {
        return await this.createQueryBuilder("problem")
            .leftJoinAndSelect("problem.testCases", "testCase", "testCase.isHidden = false")
            .where("problem.id = :id", { id })
            .getOne();
    }

    async getAllProblems(
        page: number,
        limit: number,
        difficulty?: string,
        search?: string,
        tag?: string,
        hideSolved?: boolean,
        userId?: string
    ) {
        const query = this.createQueryBuilder("problem");

        // Projection Pruning: select only lightweight columns needed for list view, omitting large problem.description
        query.select([
            "problem.id",
            "problem.title",
            "problem.difficulty",
            "problem.tags",
            "problem.timeLimit",
            "problem.memoryLimit",
            "problem.createdAt"
        ]);

        // Format difficulty to match Enum (supports single 'Easy' or comma-separated 'Easy,Medium')
        if (difficulty) {
            const normalizedDifficulties = difficulty
                .split(COMMA)
                .map(d => d.trim())
                .filter(Boolean)
                .map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

            if (normalizedDifficulties.length === 1) {
                query.andWhere("problem.difficulty = :difficulty", { difficulty: normalizedDifficulties[0] });
            } else if (normalizedDifficulties.length > 1) {
                query.andWhere("problem.difficulty IN (:...difficulties)", { difficulties: normalizedDifficulties });
            }
        }

        // Search by prefix if provided (case-insensitive prefix search utilizing idx_problems_title_lower)
        if (search && search.trim()) {
            query.andWhere("lower(problem.title) LIKE :search", { search: `${search.trim().toLowerCase()}%` });
        }

        // Filter by specific tag(s) if provided using @> array containment so PostgreSQL uses idx_problems_tags_gin
        const tagList = tag
            ? tag.split(COMMA).map(t => t.trim()).filter(Boolean)
            : [];
        if (tagList.length > 0) {
            query.andWhere("problem.tags @> :tags", { tags: tagList });
        }

        // Exclude solved problems when hideSolved is enabled for an authenticated user
        if (hideSolved && userId) {
            query.andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM submissions s
                    WHERE s.problem_id = problem.id
                      AND s.user_id = :userId
                      AND s.status = :acceptedStatus
                )`,
                { userId, acceptedStatus: SubmissionStatus.ACCEPTED }
            );
        }

        // Ordering: when filtering by tag(s), all matched rows already have tags so we can sort directly by createdAt DESC;
        // otherwise prioritize tagged problems first or sort by createdAt DESC
        if (tagList.length === 0) {
            query.orderBy(
                "CASE WHEN problem.tags IS NOT NULL AND cardinality(problem.tags) > 0 THEN 0 ELSE 1 END",
                "ASC"
            );
            query.addOrderBy("problem.createdAt", "DESC");
        } else {
            query.orderBy("problem.createdAt", "DESC");
        }

        // Pagination
        query.skip((page - 1) * limit).take(limit);

        const [problems, total] = await query.getManyAndCount();

        return {
            problems,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getProblemMetadata() {
        const difficultyRows = await this.createQueryBuilder("problem")
            .select("problem.difficulty", "difficulty")
            .addSelect("COUNT(*)::int", "count")
            .groupBy("problem.difficulty")
            .getRawMany<{ difficulty: string; count: number }>();

        const topicRows: Array<{ tag: string; count: number }> = await AppDataSource.query(
            `SELECT tag, COUNT(*)::int AS count
             FROM problems, unnest(tags) AS tag
             GROUP BY tag
             ORDER BY count DESC, tag ASC`
        );

        const difficultyCounts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
        let total = 0;
        for (const row of difficultyRows) {
            const count = Number(row.count) || 0;
            difficultyCounts[row.difficulty] = count;
            total += count;
        }

        const topicCounts: Record<string, number> = {};
        for (const row of topicRows) {
            if (row.tag) {
                topicCounts[row.tag] = Number(row.count) || 0;
            }
        }

        return {
            total,
            difficultyCounts,
            topicCounts
        };
    }

    async getRandomProblemByTopic(topic: string) {
        return await this.createQueryBuilder("problem")
            .where(":tag = ANY(problem.tags)", { tag: topic })
            .orderBy("RANDOM()")
            .getOne();
    }

    async getRandomProblemByTopicAndDifficulty(topic: string, difficulty: string) {
        return await this.createQueryBuilder("problem")
            .where(":tag = ANY(problem.tags)", { tag: topic })
            .andWhere("problem.difficulty = :difficulty", { difficulty })
            .orderBy("RANDOM()")
            .getOne();
    }
}

export const problemRepository = new ProblemRepository();