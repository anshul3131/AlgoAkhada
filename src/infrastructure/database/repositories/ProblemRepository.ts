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

    async getAllProblems(){
        return await problemRepository.find();
    }
}

export const problemRepository = new ProblemRepository();