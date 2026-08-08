import { User } from '../../domain/entities/User';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
    
    // Ensure you have a strong secret in your .env file
    private jwtSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';

    public async signUp(email: string, passwordRaw: string, username: string): Promise<{ user: User, token: string }> {
        // 1. Check if user already exists
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new Error("User with this email already exists");
        }

        // 2. Hash the password (10 rounds of salt is the standard)
        const hashedPassword = await bcrypt.hash(passwordRaw, 10);

        // 3. Create and save the new user
        const newUser = userRepository.create({
            email,
            username,
            password: hashedPassword // Save the hash, NEVER the raw password
        });
        await userRepository.save(newUser);

        // 4. Generate their first JWT so they are logged in immediately
        const token = this.generateToken(newUser.id);

        return { user: newUser, token };
    }

    public async login(email: string, passwordRaw: string): Promise<{ user: User, token: string }> {
        // 1. Find the user
        const user = await userRepository.findOne({ where: { email } });
        if (!user) {
            throw new Error("Invalid email or password");
        }

        // 2. Compare the provided password against the saved hash
        const isPasswordValid = await bcrypt.compare(passwordRaw, user.password);
        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }

        // 3. Generate a fresh JWT
        const token = this.generateToken(user.id);

        return { user, token };
    }

    private generateToken(userId: string | number): string {
        // Token expires in 24 hours
        return jwt.sign({ id: userId }, this.jwtSecret, { expiresIn: '24h' });
    }

    // Add this inside AuthService.ts
    public async generateTestToken(email: string): Promise<string> {
        // ONLY allow this in development, never in production!
        if (process.env.NODE_ENV === 'production') {
            throw new Error("This action is strictly forbidden in production environments.");
        }

        const user = await userRepository.findOne({ where: { email } });
        if (!user) {
            throw new Error("User not found");
        }

        return this.generateToken(user.id);
    }
}

export const authService = new AuthService();