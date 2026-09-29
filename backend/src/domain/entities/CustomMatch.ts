import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { User } from "./User";
import { Problem } from "./Problem";
import { MatchStatus } from "../enums/MatchStatus";
import { CustomMatchParticipant } from "./CustomMatchParticipant";

@Entity("custom_matches")
export class CustomMatch {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "host_id" })
    host: User;

    @ManyToOne(() => Problem, { nullable: true })
    @JoinColumn({ name: "problem_id" })
    problem: Problem;

    @Column({ type: "int" })
    timeLimit: number;

    @Column({ type: "int" })
    maxParticipants: number;

    @Column({ type: "varchar", length: 6, unique: true })
    joinCode: string;

    @Column({ type: "varchar", default: "Custom Match" })
    name: string;

    @Column({ type: "varchar", default: "Medium" })
    difficulty: string;

    @Column({ type: "boolean", default: false })
    isPublic: boolean;

    @Column({ type: "varchar" })
    topic: string;

    @Column({
        type: "enum",
        enum: MatchStatus,
        default: MatchStatus.NOT_STARTED
    })
    status: MatchStatus;

    @CreateDateColumn()
    created_at: Date;

    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @OneToMany(() => CustomMatchParticipant, participant => participant.customMatch)
    participants: CustomMatchParticipant[];
}
