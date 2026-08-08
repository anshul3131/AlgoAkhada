import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Problem } from "./Problem";
import { User } from "./User";
import { Language } from "../enums/CodeLanguage";
// import { User } from "./User"; // You will eventually link this to the user who submitted it!


export enum SubmissionStatus {
    PENDING = "Pending",
    ACCEPTED = "Accepted",
    WRONG_ANSWER = "Wrong Answer",
    TIME_LIMIT_EXCEEDED = "Time Limit Exceeded",
    COMPILATION_ERROR = "Compilation Error",
    RUNTIME_ERROR = "Runtime Error",
    MEMORY_LIMIT_EXCEEDED = "Memory Limit Exceeded",
    SUCCESS = "Success"
}

@Entity("submissions")
export class Submission {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("text")
    code: string;

    @Column({
        type: "enum",
        enum: Language,
    })
    language: Language;

    // e.g., 'Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error'
    @Column({
        type: "enum",
        enum: SubmissionStatus,
        default: SubmissionStatus.PENDING
    })
    status: SubmissionStatus;

    @Column("float", { nullable: true })
    executionTimeMs: number;

    @Column("float", { nullable: true })
    memoryUsedMb: number;

    // Link back to the parent problem
    @ManyToOne(() => Problem, (problem) => problem.submissions, { onDelete: "CASCADE" })
    @JoinColumn({ name: "problem_id" })
    problem: Problem;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: "user_id" })
    user: User;

    @CreateDateColumn()
    submittedAt: Date;
}