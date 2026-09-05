import { driver } from 'driver.js';

const TOUR_STORAGE_KEY = 'dealflow360_tour_completed';

const waitForElement = (selector, timeout = 2500) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const find = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        reject(new Error(`Tour target not found: ${selector}`));
        return;
      }
      window.requestAnimationFrame(find);
    };
    find();
  });

export const hasCompletedProductTour = () =>
  window.localStorage.getItem(TOUR_STORAGE_KEY) === 'true';

export const createProductTour = ({ navigate, isMobile, onStartExploring }) => {
  let tour;
  let isDestroying = false;

  const completeTour = () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  };

  const destroyTour = () => {
    if (isDestroying) return;
    isDestroying = true;
    completeTour();
    tour.destroy();
  };

  const moveToNext = async (route, selector) => {
    if (route) {
      navigate(route);
    }

    try {
      await waitForElement(selector);
      tour.moveNext();
    } catch {
      tour.destroy();
    }
  };

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
    steps: [
      {
        element: '[data-tour="dashboard"]',
        popover: {
          title: 'Dashboard overview',
          description: 'Welcome to DealFlow360 — your intelligent sales operations workspace.',
          side: isMobile ? 'bottom' : 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="quotations"]',
        popover: {
          title: 'Quotations',
          description: 'Create and manage quotations from a single workspace.',
          side: isMobile ? 'bottom' : 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="quotation-builder"]',
        popover: {
          title: 'Quotation builder',
          description: 'Build quotations with products, pricing and customer-specific rules.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="discount"]',
        popover: {
          title: 'Discount governance',
          description: 'Apply discounts while DealFlow360 automatically evaluates discount governance.',
          side: isMobile ? 'top' : 'left',
          align: 'start',
        },
      },
      {
        element: '[data-tour="risk"]',
        popover: {
          title: 'Risk score',
          description: 'Blended risk analysis identifies discount violations and determines whether approval is required.',
          side: isMobile ? 'bottom' : 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="approval"]',
        popover: {
          title: 'Approval workflow',
          description: 'Quotes requiring approval are automatically routed to the appropriate approver.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="fulfillment"]',
        popover: {
          title: 'Fulfillment',
          description: 'Orders can be intelligently split across warehouses based on available stock.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="billing"]',
        popover: {
          title: 'Billing and subscriptions',
          description: 'Manage one-time and recurring billing from the same sales workflow.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="customer-portal"]',
        popover: {
          title: 'Customer portal',
          description: 'Customers can securely review and negotiate quotations through their own restricted portal.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="deal-health"]',
        popover: {
          title: 'Deal health',
          description: 'Monitor stalled deals, anomalies and potential deal slippage.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="dashboard"]',
        popover: {
          title: 'You are ready',
          description: "You're ready to explore DealFlow360 × AETHER.",
          side: isMobile ? 'bottom' : 'right',
          align: 'start',
        },
      },
    ],
    onNextClick: async () => {
      const index = tour.getActiveIndex();
      const transitions = {
        1: ['quotation-builder', '[data-tour="quotation-builder"]'],
        4: ['approvals', '[data-tour="approval"]'],
        5: ['fulfillment', '[data-tour="fulfillment"]'],
        6: ['subscriptions', '[data-tour="billing"]'],
        7: ['customer-portal', '[data-tour="customer-portal"]'],
        8: ['deal-health', '[data-tour="deal-health"]'],
        9: ['dashboard', '[data-tour="dashboard"]'],
      };
      const transition = transitions[index];
      if (transition) {
        await moveToNext(...transition);
        return;
      }
      tour.moveNext();
    },
    onPrevClick: async () => {
      const index = tour.getActiveIndex();
      const transitions = {
        5: ['quotation-builder', '[data-tour="risk"]'],
        6: ['approvals', '[data-tour="approval"]'],
        7: ['fulfillment', '[data-tour="fulfillment"]'],
        8: ['subscriptions', '[data-tour="billing"]'],
        9: ['customer-portal', '[data-tour="customer-portal"]'],
        10: ['deal-health', '[data-tour="deal-health"]'],
      };
      const transition = transitions[index];
      if (transition) {
        navigate(transition[0]);
        await waitForElement(transition[1]).catch(() => null);
        tour.movePrevious();
        return;
      }
      tour.movePrevious();
    },
    onCloseClick: () => {
      destroyTour();
    },
    onDestroyStarted: () => {
      destroyTour();
    },
    onDestroyed: onStartExploring,
  });

  return tour;
};
