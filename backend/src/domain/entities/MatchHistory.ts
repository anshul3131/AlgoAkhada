import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Match } from "./Match";
import { User } from "./User";
import { Submission } from "./Submission";

@Entity("match_histories")
@Index('index_match_histories_match_user_submission',["match", "user", "submission"])
export class MatchHistory {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Match, { onDelete: "CASCADE" })
    @JoinColumn({ name: "match_id" })
    match: Match;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Submission, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "submission_id" })
    submission: Submission;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
