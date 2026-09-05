import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import SalesDashboard from './screens/SalesDashboard';
import QuotationsKanban from './screens/QuotationsKanban';
import QuotationBuilder from './screens/QuotationBuilder';
import ApprovalsHub from './screens/ApprovalsHub';
import FulfillmentHub from './screens/FulfillmentHub';
import SubscriptionsHub from './screens/SubscriptionsHub';
import InvoicesHub from './screens/InvoicesHub';
import DealHealthDashboard from './screens/DealHealthDashboard';
import ReportingDashboard from './screens/ReportingDashboard';
import ProductCatalog from './screens/ProductCatalog';
import ProductDetail from './screens/ProductDetail';
import DiscountConfig from './screens/DiscountConfig';
import CustomerPortal from './screens/CustomerPortal';
import LoginScreen from './screens/LoginScreen';

import { INITIAL_QUOTATIONS } from './data/mockData';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('login');
  const [userRole, setUserRole] = useState('rep');
  const [currentUser, setCurrentUser] = useState({
    name: 'Marcus Vance',
    email: 'marcus.vance@dealflow360.io',
    role: 'rep',
  });
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [quotations, setQuotations] = useState(INITIAL_QUOTATIONS);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Track scroll for utility bar shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
    // Don't scroll to top on mobile - let content scroll naturally
    if (window.innerWidth >= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (window.innerWidth < 768) {
      setMobileMenuOpen(false);
    }
  };

  const handleSelectQuotation = (quote) => {
    setSelectedQuotation(quote);
    handleTabChange('quotation-builder');
  };

  const handleNewQuotation = () => {
    setSelectedQuotation(null);
    handleTabChange('quotation-builder');
  };

  const handleSaveDraft = (quote) => {
    setQuotations((prev) => {
      const idx = prev.findIndex((q) => q.id === quote.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...quote };
        return copy;
      }
      return [quote, ...prev];
    });
    showToast(`Quotation ${quote.id} saved to Drafts.`);
    handleTabChange('quotations');
  };

  const handleSubmitApproval = (quote) => {
    const updated = {
      ...quote,
      status: 'pending_approval',
      stage: 'Sales Manager Review',
      assignedTo: currentUser.name,
      createdAt: new Date().toISOString().slice(0, 10),
      auditTrails: [
        {
          user: `${currentUser.name} (${userRole.toUpperCase()})`,
          action: 'Submitted Quotation for Governance Review',
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          note: `Risk score ${quote.blended_risk_score}/100. Dual signoff required: ${
            quote.requiresFinance ? 'YES' : 'NO'
          }.`,
        },
      ],
    };

    setQuotations((prev) => {
      const idx = prev.findIndex((q) => q.id === quote.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });

    showToast(`Quotation ${quote.id} submitted for policy approval!`);
    handleTabChange('approvals');
  };

  const handleUpdateQuotationStatus = (quoteId, newStatus, newStage, newAudit) => {
    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          return {
            ...q,
            status: newStatus,
            stage: newStage,
            auditTrails: [newAudit, ...(q.auditTrails || [])],
          };
        }
        return q;
      })
    );
    showToast(`Deal ${quoteId} updated to ${newStatus.toUpperCase()}.`);
  };

  const pendingApprovalsCount = quotations.filter(
    (q) => q.status === 'pending_approval'
  ).length;

  const isAuthScreen = activeTab === 'login';
  const isPortalScreen = activeTab === 'customer-portal';

  // Compute sidebar width for content margin
  const getSidebarWidth = () => {
    if (window.innerWidth < 768) return 0;
    if (window.innerWidth < 1024) return 64; // w-16
    return 260; // w-[260px]
  };

  return (
    <div className="min-h-screen bg-surface-base canvas-dot-bg text-text-primary selection:bg-accent-blue selection:text-surface-base font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-20 right-6 z-50"
        >
          <div className="bg-surface-card border border-accent-blue/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-status-live"
            />
            <span className="font-mono-tag text-xs">{toastMessage}</span>
          </div>
        </motion.div>
      )}

      {/* Navbar Sidebar */}
      {!isAuthScreen && !isPortalScreen && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          userRole={userRole}
          setUserRole={(role) => {
            setUserRole(role);
            if (role === 'customer') {
              handleTabChange('customer-portal');
            } else {
              showToast(`Switched active role perspective to ${role.toUpperCase()}`);
            }
          }}
          pendingApprovalsCount={pendingApprovalsCount}
          onNewQuotation={handleNewQuotation}
          currentUser={currentUser}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ease-out ${isAuthScreen || isPortalScreen ? 'ml-0' : ''}`}
        style={{
          marginLeft: isAuthScreen || isPortalScreen ? 0 : getSidebarWidth(),
        }}
      >
        {/* Sticky Utility Bar */}
        {!isAuthScreen && !isPortalScreen && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky top-0 z-30 bg-surface-card/80 backdrop-blur-xl border-b border-border-subtle transition-all duration-300"
            style={{ boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none' }}
          >
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md hidden sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search deals, customers, products..."
                  className="w-full bg-surface-interactive border border-border-subtle rounded-full pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-blue"
                />
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <button className="relative w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white hover:border-accent-blue transition-all">
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-warning flex items-center justify-center font-mono text-[9px] font-bold text-white">
                    3
                  </span>
                </button>

                {/* Pending Approvals Live Pill */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTabChange('approvals')}
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-warning/15 border border-status-warning/40 text-status-warning font-mono-tag text-xs font-semibold"
                >
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-status-live"
                  />
                  <span>{pendingApprovalsCount} PENDING APPROVALS</span>
                </motion.button>

                {/* Mobile Menu Button - only on tablet/desktop when sidebar is icon-only */}
                {window.innerWidth >= 768 && window.innerWidth < 1024 && (
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[24px]">menu</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Page Content with AnimatePresence */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              {activeTab === 'login' && (
                <LoginScreen
                  onLoginSuccess={({ email, role, name }) => {
                    setCurrentUser({ email, role, name });
                    setUserRole(role);
                    handleTabChange('dashboard');
                    showToast(`Authenticated as ${name} (${role})`);
                  }}
                />
              )}

              {activeTab === 'dashboard' && (
                <SalesDashboard
                  onNavigate={handleTabChange}
                  quotations={quotations}
                  pendingApprovalsCount={pendingApprovalsCount}
                />
              )}

              {activeTab === 'quotations' && (
                <QuotationsKanban
                  quotations={quotations}
                  onSelectQuotation={handleSelectQuotation}
                  onNewQuotation={handleNewQuotation}
                />
              )}

              {activeTab === 'quotation-builder' && (
                <QuotationBuilder
                  initialQuotation={selectedQuotation}
                  onSaveDraft={handleSaveDraft}
                  onSubmitApproval={handleSubmitApproval}
                  onBack={() => handleTabChange('quotations')}
                />
              )}

              {activeTab === 'approvals' && (
                <ApprovalsHub
                  quotations={quotations}
                  onUpdateQuotationStatus={handleUpdateQuotationStatus}
                />
              )}

              {activeTab === 'fulfillment' && <FulfillmentHub />}

              {activeTab === 'subscriptions' && <SubscriptionsHub />}

              {activeTab === 'invoices' && <InvoicesHub />}

              {activeTab === 'deal-health' && (
                <DealHealthDashboard onNavigate={handleTabChange} />
              )}

              {activeTab === 'reports' && <ReportingDashboard />}

              {activeTab === 'products' && (
                <ProductCatalog
                  onSelectProduct={(prod) => {
                    setSelectedProduct(prod);
                    handleTabChange('product-detail');
                  }}
                  onNewProduct={() => {
                    setSelectedProduct(null);
                    handleTabChange('product-detail');
                  }}
                />
              )}

              {activeTab === 'product-detail' && (
                <ProductDetail
                  product={selectedProduct}
                  onBack={() => handleTabChange('products')}
                  onSave={(updated) => {
                    setQuotations((prev) => {
                      const idx = prev.findIndex((p) => p.id === updated.id);
                      if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = updated;
                        return copy;
                      }
                      return [updated, ...prev];
                    });
                    showToast(`Product SKU ${updated.name} updated.`);
                    handleTabChange('products');
                  }}
                />
              )}

              {activeTab === 'discounts' && <DiscountConfig />}

              {activeTab === 'customer-portal' && (
                <CustomerPortal
                  onReturnToInternal={() => {
                    setUserRole('rep');
                    handleTabChange('dashboard');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Footer */}
        <footer className="w-full max-w-[1200px] mx-auto px-6 py-6 border-t border-border-subtle/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <img src="/brand-mark.svg" alt="DealFlow360" className="h-5 w-auto opacity-70" />
            <span className="font-mono">DealFlow360 × AETHER Dark Bento Design System</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <button
              onClick={() => handleTabChange('login')}
              className="hover:text-white transition-colors"
            >
              Auth Screen
            </button>
            <span>•</span>
            <button
              onClick={() => handleTabChange('customer-portal')}
              className="hover:text-accent-blue transition-colors"
            >
              Customer Portal View
            </button>
            <span>•</span>
            <span className="text-status-live flex items-center gap-1">
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-status-live"
              />
              Socket.IO Active
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}