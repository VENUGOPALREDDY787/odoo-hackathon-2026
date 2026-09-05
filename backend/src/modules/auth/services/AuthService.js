import { ValidationError, AuthenticationError, ConflictError, NotFoundError, RateLimitError } from '../../../errors/AppError.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const INTERNAL_ROLES = ['rep', 'manager', 'finance', 'admin'];
const CUSTOMER_ROLE = 'customer';

export class AuthService {
  constructor(db, logger, config, emailService = null) {
    this.db = db;
    this.logger = logger;
    this.config = config;
    this.emailService = emailService;
  }

  async registerInternal(data) {
    const { email, password, fullName, role = 'rep' } = data;

    if (!INTERNAL_ROLES.includes(role)) {
      throw new ValidationError('Invalid role for internal user', { role });
    }

    const existing = await this.db('users').where({ email, deleted_at: null }).first();
    if (existing) {
      throw new ConflictError('Email already registered', { email });
    }

    const passwordHash = await bcrypt.hash(password, this.config.BCRYPT_ROUNDS);
    const userId = crypto.randomUUID();

    await this.db('users').insert({
        id: userId,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    const user = await this.db('users').where({ id: userId }).first();

    this.logger.info({ userId: user.id, email, role }, 'Internal user registered');
    return this.generateTokensWithRotation(user);
  }

  async registerCustomer(data) {
    const { email, fullName, companyName } = data;

    const existing = await this.db('users').where({ email, deleted_at: null }).first();
    if (existing) {
      throw new ConflictError('Email already registered', { email });
    }

    const trx = await this.db.transaction();
    try {
      // Customer authentication is magic-link-only, but MySQL requires a non-null password hash.
      const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), this.config.BCRYPT_ROUNDS);
      const userId = crypto.randomUUID();
      await trx('users').insert({
          id: userId,
          email,
          password_hash: unusablePasswordHash,
          full_name: fullName,
          role: CUSTOMER_ROLE,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
      const user = await trx('users').where({ id: userId }).first();

      await trx('customers')
        .insert({
          user_id: user.id,
          company_name: companyName,
          tier: 'Bronze',
          billing_address: JSON.stringify({}),
          created_at: new Date(),
          updated_at: new Date(),
        });

      await trx.commit();

      this.logger.info({ userId: user.id, email }, 'Customer registered');
      return this.generateTokensWithRotation(user);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async loginInternal(email, password, reqMeta = {}) {
    await this.checkRateLimit(email, reqMeta.ip, 'login');

    const user = await this.db('users').where({ email, deleted_at: null }).first();
    if (!user) {
      await this.recordLoginAttempt(email, reqMeta.ip, false, reqMeta.userAgent);
      throw new AuthenticationError('Invalid credentials');
    }

    if (user.role === CUSTOMER_ROLE) {
      await this.recordLoginAttempt(email, reqMeta.ip, false, reqMeta.userAgent);
      throw new AuthenticationError('Use magic link to sign in');
    }

    if (!user.is_active) {
      await this.recordLoginAttempt(email, reqMeta.ip, false, reqMeta.userAgent);
      throw new AuthenticationError('Account is deactivated');
    }

    if (!user.password_hash) {
      await this.recordLoginAttempt(email, reqMeta.ip, false, reqMeta.userAgent);
      throw new AuthenticationError('No password set. Use magic link or contact admin.');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await this.recordLoginAttempt(email, reqMeta.ip, false, reqMeta.userAgent);
      throw new AuthenticationError('Invalid credentials');
    }

    await this.recordLoginAttempt(email, reqMeta.ip, true, reqMeta.userAgent);
    await this.db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    this.logger.info({ userId: user.id, email, role: user.role }, 'Internal user logged in');
    return this.generateTokensWithRotation(user, reqMeta);
  }

  async requestMagicLink(email, reqMeta = {}) {
    await this.checkRateLimit(email, reqMeta.ip, 'magic_link');

    const user = await this.db('users')
      .where({ email, role: CUSTOMER_ROLE, deleted_at: null })
      .first();

    if (!user) {
      this.logger.warn({ email, ip: reqMeta.ip }, 'Magic link requested for non-existent customer');
      return { success: true };
    }

    const customer = await this.db('customers').where({ user_id: user.id, deleted_at: null }).first();
    if (!customer) {
      throw new AuthenticationError('Customer profile not found');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.db('magic_links').insert({
      customer_id: customer.id,
      token_hash: tokenHash,
      email: user.email,
      expires_at: expiresAt,
      user_agent: reqMeta.userAgent,
      ip_address: reqMeta.ip,
      created_at: new Date(),
    });

    if (this.emailService) {
      const magicLink = `${this.config.FRONTEND_URL}/auth/magic-link?token=${rawToken}`;
      await this.emailService.sendMagicLink(user.email, magicLink, expiresAt);
    } else {
      this.logger.info({ email: user.email, token: rawToken }, 'MAGIC LINK (dev mode)');
    }

    this.logger.info({ customerId: customer.id, email: user.email }, 'Magic link sent');
    return { success: true };
  }

  async verifyMagicLink(token, reqMeta = {}) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const magicLink = await this.db('magic_links')
      .where({ token_hash: tokenHash, used_at: null })
      .first();

    if (!magicLink) {
      throw new AuthenticationError('Invalid or expired magic link');
    }

    if (new Date(magicLink.expires_at) < new Date()) {
      throw new AuthenticationError('Magic link has expired');
    }

    const customer = await this.db('customers')
      .where({ id: magicLink.customer_id, deleted_at: null })
      .first();

    if (!customer) {
      throw new AuthenticationError('Customer not found');
    }

    const user = await this.db('users')
      .where({ id: customer.user_id, deleted_at: null, is_active: true })
      .first();

    if (!user) {
      throw new AuthenticationError('User account not found or deactivated');
    }

    await this.db('magic_links')
      .where({ id: magicLink.id })
      .update({ used_at: new Date() });

    this.logger.info({ userId: user.id, customerId: customer.id }, 'Magic link verified');
    return this.generateTokensWithRotation(user, reqMeta);
  }

  async refresh(refreshToken, reqMeta = {}) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const storedToken = await this.db('refresh_tokens')
      .where({ token_hash: tokenHash, revoked_at: null })
      .first();

    if (!storedToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await this.db('refresh_tokens').where({ id: storedToken.id }).update({ revoked_at: new Date() });
      throw new AuthenticationError('Refresh token expired');
    }

    const user = await this.db('users')
      .where({ id: storedToken.user_id, deleted_at: null, is_active: true })
      .first();

    if (!user) {
      throw new AuthenticationError('User not found or deactivated');
    }

    await this.db('refresh_tokens')
      .where({ id: storedToken.id })
      .update({ revoked_at: new Date() });

    this.logger.info({ userId: user.id }, 'Token refreshed, old token revoked');
    return this.generateTokensWithRotation(user, reqMeta);
  }

  async logout(refreshToken) {
    if (!refreshToken) return { success: true };

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.db('refresh_tokens')
      .where({ token_hash: tokenHash, revoked_at: null })
      .update({ revoked_at: new Date() });

    return { success: true };
  }

  async logoutAll(userId) {
    await this.db('refresh_tokens')
      .where({ user_id: userId, revoked_at: null })
      .update({ revoked_at: new Date() });

    this.logger.info({ userId }, 'All refresh tokens revoked');
    return { success: true };
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

    const [user] = await this.db('users')
      .where({ id: userId, deleted_at: null })
      .update({ ...updateData, updated_at: new Date() })
      .returning(['id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'is_active', 'updated_at']);

    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.db('users').where({ id: userId, deleted_at: null }).first();
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.password_hash) {
      throw new ValidationError('No password set. Use magic link to sign in.');
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.config.BCRYPT_ROUNDS);
    await this.db('users').where({ id: userId }).update({ password_hash: passwordHash, updated_at: new Date() });

    await this.logoutAll(userId);

    this.logger.info({ userId }, 'Password changed, all sessions revoked');
    return { success: true };
  }

  async setPassword(userId, newPassword) {
    const user = await this.db('users').where({ id: userId, deleted_at: null }).first();
    if (!user) {
      throw new NotFoundError('User');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.config.BCRYPT_ROUNDS);
    await this.db('users').where({ id: userId }).update({ password_hash: passwordHash, updated_at: new Date() });

    await this.logoutAll(userId);

    this.logger.info({ userId }, 'Password set, all sessions revoked');
    return { success: true };
  }

  generateTokensWithRotation(user, reqMeta = {}) {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.config.JWT_SECRET,
      { expiresIn: this.config.JWT_EXPIRES_IN }
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + this.parseExpiry(this.config.JWT_REFRESH_EXPIRES_IN));

    this.db('refresh_tokens').insert({
      user_id: user.id,
      token_hash: refreshTokenHash,
      user_agent: reqMeta.userAgent,
      ip_address: reqMeta.ip,
      expires_at: refreshExpiresAt,
      created_at: new Date(),
    }).catch(err => this.logger.error({ err: err.message }, 'Failed to store refresh token'));

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.config.JWT_SECRET);
  }

  async checkRateLimit(email, ip, type) {
    const windowMs = type === 'login' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const maxAttempts = type === 'login' ? 5 : 3;
    const since = new Date(Date.now() - windowMs);

    const attempts = await this.db('login_attempts')
      .where(function() {
        this.where('email', email).orWhere('ip_address', ip);
      })
      .where('created_at', '>=', since)
      .where('success', false)
      .count('* as count')
      .first();

    if (Number(attempts.count) >= maxAttempts) {
      this.logger.warn({ email, ip, type, attempts: attempts.count }, 'Rate limit exceeded');
      throw new RateLimitError(`Too many ${type} attempts. Please try again later.`);
    }
  }

  async recordLoginAttempt(email, ip, success, userAgent) {
    await this.db('login_attempts').insert({
      email,
      ip_address: ip,
      success,
      user_agent: userAgent,
      created_at: new Date(),
    }).catch(err => this.logger.error({ err: err.message }, 'Failed to record login attempt'));
  }

  parseExpiry(expiry) {
    const match = expiry.match(/^(\d+)([mhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  async cleanupExpiredTokens() {
    await this.db('refresh_tokens').where('expires_at', '<', new Date()).update({ revoked_at: new Date() });
    await this.db('magic_links').where('expires_at', '<', new Date()).whereNull('used_at').del();
    await this.db('login_attempts').where('created_at', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).del();
  }
}

export default AuthService;