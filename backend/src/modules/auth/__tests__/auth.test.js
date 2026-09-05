import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import AuthService from '../services/AuthService.js';
import { authorize } from '../routes/index.js';
import { hasPermission } from '../permissions.js';

describe('authentication authorization', () => {
  const config = {
    BCRYPT_ROUNDS: 4,
    JWT_SECRET: 'test-secret-key-for-testing-only-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only-32-chars',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  it('always creates a customer even when registration includes a forged role', async () => {
    let storedUser;
    const db = () => ({
      where: () => ({ first: async () => storedUser || null }),
      insert: async (data) => {
        storedUser = { ...data, id: 'customer-1', is_active: 1 };
      },
    });
    const service = new AuthService(db, { info: () => {} }, config);

    const result = await service.register({
      fullName: 'Customer One',
      email: 'customer@example.com',
      password: 'CustomerPass123!',
      role: 'admin',
    });

    expect(storedUser.role).toBe('customer');
    expect(result.user.role).toBe('customer');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(jwt.verify(result.accessToken, config.JWT_SECRET)).toMatchObject({
      sub: 'customer-1',
      role: 'customer',
    });
  });

  it('rejects passwords shorter than eight characters', async () => {
    const db = () => ({ where: () => ({ first: async () => null }) });
    const service = new AuthService(db, { info: () => {} }, config);

    await expect(service.register({
      fullName: 'Customer One',
      email: 'customer@example.com',
      password: 'short',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('blocks roles not included in the authorization policy', () => {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    authorize('admin')({ user: { role: 'customer' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the centralized product permission policy', () => {
    expect(hasPermission('rep', 'products', 'create')).toBe(true);
    expect(hasPermission('manager', 'products', 'create')).toBe(false);
    expect(hasPermission('admin', 'products', 'delete')).toBe(true);
    expect(hasPermission('customer', 'products', 'read')).toBe(false);
  });
});
