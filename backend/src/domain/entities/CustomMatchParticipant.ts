import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm";
import { CustomMatch } from "./CustomMatch";
import { User } from "./User";
import { CustomParticipantStatus } from "../enums/CustomParticipantStatus";

@Entity("custom_match_participants")
export class CustomMatchParticipant {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => CustomMatch, match => match.participants, { onDelete: "CASCADE" })
    @JoinColumn({ name: "custom_match_id" })
    customMatch: CustomMatch;

    @ManyToOne(() => User)
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({
        type: "enum",
        enum: CustomParticipantStatus,
        default: CustomParticipantStatus.JOINED
    })
    status: CustomParticipantStatus;

    @Column({ type: "int", nullable: true })
    score: number;
}
