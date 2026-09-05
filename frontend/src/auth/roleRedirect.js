const ROLE_DASHBOARDS = {
  customer: '#customer/dashboard',
  rep: '#rep/dashboard',
  manager: '#manager/dashboard',
  finance: '#finance/dashboard',
  admin: '#admin/dashboard',
};

export function roleBasedRedirect(role) {
  return ROLE_DASHBOARDS[role] || '#login';
}
