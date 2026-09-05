import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { USER_ROLES } from '../data/mockData';
import Tag from './Tag';

export default function Navbar({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  pendingApprovalsCount = 14,
  onNewQuotation,
  currentUser,
  mobileMenuOpen,
  setMobileMenuOpen,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'quotations', label: 'Quotations', icon: 'description' },
    { id: 'approvals', label: 'Approvals', icon: 'gavel', badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null },
    { id: 'fulfillment', label: 'Fulfillment', icon: 'local_shipping' },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'autorenew' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
    { id: 'deal-health', label: 'Deal Health', icon: 'monitor_heart' },
    { id: 'reports', label: 'Reports', icon: 'analytics' },
    { id: 'products', label: 'Product', icon: 'inventory_2' },
    { id: 'discounts', label: 'Discounts', icon: 'tune' },
    { id: 'customer-portal', label: 'Portal', icon: 'public', isPortal: true },
  ];

  const getIcon = (name) => {
    const icons = {
      dashboard: 'dashboard', description: 'description', gavel: 'gavel',
      local_shipping: 'local_shipping', autorenew: 'autorenew', receipt_long: 'receipt_long',
      monitor_heart: 'monitor_heart', analytics: 'analytics', inventory_2: 'inventory_2',
      tune: 'tune', public: 'public',
    };
    return icons[name] || 'dashboard';
  };

  // Track scroll for potential future use (sidebar shadow, etc.)
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Mobile Hamburger Button (Fixed Top Left) - only shown when sidebar is collapsed */}
      {window.innerWidth < 768 && !mobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white hover:border-accent-blue transition-all shadow-lg"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      )}

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {mobileMenuOpen && window.innerWidth < 768 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fixed Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-surface-card border-r border-border-subtle transition-all duration-300 ease-out ${
          window.innerWidth < 768
            ? 'w-72 translate-x-[-100%] md:hidden'
            : window.innerWidth < 1024
            ? 'w-16'
            : 'w-[260px]'
        } ${mobileMenuOpen && window.innerWidth < 768 ? 'translate-x-0' : ''}`}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center justify-center px-4 py-6 border-b border-border-subtle min-h-[80px]">
          {window.innerWidth >= 1024 && (
            <span className="font-display-hero text-2xl font-extrabold tracking-[-1px] text-text-primary select-none whitespace-nowrap">
              DealFlow360
            </span>
          )}
          {window.innerWidth < 1024 && (
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
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) setMobileMenuOpen(false);
                }}
                className={`relative flex items-center gap-3 px-3 py-3 rounded-full cursor-pointer transition-all duration-200 min-h-[44px] ${
                  isActive
                    ? 'text-text-primary z-10'
                    : 'text-text-secondary hover:text-text-primary'
                } ${window.innerWidth < 1024 ? 'justify-center' : ''}`}
                title={window.innerWidth < 1024 ? item.label : undefined}
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
                {!window.innerWidth < 1024 && (
                  <span className="relative z-10 font-medium text-sm whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {item.badge && !window.innerWidth < 1024 && (
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
          {window.innerWidth >= 1024 ? (
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="w-full h-full rounded-full bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center font-mono text-xs font-bold text-accent-blue">
                  {currentUser?.name?.slice(0, 2).toUpperCase() || 'MV'}
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
                  {currentUser?.name || 'Marcus Vance'}
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
                  {currentUser?.name?.slice(0, 2).toUpperCase() || 'MV'}
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

          {/* Role Selector (Desktop/Tablet) */}
          {window.innerWidth >= 640 && (
            <div className="mt-4">
              <label className="block font-label-caps text-[10px] uppercase text-text-secondary mb-2">
                Active Role
              </label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full bg-surface-interactive border border-border-subtle rounded-xl px-3 py-2 text-sm text-accent-blue font-mono font-medium focus:outline-none focus:border-accent-blue appearance-none cursor-pointer"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role} className="bg-surface-card text-white">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* New Quotation CTA (Desktop) */}
          {window.innerWidth >= 1024 && onNewQuotation && (
            <button
              onClick={onNewQuotation}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white text-surface-base text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Quotation</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}