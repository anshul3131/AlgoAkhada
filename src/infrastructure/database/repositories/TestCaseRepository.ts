import { Repository, QueryRunner, } from "typeorm";
import { TestCase } from "../../../domain/entities/TestCase";
import { AppDataSource } from "../data_source";

export class TestCaseRepository extends Repository<TestCase> {
    constructor() {
        super(TestCase, AppDataSource.createEntityManager());
    }

    async saveEntity(testCase: TestCase, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(TestCase).save(testCase);
        }
        return await this.save(testCase);
    }

    async getTestCaseById(id: string) {
        return await this.findOne({ where: { id }, relations: { problem: true } });
    }

    async getTestCasesByProblemId(problemId: string) {
        return await this.find({ where: { problem: { id: problemId } } });
    }
};

export const testCaseRepository = new TestCaseRepository();