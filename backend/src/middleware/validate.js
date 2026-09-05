import { asyncHandler } from './errorHandler.js';

/**
 * Creates an Express middleware to validate request target ('body', 'query', or 'params') using a Zod schema.
 * On validation success, updates req[target] with the validated and coerced data.
 * On validation failure, passes the Zod error to the error handler.
 */
export function validate(schema, target = 'body') {
  return asyncHandler(async (req, res, next) => {
    const parsed = await schema.parseAsync(req[target] || {});
    req[target] = parsed;
    next();
  });
}

export function validateBody(schema) {
  return validate(schema, 'body');
}

export function validateQuery(schema) {
  return validate(schema, 'query');
}

export function validateParams(schema) {
  return validate(schema, 'params');
}

export default {
  validate,
  validateBody,
  validateQuery,
  validateParams,
};
