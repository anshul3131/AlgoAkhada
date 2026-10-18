import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Problem } from "./Problem";

@Entity("test_cases")
@Index("idx_test_cases_problem_hidden", ["problem", "isHidden"])
export class TestCase {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("text")
    input: string;

    @Column("text")
    expectedOutput: string;

    @Column("boolean",{ default: true }) // True for hidden test cases used during grading
    isHidden: boolean;

    @Column({ type: "varchar", nullable: true })
    name: string | null;

    @Column({ type: "text", nullable: true })
    explanation: string | null;

    @ManyToOne(() => Problem, (problem) => problem.testCases, { onDelete: "CASCADE" })
    @JoinColumn({ name: "problem_id" })
    problem: Problem;
}