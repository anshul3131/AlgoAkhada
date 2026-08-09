import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { TestCase } from "./TestCase";
import { Submission } from "./Submission";
import { ProblemTag } from "../enums/ProblemTag";

// 1. Define the exact options allowed
export enum ProblemDifficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard"
}

@Entity("problems")
export class Problem {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("varchar", { length: 255 })
    title: string;

    @Column("text")
    description: string;

    // 4. Enforce the Enum at the database layer
    @Column({
        type: "enum",
        enum: ProblemDifficulty,
        default: ProblemDifficulty.MEDIUM
    })
    difficulty: ProblemDifficulty;

    @Column({
        type: "enum",
        enum: ProblemTag,
        array: true,
        default: []
    })
    tags: ProblemTag[];

    @Column("float", { default: 2.0 }) // Time limit in seconds
    timeLimit: number;

    @Column("int", { default: 256 }) // Memory limit in MB
    memoryLimit: number;

    @OneToMany(() => TestCase, (testCase) => testCase.problem, { cascade: true })
    testCases: TestCase[];

    @OneToMany(() => Submission, (submission) => submission.problem,{cascade : true})
    submissions: Submission[];

    @CreateDateColumn()
    createdAt: Date;
}