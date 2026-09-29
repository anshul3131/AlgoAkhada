import { Repository, QueryRunner } from "typeorm";
import { Problem } from "../../../domain/entities/Problem";
import { AppDataSource } from "../data_source";

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

    async getAllProblems(page: number, limit: number, difficulty: string, search?: string, tag?: string) {
        const query = this.createQueryBuilder("problem");

        // Format difficulty to match Enum (e.g., 'medium' -> 'Medium')
        if (difficulty) {
            const normalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
            query.andWhere("problem.difficulty = :difficulty", { difficulty: normalizedDifficulty });
        }

        // Search by prefix if provided
        if (search) {
            query.andWhere("problem.title ILIKE :search", { search: `${search}%` });
        }

        // Filter by specific tag if provided
        if (tag) {
            query.andWhere(":tag = ANY(problem.tags)", { tag });
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