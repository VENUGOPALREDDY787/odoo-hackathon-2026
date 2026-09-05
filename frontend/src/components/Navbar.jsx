import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Tag from './Tag';

export default function Navbar({
  activeTab,
  setActiveTab,
  pendingApprovalsCount = 14,
  onNewQuotation,
  currentUser,
  mobileMenuOpen,
  setMobileMenuOpen,
  viewport,
  onLogout,
}) {
  const { t } = useTranslation();
  const role = currentUser?.role || 'customer';
  const displayName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'Account user';
  const navByRole = {
    customer: [
      ['dashboard', 'Dashboard', 'dashboard'], ['quotations', 'My Quotations', 'description'],
      ['customer-portal', 'Negotiations', 'public'], ['invoices', 'Invoices', 'receipt_long'],
    ],
    rep: [
      ['dashboard', 'Dashboard', 'dashboard'], ['quotations', 'Quotations', 'description'],
      ['products', 'Products', 'inventory_2'], ['fulfillment', 'Fulfillment', 'local_shipping'],
      ['subscriptions', 'Subscriptions', 'autorenew'], ['invoices', 'Invoices', 'receipt_long'], ['deal-health', 'Deal Health', 'monitor_heart'],
    ],
    manager: [
      ['dashboard', 'Dashboard', 'dashboard'], ['approvals', 'Approvals', 'gavel'], ['quotations', 'Quotations', 'description'],
      ['deal-health', 'Deal Health', 'monitor_heart'], ['reports', 'Reports', 'analytics'],
    ],
    finance: [
      ['dashboard', 'Dashboard', 'dashboard'], ['approvals', 'Approvals', 'gavel'], ['subscriptions', 'Subscriptions', 'autorenew'],
      ['invoices', 'Invoices', 'receipt_long'], ['reports', 'Reports', 'analytics'],
    ],
    admin: [
      ['dashboard', 'Dashboard', 'dashboard'], ['products', 'Products', 'inventory_2'], ['discounts', 'Discount Setup', 'tune'],
      ['approvals', 'Approval Setup', 'gavel'], ['reports', 'Reports', 'analytics'],
    ],
  };
  const navItems = (navByRole[role] || navByRole.customer).map(([id, label, icon]) => ({
    id,
    label: t(`navigation.${id}`, label),
    icon,
    badge: id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
  }));

  const getIcon = (name) => {
    const icons = {
      dashboard: 'dashboard', description: 'description', gavel: 'gavel',
      local_shipping: 'local_shipping', autorenew: 'autorenew', receipt_long: 'receipt_long',
      monitor_heart: 'monitor_heart', analytics: 'analytics', inventory_2: 'inventory_2',
      tune: 'tune', public: 'public',
    };
    return icons[name] || 'dashboard';
  };

  return (
    <>
      {/* Mobile Hamburger Button (Fixed Top Left) - only shown when sidebar is collapsed */}
      {viewport.isMobile && !mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-blue transition-all shadow-lg"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      )}

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {mobileMenuOpen && viewport.isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-surface-base/75 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fixed Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-surface-card border-r border-border-subtle transition-all duration-300 ease-out ${
          viewport.isMobile
            ? `w-72 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
            : !viewport.isDesktop
            ? 'w-[72px]'
            : 'w-[260px]'
          }`}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center justify-center px-4 py-6 border-b border-border-subtle min-h-[80px]">
          {viewport.isDesktop && (
            <span className="font-display-hero text-2xl font-extrabold tracking-[-1px] text-text-primary select-none whitespace-nowrap">
              DealFlow360
            </span>
          )}
          {!viewport.isDesktop && (
            <span className="font-display-hero text-xl font-extrabold tracking-[-1px] text-text-primary select-none">
              DF
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                data-tour={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (viewport.isMobile) setMobileMenuOpen(false);
                }}
                className={`relative flex items-center gap-3 px-3 py-3 rounded-full cursor-pointer transition-all duration-200 min-h-[44px] ${
                  isActive
                    ? 'text-text-primary z-10'
                    : 'text-text-secondary hover:text-text-primary'
                } ${viewport.isMobile ? 'justify-start' : !viewport.isDesktop ? 'justify-center' : ''}`}
                title={!viewport.isDesktop ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute inset-y-1 left-0 right-0 rounded-full bg-accent-blue pointer-events-none"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 material-symbols-outlined text-[22px] flex-shrink-0 ${
                    isActive ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {getIcon(item.icon)}
                </span>
                {(viewport.isMobile || viewport.isDesktop) && (
                  <span className="relative z-10 font-medium text-sm whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {item.badge && (viewport.isMobile || viewport.isDesktop) && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-status-warning/20 text-status-warning"
                  >
                    {item.badge}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Section - Pinned at Bottom */}
        <div className="p-4 border-t border-border-subtle">
          {viewport.isDesktop ? (
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="w-full h-full rounded-full bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center font-mono text-xs font-bold text-accent-blue">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-live ring-2 ring-surface-card">
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-full h-full rounded-full bg-status-live"
                  />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-text-primary truncate">
                  {displayName}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Tag variant="blue" pill className="text-[10px]">
                    {currentUser?.role?.toUpperCase() || 'REP'}
                  </Tag>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="relative w-9 h-9">
                <div className="w-full h-full rounded-full bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center font-mono text-xs font-bold text-accent-blue">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-live ring-2 ring-surface-card">
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-full h-full rounded-full bg-status-live"
                  />
                </span>
              </div>
            </div>
          )}

          <button type="button" onClick={() => setActiveTab('profile')} className="mt-4 w-full text-left text-sm text-text-secondary hover:text-text-primary transition-colors">View Profile</button>
          <button type="button" onClick={onLogout} className="mt-3 w-full text-left text-sm text-status-danger hover:underline">Logout</button>

          {/* New Quotation CTA (Desktop) */}
          {viewport.isDesktop && onNewQuotation && (
            <button
              type="button"
              onClick={onNewQuotation}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-text-primary text-surface-base text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_12px_rgb(var(--text-primary)/0.18)]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>{t('navigation.newQuotation', 'New Quotation')}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
