import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("users") // This maps the class to a Postgres table named 'users'
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar" })
    username: string;

    @Column({ type: "int", default: 1200 })
    elo_rating: number;

    @Column({type : "varchar",unique : true})
    email : string;

    @Column({type : "varchar"})
    password : string;

    @Column({ type: "varchar", nullable: true })
    refresh_token: string | null;

    @Column({ type: "varchar", nullable: true })
    last_login_ip: string | null;

    @Column({ type: "varchar", nullable: true })
    last_login_device: string | null;

    @CreateDateColumn()
    created_at: Date;
}