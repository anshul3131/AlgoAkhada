/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for Problem entity operations and complex filtered searches
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { Problem } from "../../../domain/entities/Problem";
import { AppDataSource } from "../data_source";

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

    async getAllProblems(page: number, limit: number, difficulty: string, search?: string, tag?: string) {
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

        // Format difficulty to match Enum (e.g., 'medium' -> 'Medium')
        if (difficulty) {
            const normalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
            query.andWhere("problem.difficulty = :difficulty", { difficulty: normalizedDifficulty });
        }

        // Search by prefix if provided (case-insensitive prefix search utilizing index)
        if (search) {
            query.andWhere("lower(problem.title) LIKE :search", { search: `${search.toLowerCase()}%` });
        }

        // Filter by specific tag if provided
        if (tag) {
            query.andWhere(":tag = ANY(problem.tags)", { tag });
        }

        // Prioritize problems with non-empty tags over problems with empty or null tags
        query.orderBy(
            "CASE WHEN problem.tags IS NOT NULL AND cardinality(problem.tags) > 0 THEN 0 ELSE 1 END",
            "ASC"
        );
        query.addOrderBy("problem.createdAt", "DESC");

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