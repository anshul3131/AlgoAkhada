import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Problem } from "./Problem";

@Entity("test_cases")
export class TestCase {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("text")
    input: string;

    @Column("text")
    expectedOutput: string;

    @Column("boolean",{ default: true }) // True for hidden test cases used during grading
    isHidden: boolean;

    @ManyToOne(() => Problem, (problem) => problem.testCases, { onDelete: "CASCADE" })
    @JoinColumn({ name: "problem_id" })
    problem: Problem;
}