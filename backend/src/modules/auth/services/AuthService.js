import { ValidationError, AuthenticationError, ConflictError, NotFoundError } from '../../../errors/AppError.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor(db, logger, config) {
    this.db = db;
    this.logger = logger;
    this.config = config;
  }

  async register(data) {
    const { email, password, fullName } = data;

    if (!email || !password || !fullName) {
      throw new ValidationError('Email, password, and full name are required');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    const existing = await this.db('users').where({ email, deleted_at: null }).first();
    if (existing) {
      throw new ConflictError('Email already registered', { email });
    }

    const passwordHash = await bcrypt.hash(password, this.config.BCRYPT_ROUNDS);

    await this.db('users').insert({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'customer',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const user = await this.db('users').where({ email, deleted_at: null }).first();

    this.logger.info({ userId: user.id, email }, 'User registered');
    return this.generateTokens(user);
  }

  async login(email, password) {
    const user = await this.db('users').where({ email, deleted_at: null }).first();
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AuthenticationError('Invalid credentials');
    }

    await this.db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    this.logger.info({ userId: user.id }, 'User logged in');
    return this.generateTokens(user);
  }

  async refresh(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.config.JWT_REFRESH_SECRET);
      const user = await this.db('users').where({ id: decoded.sub, deleted_at: null }).first();

      if (!user || !user.is_active) {
        throw new AuthenticationError('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Refresh token expired');
      }
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async getProfile(userId) {
    const user = await this.db('users')
      .where({ id: userId, deleted_at: null })
      .select('id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'is_active', 'last_login_at', 'created_at')
      .first();

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async updateProfile(userId, data) {
    const allowedFields = ['full_name', 'phone', 'avatar_url'];
    const updateData = {};

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    await this.db('users')
      .where({ id: userId, deleted_at: null })
      .update({ ...updateData, updated_at: new Date() });

    return this.getProfile(userId);
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    const user = await this.db('users').where({ id: userId, deleted_at: null }).first();
    if (!user) {
      throw new NotFoundError('User');
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.config.BCRYPT_ROUNDS);
    await this.db('users').where({ id: userId }).update({ password_hash: passwordHash, updated_at: new Date() });

    this.logger.info({ userId }, 'Password changed');
    return { success: true };
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.config.JWT_SECRET,
      { expiresIn: this.config.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      this.config.JWT_REFRESH_SECRET,
      { expiresIn: this.config.JWT_REFRESH_EXPIRES_IN }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.config.JWT_SECRET);
  }
}

export default AuthService;