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

    @CreateDateColumn()
    created_at: Date;
}