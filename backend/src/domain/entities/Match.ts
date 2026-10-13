import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { User } from "./User";
import { Problem } from "./Problem";
import { MatchStatus } from "../enums/MatchStatus";

@Entity("matches")
@Index("idx_matches_user1_finished", ["user1", "created_at"], { where: `"status" = 'FINISHED'` })
@Index("idx_matches_user2_finished", ["user2", "created_at"], { where: `"status" = 'FINISHED'` })
@Index("idx_matches_inprogress_created_at", ["created_at"], { where: `"status" = 'IN_PROGRESS'` })
export class Match {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "user1_id" })
    user1: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "user2_id" })
    user2: User;

    @ManyToOne(() => Problem)
    @JoinColumn({ name: "problem_id" })
    problem: Problem;

    @Column({
        type: "enum",
        enum: MatchStatus,
        default: MatchStatus.IN_PROGRESS
    })
    status: MatchStatus;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "winner_id" })
    winner: User;
}
