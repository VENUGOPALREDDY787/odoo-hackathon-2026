const ROLE_PERMISSIONS = Object.freeze({
  customer: Object.freeze({}),
  rep: Object.freeze({
    products: ['read', 'create', 'update'],
    productVariants: ['read', 'create', 'update'],
  }),
  manager: Object.freeze({
    products: ['read'],
    productVariants: ['read'],
  }),
  finance: Object.freeze({
    products: ['read'],
    productVariants: ['read'],
  }),
  admin: Object.freeze({
    products: ['read', 'create', 'update', 'delete'],
    productVariants: ['read', 'create', 'update', 'delete'],
  }),
});

export function hasPermission(role, resource, action) {
  return ROLE_PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
}

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || {};
}

export { ROLE_PERMISSIONS };
