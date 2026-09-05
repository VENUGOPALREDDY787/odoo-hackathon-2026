/**
 * Customer Isolation Authorization Tests
 *
 * Explicitly tests the hard security boundary:
 * "A customer token for quotation A cannot touch quotation B."
 *
 * These tests verify NegotiationService._assertOwnsQuotation() by constructing
 * mock DB responses for cross-customer and same-customer scenarios.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NegotiationService } from '../services/NegotiationService.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const CUSTOMER_A_USER_ID = 'user-customer-a';
const CUSTOMER_A_ID = 'customer-a';
const CUSTOMER_B_ID = 'customer-b';
const QUOTATION_A_ID = 'quotation-a'; // belongs to customer A
const QUOTATION_B_ID = 'quotation-b'; // belongs to customer B

function makeCustomerAUser() {
  return { id: CUSTOMER_A_USER_ID, role: 'customer', email: 'a@example.com' };
}

/**
 * Creates a mock Knex-style query builder that supports .where().select().first() chains.
 * The final .first() resolves with `firstResult`.
 */
function buildQueryChain(firstResult) {
  const chain = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(firstResult),
  };
  return chain;
}

/**
 * Builds a callable mockDb function that Knex-style dispatches on table name.
 * this.db('tableName').where({}).first() pattern.
 */
function buildMockDb(tableMap) {
  return function mockDb(tableName) {
    if (!(tableName in tableMap)) {
      throw new Error(`buildMockDb: no mock registered for table '${tableName}'`);
    }
    return buildQueryChain(tableMap[tableName]);
  };
}

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NegotiationService - Customer Isolation Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- _resolveCustomerForUser ----

  describe('_resolveCustomerForUser', () => {
    it('returns the customer record when user has a linked customer profile', async () => {
      const expectedCustomer = { id: CUSTOMER_A_ID, user_id: CUSTOMER_A_USER_ID, deleted_at: null };
      const service = new NegotiationService(
        buildMockDb({ customers: expectedCustomer }),
        mockLogger
      );

      const result = await service._resolveCustomerForUser(CUSTOMER_A_USER_ID);
      expect(result.id).toBe(CUSTOMER_A_ID);
    });

    it('throws AuthorizationError (403) when no customer profile exists for the user', async () => {
      const service = new NegotiationService(
        buildMockDb({ customers: null }), // no customer found
        mockLogger
      );

      await expect(service._resolveCustomerForUser('orphan-user-id'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ---- _assertOwnsQuotation ----

  describe('_assertOwnsQuotation', () => {
    it('does NOT throw when customer owns the quotation (same customer_id)', async () => {
      const quotationA = { id: QUOTATION_A_ID, customer_id: CUSTOMER_A_ID, status: 'sent' };
      const service = new NegotiationService(
        buildMockDb({ quotations: quotationA }),
        mockLogger
      );

      await expect(
        service._assertOwnsQuotation(QUOTATION_A_ID, CUSTOMER_A_ID)
      ).resolves.toBeUndefined();
    });

    it("throws AuthorizationError (403) when customer tries to access another customer's quotation", async () => {
      // Quotation B belongs to Customer B — Customer A is trying to access it
      const quotationB = { id: QUOTATION_B_ID, customer_id: CUSTOMER_B_ID, status: 'sent' };
      const service = new NegotiationService(
        buildMockDb({ quotations: quotationB }),
        mockLogger
      );

      await expect(
        service._assertOwnsQuotation(QUOTATION_B_ID, CUSTOMER_A_ID) // customer A trying to touch quotation B
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('not authorized'),
      });
    });

    it('throws AuthorizationError (403, not 404) when quotation does not exist at all', async () => {
      // Returning null prevents ID enumeration — attacker cannot distinguish
      // "quotation doesn't exist" from "quotation belongs to someone else"
      const service = new NegotiationService(
        buildMockDb({ quotations: null }),
        mockLogger
      );

      const error = await service._assertOwnsQuotation('nonexistent-id', CUSTOMER_A_ID)
        .catch((e) => e);

      // Must be 403, not 404 — this is the anti-enumeration requirement
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('not authorized');
    });

    it('logs a security warning when cross-customer access is attempted', async () => {
      const quotationB = { id: QUOTATION_B_ID, customer_id: CUSTOMER_B_ID, status: 'sent' };
      const service = new NegotiationService(
        buildMockDb({ quotations: quotationB }),
        mockLogger
      );

      await service._assertOwnsQuotation(QUOTATION_B_ID, CUSTOMER_A_ID).catch(() => {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedQuotationId: QUOTATION_B_ID,
          requestingCustomerId: CUSTOMER_A_ID,
          ownerCustomerId: CUSTOMER_B_ID,
        }),
        expect.stringContaining('Cross-customer')
      );
    });
  });

  // ---- runNegotiation security — end-to-end customer isolation path ----

  describe('runNegotiation - end-to-end customer isolation', () => {
    it('rejects with 403 when customer A token is used for quotation B', async () => {
      const customerA = { id: CUSTOMER_A_ID, user_id: CUSTOMER_A_USER_ID };
      // Quotation B belongs to customer B
      const quotationB = { id: QUOTATION_B_ID, customer_id: CUSTOMER_B_ID, status: 'sent' };

      const service = new NegotiationService(
        buildMockDb({ customers: customerA, quotations: quotationB }),
        mockLogger
      );

      await expect(
        service.runNegotiation(
          QUOTATION_B_ID, // ← Customer A is trying to negotiate Quotation B
          { sellerMin: 80, sellerMax: 100, buyerMin: 60, buyerMax: 95 },
          makeCustomerAUser(),
          {}
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('not authorized'),
      });
    });

    it('does NOT leak whether quotation B exists to customer A (same 403 for both cases)', async () => {
      const customerA = { id: CUSTOMER_A_ID, user_id: CUSTOMER_A_USER_ID };

      // Case 1: quotation doesn't exist (null)
      const service1 = new NegotiationService(
        buildMockDb({ customers: customerA, quotations: null }),
        mockLogger
      );
      const error1 = await service1.runNegotiation(
        'nonexistent-quotation',
        { sellerMin: 80, sellerMax: 100, buyerMin: 60, buyerMax: 95 },
        makeCustomerAUser(),
        {}
      ).catch((e) => e);

      // Case 2: quotation exists but belongs to another customer
      const service2 = new NegotiationService(
        buildMockDb({ customers: customerA, quotations: { id: QUOTATION_B_ID, customer_id: CUSTOMER_B_ID } }),
        mockLogger
      );
      const error2 = await service2.runNegotiation(
        QUOTATION_B_ID,
        { sellerMin: 80, sellerMax: 100, buyerMin: 60, buyerMax: 95 },
        makeCustomerAUser(),
        {}
      ).catch((e) => e);

      // Both must return exactly the same status code and message — no information leakage
      expect(error1.statusCode).toBe(403);
      expect(error2.statusCode).toBe(403);
      expect(error1.message).toBe(error2.message);
    });
  });
});
