import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase, closeDatabase } from '../utils/database.js';
import config from '../config/index.js';

const password = 'DemoPass123!';
const users = [
  { email: 'demo.rep@dealflow360.local', full_name: 'Demo Sales Rep', role: 'rep' },
  { email: 'demo.manager@dealflow360.local', full_name: 'Demo Sales Manager', role: 'manager' },
  { email: 'demo.finance@dealflow360.local', full_name: 'Demo Finance Lead', role: 'finance' },
  { email: 'demo.admin@dealflow360.local', full_name: 'Demo Administrator', role: 'admin' },
  { email: 'demo.customer@dealflow360.local', full_name: 'Demo Customer', role: 'customer' },
];

async function seedDemoUsers() {
  const db = getDatabase();
  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
  const seeded = [];

  for (const user of users) {
    let existing = await db('users').where({ email: user.email }).first();
    if (!existing) {
      const id = crypto.randomUUID();
      await db('users').insert({
        id,
        ...user,
        password_hash: passwordHash,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      existing = { id, ...user };
    }

    if (user.role === 'customer') {
      const customer = await db('customers').where({ user_id: existing.id }).first();
      if (!customer) {
        await db('customers').insert({
          id: crypto.randomUUID(),
          user_id: existing.id,
          company_name: 'Demo Customer Company',
          tier: 'Gold',
          billing_address: JSON.stringify({ street: '100 Demo Avenue', city: 'Demo City', country: 'US' }),
          shipping_address: JSON.stringify({ street: '100 Demo Avenue', city: 'Demo City', country: 'US' }),
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    seeded.push({ email: user.email, role: user.role });
  }

  console.table(seeded);
  console.log(`Demo password for all accounts: ${password}`);
}

seedDemoUsers()
  .catch((error) => {
    console.error('Demo user seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
