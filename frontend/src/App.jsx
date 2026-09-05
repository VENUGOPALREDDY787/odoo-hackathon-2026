import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import useViewport from './hooks/useViewport';
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
import ProfileScreen from './screens/ProfileScreen';
import { clearSession, createProduct, createProductVariant, deleteProduct, recoverSession, signIn, signUp, updateProduct } from './auth/authApi';
import { createProductTour, hasCompletedProductTour } from './tour/productTour';

import { INITIAL_QUOTATIONS } from './data/mockData';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] },
};

const ROLE_TABS = {
  customer: ['dashboard', 'quotations', 'customer-portal', 'invoices', 'profile'],
  rep: ['dashboard', 'quotations', 'quotation-builder', 'products', 'product-detail', 'fulfillment', 'subscriptions', 'invoices', 'deal-health', 'profile'],
  manager: ['dashboard', 'quotations', 'approvals', 'deal-health', 'reports', 'profile'],
  finance: ['dashboard', 'approvals', 'subscriptions', 'invoices', 'reports', 'profile'],
  admin: ['dashboard', 'products', 'product-detail', 'discounts', 'approvals', 'reports', 'profile'],
};

export default function App() {
  const { t } = useTranslation();
  const viewport = useViewport();
  const [activeTab, setActiveTab] = useState('login');
  const [authStatus, setAuthStatus] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return (
      localStorage.getItem('dealflow360-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    );
  });

  const [quotations, setQuotations] = useState(INITIAL_QUOTATIONS);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productReloadKey, setProductReloadKey] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const tourRef = useRef(null);
  const autoTourStartedRef = useRef(false);

  useEffect(() => {
    recoverSession().then((user) => {
      setCurrentUser(user);
      setAuthStatus(user ? 'authenticated' : 'anonymous');
      if (user) {
        const requestedTab = window.location.hash.replace('#', '');
        const allowedTabs = ROLE_TABS[user.role] || [];
        const nextTab = requestedTab && allowedTabs.includes(requestedTab) ? requestedTab : 'dashboard';
        window.location.hash = `#${nextTab}`;
        setActiveTab(nextTab);
      } else {
        window.location.hash = '#login';
        setActiveTab('login');
      }
    });
  }, []);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        if (authStatus !== 'authenticated') {
          setActiveTab('login');
          return;
        }
        const allowedTabs = ROLE_TABS[currentUser?.role] || [];
        setActiveTab(allowedTabs.includes(hash) ? hash : 'dashboard');
        if (!allowedTabs.includes(hash)) {
          window.location.hash = '#dashboard';
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [authStatus, currentUser]);

  // Track scroll for utility bar shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    localStorage.setItem('dealflow360-theme', theme);
  }, [theme]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTabChange = (tab) => {
    if (authStatus !== 'authenticated') {
      setActiveTab('login');
      window.location.hash = 'login';
      return;
    }
    const allowedTabs = ROLE_TABS[currentUser?.role] || [];
    if (!allowedTabs.includes(tab)) {
      showToast('You are not authorized to access that area.');
      tab = 'dashboard';
    }
    setActiveTab(tab);
    window.location.hash = tab;
    // Don't scroll to top on mobile - let content scroll naturally
    if (!viewport.isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (viewport.isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setAuthStatus('anonymous');
    setMobileMenuOpen(false);
    setActiveTab('login');
    window.location.hash = 'login';
    showToast('You have been signed out.');
  };

  const startProductTour = () => {
    if (tourRef.current) {
      tourRef.current.destroy();
      tourRef.current = null;
    }

    if (activeTab !== 'dashboard') {
      handleTabChange('dashboard');
    }

    window.setTimeout(() => {
      const tour = createProductTour({
        navigate: handleTabChange,
        isMobile: viewport.isMobile,
        onStartExploring: () => {
          tourRef.current = null;
        },
      });
      tourRef.current = tour;
      tour.drive();
    }, activeTab === 'dashboard' ? 0 : 180);
  };

  useEffect(() => {
    if (
      activeTab !== 'dashboard' ||
      viewport.isMobile ||
      hasCompletedProductTour() ||
      autoTourStartedRef.current
    ) {
      return undefined;
    }

    autoTourStartedRef.current = true;
    const timeoutId = window.setTimeout(startProductTour, 700);
    return () => window.clearTimeout(timeoutId);
    // The tour should auto-start once for the first dashboard visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSelectQuotation = (quote) => {
    setSelectedQuotation(quote);
    handleTabChange('quotation-builder');
  };

  const handleNewQuotation = () => {
    setSelectedQuotation(null);
    handleTabChange('quotation-builder');
  };

  const handleSaveProduct = async (product) => {
    try {
      const payload = {
        sku: product.sku,
        name: product.name,
        category: product.category,
        description: product.description,
        base_price: product.price,
        unit_of_measure: product.unit,
        is_recurring_eligible: product.isSubscription,
        is_active: true,
      };
      const response = selectedProduct?.id
        ? await updateProduct(selectedProduct.id, payload)
        : await createProduct(payload);
      const savedProduct = response.data;

      if (!selectedProduct?.id && product.variants?.length) {
        await Promise.all(product.variants.map((variant, index) => createProductVariant(savedProduct.id, {
          sku: `${product.sku}-V${index + 1}`,
          name: variant.attribute || `Variant ${index + 1}`,
          attributes: { values: variant.values || [] },
          price_adjustment: variant.extraPrice || 0,
        })));
      }

      setProductReloadKey((value) => value + 1);
      showToast(`Product SKU ${savedProduct.sku} saved to the catalog.`);
      handleTabChange('products');
    } catch (error) {
      showToast(error.message);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}? This will hide it from the catalog.`)) return;
    try {
      await deleteProduct(product.id);
      setProductReloadKey((value) => value + 1);
      showToast(`Product SKU ${product.sku} deleted.`);
    } catch (error) {
      showToast(error.message);
    }
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
      assignedTo: currentUser.fullName || currentUser.full_name || currentUser.name,
      createdAt: new Date().toISOString().slice(0, 10),
      auditTrails: [
        {
          user: `${currentUser.fullName || currentUser.full_name || currentUser.name} (${currentUser.role.toUpperCase()})`,
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

  const isAuthScreen = authStatus !== 'authenticated' || activeTab === 'login';
  const isPortalScreen = activeTab === 'customer-portal';

  // Compute sidebar width for content margin
  const getSidebarWidth = () => {
    if (viewport.isMobile) return 0;
    if (viewport.isTablet) return 72;
    return 260;
  };

  if (authStatus === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-surface-base canvas-dot-bg text-text-secondary font-mono-tag">Checking authentication...</div>;
  }

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
          <div className="bg-surface-card border border-accent-blue/50 text-text-primary px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
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
      {authStatus === 'authenticated' && !isPortalScreen && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          pendingApprovalsCount={pendingApprovalsCount}
          onNewQuotation={handleNewQuotation}
          currentUser={currentUser}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          viewport={viewport}
          onLogout={handleLogout}
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
        {authStatus === 'authenticated' && !isPortalScreen && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky top-0 z-30 bg-surface-card/80 backdrop-blur-xl border-b border-border-subtle transition-all duration-300"
            style={{ boxShadow: scrolled ? '0 10px 30px rgb(0 0 0 / 0.22)' : 'none' }}
          >
            <div className="max-w-max-width mx-auto px-page-padding-mobile pl-16 md:px-page-padding py-3 flex items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md hidden sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
                  search
                </span>
                <input
                  type="text"
                  placeholder={t('navigation.searchPlaceholder', 'Search deals, customers, products...')}
                  className="w-full bg-surface-interactive border border-border-subtle rounded-full pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-blue"
                />
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startProductTour}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-subtle bg-surface-interactive px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-accent-blue hover:text-text-primary"
                  aria-label="Start product tour"
                >
                  <span className="material-symbols-outlined text-[18px]">help</span>
                  <span className="hidden sm:inline">Product Tour</span>
                </button>

                {/* Multilingual Switcher */}
                <LanguageSwitcher />

                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                />

                {/* Notification Bell */}
                <button
                  type="button"
                  aria-label={t('navigation.notifications', 'Notifications')}
                  className="relative w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-blue transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-warning flex items-center justify-center font-mono text-[9px] font-bold text-surface-base">
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
                  <span>{pendingApprovalsCount} {t('status.pending_approval', 'PENDING APPROVALS').toUpperCase()}</span>
                </motion.button>

                {/* Mobile Menu Button - only on tablet/desktop when sidebar is icon-only */}
                {viewport.isTablet && (
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label={t('navigation.openMenu', 'Open navigation menu')}
                    className="w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary"
                  >
                    <span className="material-symbols-outlined text-[24px]">menu</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Page Content with AnimatePresence */}
        <div className="max-w-max-width mx-auto px-page-padding-mobile md:px-page-padding py-8 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              {authStatus !== 'checking' && authStatus !== 'authenticated' && (
                <LoginScreen
                  error={authError}
                  loading={authStatus === 'authenticating'}
                  onLoginSuccess={async ({ email, password }) => {
                    setAuthError('');
                    setAuthStatus('authenticating');
                    try {
                      const user = await signIn(email, password);
                      setCurrentUser(user);
                      setAuthStatus('authenticated');
                      window.location.hash = '#dashboard';
                      setActiveTab('dashboard');
                    } catch (error) {
                      setAuthError(error.message);
                      setAuthStatus('anonymous');
                    }
                  }}
                  onSignup={async (payload) => {
                    if (payload.error) {
                      setAuthError(payload.error);
                      return;
                    }
                    setAuthError('');
                    setAuthStatus('authenticating');
                    try {
                      const user = await signUp(payload.name, payload.email, payload.password);
                      setCurrentUser(user);
                      setAuthStatus('authenticated');
                      window.location.hash = '#dashboard';
                      setActiveTab('dashboard');
                    } catch (error) {
                      setAuthError(error.message);
                      setAuthStatus('anonymous');
                    }
                  }}
                />
              )}

              {authStatus === 'authenticated' && activeTab === 'dashboard' && currentUser?.role === 'customer' && (
                <CustomerPortal onReturnToInternal={() => handleTabChange('dashboard')} />
              )}

              {authStatus === 'authenticated' && activeTab === 'dashboard' && currentUser?.role !== 'customer' && (
                <SalesDashboard
                  onNavigate={handleTabChange}
                  quotations={quotations}
                  pendingApprovalsCount={pendingApprovalsCount}
                />
              )}

              {authStatus === 'authenticated' && activeTab === 'profile' && (
                <ProfileScreen
                  user={currentUser}
                  onUserUpdated={(user) => setCurrentUser(user)}
                  onLogout={handleLogout}
                  showToast={showToast}
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
                  reloadKey={productReloadKey}
                  canDelete={currentUser?.role === 'admin'}
                  onDeleteProduct={handleDeleteProduct}
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
                  onSave={handleSaveProduct}
                />
              )}

              {activeTab === 'discounts' && <DiscountConfig />}

              {activeTab === 'customer-portal' && (
                <CustomerPortal
                  onReturnToInternal={() => {
                    handleTabChange('dashboard');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Footer */}
        <footer className="w-full max-w-max-width mx-auto px-page-padding-mobile md:px-page-padding py-6 border-t border-border-subtle/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <img src="/brand-mark.svg" alt="DealFlow360" className="h-5 w-auto opacity-70" />
            <span className="font-mono">DealFlow360 × AETHER Dark Bento Design System</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <button
              onClick={() => handleTabChange('login')}
              className="hover:text-text-primary transition-colors"
            >
              {t('navigation.login', 'Auth Screen')}
            </button>
            <span>•</span>
            <button
              onClick={() => handleTabChange('customer-portal')}
              className="hover:text-accent-blue transition-colors"
            >
              {t('navigation.customerPortal', 'Customer Portal View')}
            </button>
            <span>•</span>
            <span className="text-status-live flex items-center gap-1">
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-status-live"
              />
              Socket.IO {t('common.live', 'Active')}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
