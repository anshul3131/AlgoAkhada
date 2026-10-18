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
import { COMMA } from "../../../constants/AppConstant";

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
        return await this.createQueryBuilder("submission")
            .select(["submission.id", "submission.code", "submission.language"])
            .where("submission.user_id = :userId", { userId })
            .andWhere("submission.problem_id = :problemId", { problemId })
            .andWhere("submission.status = :status", { status: SubmissionStatus.ACCEPTED })
            .orderBy("submission.submittedAt", "DESC")
            .getOne();
    }

    async getUserProblemSubmissions(problemId: string, userId: string) {
        return await this.createQueryBuilder("submission")
            .select([
                "submission.id",
                "submission.status",
                "submission.language",
                "submission.submittedAt",
                "submission.executionTimeMs"
            ])
            .where("submission.user_id = :userId", { userId })
            .andWhere("submission.problem_id = :problemId", { problemId })
            .orderBy("submission.submittedAt", "DESC")
            .getMany();
    }

    async getSubmissionCodeById(submissionId: string) {
        return await this.createQueryBuilder("submission")
            .select(["submission.id", "submission.code", "submission.language"])
            .where("submission.id = :submissionId", { submissionId })
            .getOne();
    }

    async getUserSubmissions(
        userId: string,
        page: number,
        limit: number,
        status?: string,
        topic?: string,
        search?: string
    ) {
        const query = this.createQueryBuilder("submission")
            .leftJoin("submission.problem", "problem")
            .select([
                "submission.id",
                "submission.status",
                "submission.language",
                "submission.executionTimeMs",
                "submission.memoryUsedMb",
                "submission.submittedAt",
                "problem.id",
                "problem.title",
                "problem.difficulty",
                "problem.tags",
                "problem.timeLimit",
                "problem.memoryLimit"
            ])
            .where("submission.user_id = :userId", { userId });

        if (status) {
            const statusList = status
                .split(COMMA)
                .map(s => s.trim())
                .filter(Boolean);
            if (statusList.length === 1) {
                query.andWhere("submission.status = :status", { status: statusList[0] });
            } else if (statusList.length > 1) {
                query.andWhere("submission.status IN (:...statuses)", { statuses: statusList });
            }
        }

        if (search && search.trim()) {
            query.andWhere("lower(problem.title) LIKE :search", { search: `${search.trim().toLowerCase()}%` });
        }

        if (topic) {
            const topicList = topic
                .split(COMMA)
                .map(t => t.trim())
                .filter(Boolean);
            if (topicList.length > 0) {
                query.andWhere("problem.tags @> :topics", { topics: topicList });
            }
        }

        query.orderBy("submission.submittedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        const [submissions, total] = await query.getManyAndCount();

        return {
            submissions,
            total,
            page,
            limit
        };
    }

    async getUserSubmissionMetadata(userId: string) {
        const statusRows = await this.createQueryBuilder("submission")
            .select("submission.status", "status")
            .addSelect("COUNT(*)::int", "count")
            .where("submission.user_id = :userId", { userId })
            .groupBy("submission.status")
            .getRawMany<{ status: string; count: number }>();

        const topicRows: Array<{ tag: string; count: number }> = await AppDataSource.query(
            `SELECT tag, COUNT(*)::int AS count
             FROM submissions s
             INNER JOIN problems p ON p.id = s.problem_id,
             unnest(p.tags) AS tag
             WHERE s.user_id = $1
             GROUP BY tag
             ORDER BY count DESC, tag ASC`,
            [userId]
        );

        const statusCounts: Record<string, number> = {};
        let total = 0;
        for (const row of statusRows) {
            const count = Number(row.count) || 0;
            statusCounts[row.status] = count;
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
            statusCounts,
            topicCounts
        };
    }
}

export const submissionRepository = new SubmissionRepository();