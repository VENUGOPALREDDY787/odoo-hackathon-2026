import { driver } from 'driver.js';

const TOUR_STORAGE_KEY = 'dealflow360_tour_completed';

const waitForElement = (selector, timeout = 8000) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const find = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        console.warn(`[Tour] Target not found after ${timeout}ms, skipping: ${selector}`);
        resolve(null);
        return;
      }
      window.requestAnimationFrame(find);
    };
    find();
  });

export const hasCompletedProductTour = (role = 'customer') =>
  window.localStorage.getItem(`${TOUR_STORAGE_KEY}:${role}`) === 'true';

const TOUR_STEPS_BY_ROLE = {
  rep: [
    { id: 'dashboard', element: '[data-tour="dashboard"]', title: 'Dashboard', description: 'Your sales command center — pipeline, metrics, and AI insights at a glance.', side: 'right', align: 'start' },
    { id: 'quotations', element: '[data-tour="quotations"]', title: 'Quotations', description: 'Create, track, and manage all quotations from a single workspace.', side: 'right', align: 'start' },
    { id: 'quotation-builder', element: '[data-tour="quotation-builder"]', title: 'Quotation Builder', description: 'Build professional quotations with products, pricing, and customer-specific rules.', side: 'bottom', align: 'start' },
    { id: 'discount', element: '[data-tour="discount"]', title: 'Discount Governance', description: 'Apply discounts while DealFlow360 automatically evaluates discount governance in real-time.', side: 'left', align: 'start' },
    { id: 'risk', element: '[data-tour="risk"]', title: 'Risk Score', description: 'Blended risk analysis identifies discount violations and determines whether approval is required.', side: 'right', align: 'start' },
    { id: 'approval', element: '[data-tour="approval"]', title: 'Approval Workflow', description: 'Quotes requiring approval are automatically routed to the appropriate approver.', side: 'bottom', align: 'start' },
    { id: 'fulfillment', element: '[data-tour="fulfillment"]', title: 'Fulfillment', description: 'Orders can be intelligently split across warehouses based on available stock.', side: 'bottom', align: 'start' },
    { id: 'billing', element: '[data-tour="billing"]', title: 'Billing & Subscriptions', description: 'Manage one-time and recurring billing from the same sales workflow.', side: 'bottom', align: 'start' },
    { id: 'deal-health', element: '[data-tour="deal-health"]', title: 'Deal Health', description: 'Monitor stalled deals, anomalies, and potential deal slippage with AI-powered insights.', side: 'bottom', align: 'start' },
    { id: 'account', element: '[data-tour="account"]', title: 'Your Account', description: 'Manage your profile, preferences, and security settings.', side: 'left', align: 'start' },
    { id: 'ready', element: '[data-tour="dashboard"]', title: 'You Are Ready', description: "You're ready to explore DealFlow360 × AETHER. Start creating!", side: 'right', align: 'start' },
  ],
  manager: [
    { id: 'dashboard', element: '[data-tour="dashboard"]', title: 'Dashboard', description: 'Executive overview — pipeline health, team performance, and approval queue.', side: 'right', align: 'start' },
    { id: 'approvals', element: '[data-tour="approvals"]', title: 'Approvals Hub', description: 'Review and act on pending approvals — discount overrides, risk exceptions, and finance mandates.', side: 'right', align: 'start' },
    { id: 'approval-detail', element: '[data-tour="approval"]', title: 'Approval Details', description: 'Drill into any approval to see risk breakdown, margin impact, and audit trail.', side: 'bottom', align: 'start' },
    { id: 'quotations', element: '[data-tour="quotations"]', title: 'Quotations Overview', description: 'Monitor all team quotations, filter by stage, and track deal velocity.', side: 'right', align: 'start' },
    { id: 'deal-health', element: '[data-tour="deal-health"]', title: 'Deal Health', description: 'AI-powered anomaly detection for stalled deals, discount anomalies, and fulfillment slippage.', side: 'bottom', align: 'start' },
    { id: 'reports', element: '[data-tour="reports"]', title: 'Reports & BI', description: 'Executive business intelligence — conversion velocity, margin leakage, and rep pacing.', side: 'bottom', align: 'start' },
    { id: 'account', element: '[data-tour="account"]', title: 'Your Account', description: 'Manage your profile, preferences, and security settings.', side: 'left', align: 'start' },
    { id: 'ready', element: '[data-tour="dashboard"]', title: 'You Are Ready', description: "You're ready to lead with DealFlow360 × AETHER.", side: 'right', align: 'start' },
  ],
  finance: [
    { id: 'dashboard', element: '[data-tour="dashboard"]', title: 'Dashboard', description: 'Financial command center — revenue recognition, ARR/MRR, and collections overview.', side: 'right', align: 'start' },
    { id: 'approvals', element: '[data-tour="approvals"]', title: 'Approvals Hub', description: 'Review finance-mandated approvals — dual sign-off required for high-risk deals.', side: 'right', align: 'start' },
    { id: 'subscriptions', element: '[data-tour="billing"]', title: 'Subscriptions', description: 'Manage recurring contracts, license seat expansions, and SLA subscription schedules.', side: 'bottom', align: 'start' },
    { id: 'invoices', element: '[data-tour="invoices"]', title: 'Invoicing Hub', description: 'Generate fiscal invoices, track collection status, and reconcile payments with ERP.', side: 'bottom', align: 'start' },
    { id: 'reports', element: '[data-tour="reports"]', title: 'Reports & BI', description: 'Revenue analytics, discount trends, approval bottlenecks, and financial forecasting.', side: 'bottom', align: 'start' },
    { id: 'account', element: '[data-tour="account"]', title: 'Your Account', description: 'Manage your profile, preferences, and security settings.', side: 'left', align: 'start' },
    { id: 'ready', element: '[data-tour="dashboard"]', title: 'You Are Ready', description: "You're ready to govern with DealFlow360 × AETHER.", side: 'right', align: 'start' },
  ],
  admin: [
    { id: 'dashboard', element: '[data-tour="dashboard"]', title: 'Dashboard', description: 'System administration overview — platform health, user activity, and configuration status.', side: 'right', align: 'start' },
    { id: 'products', element: '[data-tour="products"]', title: 'Product Catalog', description: 'Manage enterprise hardware, SaaS licensing, service bundles, and list prices.', side: 'right', align: 'start' },
    { id: 'discounts', element: '[data-tour="discounts"]', title: 'Discount Setup', description: 'Define threshold rules, automated sign-off matrix, and margin floor protection.', side: 'bottom', align: 'start' },
    { id: 'approvals', element: '[data-tour="approvals"]', title: 'Approval Setup', description: 'Configure approval tiers, escalation rules, and approver assignments.', side: 'bottom', align: 'start' },
    { id: 'reports', element: '[data-tour="reports"]', title: 'Reports', description: 'Platform-wide analytics, audit logs, and system performance metrics.', side: 'bottom', align: 'start' },
    { id: 'account', element: '[data-tour="account"]', title: 'Your Account', description: 'Manage your profile, preferences, and security settings.', side: 'left', align: 'start' },
    { id: 'ready', element: '[data-tour="dashboard"]', title: 'You Are Ready', description: "You're ready to administer DealFlow360 × AETHER.", side: 'right', align: 'start' },
  ],
  customer: [
    { id: 'dashboard', element: '[data-tour="dashboard"]', title: 'Your Dashboard', description: 'Welcome to your customer portal — view active quotations, orders, and invoices.', side: 'bottom', align: 'start' },
    { id: 'quotations', element: '[data-tour="quotations"]', title: 'My Quotations', description: 'Review all commercial offers from your sales team in one place.', side: 'bottom', align: 'start' },
    { id: 'customer-portal', element: '[data-tour="customer-portal"]', title: 'Quotation Details', description: 'View line items, pricing, terms, and negotiate directly from the portal.', side: 'bottom', align: 'start' },
    { id: 'invoices', element: '[data-tour="invoices"]', title: 'Invoices', description: 'Track invoice status, payment history, and download tax invoices.', side: 'bottom', align: 'start' },
    { id: 'account', element: '[data-tour="account"]', title: 'Your Account', description: 'Manage your profile, notification preferences, and security settings.', side: 'left', align: 'start' },
    { id: 'ready', element: '[data-tour="dashboard"]', title: 'You Are Ready', description: "You're ready to collaborate with DealFlow360 × AETHER.", side: 'bottom', align: 'start' },
  ],
};

const ROUTE_MAP = {
  'dashboard': 'dashboard',
  'quotations': 'quotations',
  'quotation-builder': 'quotation-builder',
  'approvals': 'approvals',
  'fulfillment': 'fulfillment',
  'subscriptions': 'subscriptions',
  'billing': 'subscriptions',
  'invoices': 'invoices',
  'customer-portal': 'customer-portal',
  'deal-health': 'deal-health',
  'reports': 'reports',
  'products': 'products',
  'discounts': 'discounts',
  'account': 'profile',
};

export const createProductTour = ({ navigate, isMobile, onStartExploring, role }) => {
  let tour = null;
  let isDestroying = false;
  let currentStepIndex = 0;
  const steps = TOUR_STEPS_BY_ROLE[role] || TOUR_STEPS_BY_ROLE.rep;

  const completeTour = () => {
    window.localStorage.setItem(`${TOUR_STORAGE_KEY}:${role}`, 'true');
  };

  const destroyTour = () => {
    if (isDestroying || !tour) return;
    isDestroying = true;
    completeTour();
    try { tour.destroy(); } catch (e) { console.warn('[Tour] Destroy error:', e); }
    tour = null;
    if (onStartExploring) onStartExploring();
  };

  const moveToStep = async (targetIndex) => {
    if (!tour || targetIndex < 0 || targetIndex >= steps.length) return;

    const targetStep = steps[targetIndex];
    const route = ROUTE_MAP[targetStep.id];

    if (route) {
      navigate(route);
      await new Promise(r => setTimeout(r, 300));
    }

    try {
      const element = await waitForElement(targetStep.element);
      if (element) {
        currentStepIndex = targetIndex;
        tour.moveTo(targetIndex);
      } else {
        if (targetIndex < steps.length - 1) {
          await moveToStep(targetIndex + 1);
        } else {
          destroyTour();
        }
      }
    } catch (e) {
      console.warn('[Tour] Navigation error:', e);
      destroyTour();
    }
  };

  const stepConfigs = steps.map((step, index) => ({
    element: step.element,
    popover: {
      title: step.title,
      description: step.description,
      side: isMobile ? 'bottom' : step.side,
      align: step.align,
    },
    onHighlightStarted: () => {
      currentStepIndex = index;
    },
  }));

  tour = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.72,
    smoothScroll: true,
    stagePadding: isMobile ? 4 : 8,
    stageRadius: 16,
    popoverClass: 'dealflow-tour-popover',
    nextBtnText: 'Next →',
    prevBtnText: 'Previous',
    doneBtnText: 'Start Exploring',
    steps: stepConfigs,
    onNextClick: async () => {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        await moveToStep(nextIndex);
      } else {
        destroyTour();
      }
    },
    onPrevClick: async () => {
      const prevIndex = currentStepIndex - 1;
      if (prevIndex >= 0) {
        await moveToStep(prevIndex);
      }
    },
    onCloseClick: () => {
      destroyTour();
    },
    onDestroyStarted: () => {
      destroyTour();
    },
  });

  return tour;
};