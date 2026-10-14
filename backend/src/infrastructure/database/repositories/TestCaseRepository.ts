/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for problem TestCase entity operations
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { TestCase } from "../../../domain/entities/TestCase";
import { AppDataSource } from "../data_source";

@Service()
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
}

export const testCaseRepository = new TestCaseRepository();