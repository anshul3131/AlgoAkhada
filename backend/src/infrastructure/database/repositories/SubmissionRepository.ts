/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for code Submission entity lifecycle and lookup queries
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { Submission, SubmissionStatus } from "../../../domain/entities/Submission";
import { AppDataSource } from "../data_source";

@Service()
export class SubmissionRepository extends Repository<Submission> {
    constructor() {
        super(Submission, AppDataSource.createEntityManager());
    }

    async saveEntity(submission: Submission, queryRunner?: QueryRunner){
        if (queryRunner) {
            return await queryRunner.manager.getRepository(Submission).save(submission);
        }
        return await this.save(submission);
    }

    async updateStatus(id: string, status: SubmissionStatus, queryRunner?: QueryRunner) {
        const repo = queryRunner ? queryRunner.manager.getRepository(Submission) : this;
        
        const submission = await repo.findOne({ where: { id } });
        if (!submission) return null;

        submission.status = status;
        return await repo.save(submission);
    }

    async getLastAcceptedSubmission(problemId: string, userId: string) {
        return await this.findOne({
            where: { problem: { id: problemId }, user: { id: userId }, status: SubmissionStatus.ACCEPTED },
            order: { submittedAt: "DESC" } as any
        });
    }
}

export const submissionRepository = new SubmissionRepository();