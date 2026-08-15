import { User } from "../entities/User";

export class SignUpRequestDTO {
    email!: string;
    password!: string;
    username!: string;
    ipAddress?: string;
    userAgent?: string;
}

export class LoginRequestDTO {
    email!: string;
    password!: string;
    ipAddress?: string;
    userAgent?: string;
}

export class AuthResponseDTO {
    user!: Partial<User>;
    accessToken!: string;
    refreshToken!: string;
}

export class RefreshRequestDTO {
    refreshToken!: string;
    ipAddress?: string;
    userAgent?: string;
}
