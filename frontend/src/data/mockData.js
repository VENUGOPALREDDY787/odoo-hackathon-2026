// DealFlow360 × AETHER Backend-Accurate Mock Data & Domain Engine

export const USER_ROLES = ['rep', 'manager', 'finance', 'admin', 'customer'];

export const CUSTOMER_TIERS = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
};

export const QUOTATION_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  NEGOTIATION: 'negotiation',
  CONFIRMED: 'confirmed',
};

export const TIER_DISCOUNT_CEILINGS = {
  Bronze: 10,
  Silver: 15,
  Gold: 25,
};

export const CATEGORY_DISCOUNT_CEILINGS = {
  'Enterprise Hardware': 12,
  'SaaS Licenses': 20,
  'Professional Services': 15,
  'Cloud Infrastructure': 18,
  'Support & Maintenance': 25,
};

export const APPROVAL_TIER_RULES = [
  { maxDiscount: 10, requiredApprover: 'none', label: 'Auto-Approved (Within Limits)' },
  { maxDiscount: 20, requiredApprover: 'manager', label: 'Sales Manager Approval' },
  { maxDiscount: 100, requiredApprover: 'finance', label: 'Sales Manager + Finance Dual Approval' },
];

export const INITIAL_PRODUCTS = [
  {
    id: 'prod-01',
    name: 'AETHER Edge Compute Node X4',
    category: 'Enterprise Hardware',
    price: 14500,
    unit: 'node',
    tax: 8.5,
    status: 'Active',
    isSubscription: false,
    description: 'High-density multi-tenant edge processing cluster with hardware crypto acceleration.',
    variants: [
      { attribute: 'RAM', values: ['64GB ECC', '128GB ECC', '256GB ECC'], extraPrice: 1200 },
      { attribute: 'Storage', values: ['2TB NVMe Gen5', '8TB NVMe Enterprise'], extraPrice: 2400 },
    ],
    pricelists: [
      { tier: 'Bronze', currency: 'USD', priceRule: 'List Price ($14,500)' },
      { tier: 'Silver', currency: 'USD', priceRule: '4% Volume Rebate ($13,920)' },
      { tier: 'Gold', currency: 'USD', priceRule: '8% Tier Preferred ($13,340)' },
    ],
  },
  {
    id: 'prod-02',
    name: 'DealFlow360 Enterprise Core License',
    category: 'SaaS Licenses',
    price: 36000,
    unit: 'instance/yr',
    tax: 0.0,
    status: 'Active',
    isSubscription: true,
    recurringCycle: 'yearly',
    description: 'Autonomous pricing governance, audit trail pipeline, and real-time risk orchestration.',
    variants: [
      { attribute: 'SLA Tier', values: ['Standard (99.5%)', 'Mission-Critical (99.99%)'], extraPrice: 6000 },
      { attribute: 'Dedicated Pod', values: ['Shared VPC', 'Isolated Sovereign Pod'], extraPrice: 12000 },
    ],
    pricelists: [
      { tier: 'Bronze', currency: 'USD', priceRule: 'Standard Annual Rate' },
      { tier: 'Silver', currency: 'USD', priceRule: 'Tier Credit Applied ($34,200)' },
      { tier: 'Gold', currency: 'USD', priceRule: 'Contractual Partner Cap ($31,500)' },
    ],
  },
  {
    id: 'prod-03',
    name: 'Autonomous Governance AI Copilot',
    category: 'SaaS Licenses',
    price: 4800,
    unit: 'seat/yr',
    tax: 0.0,
    status: 'Active',
    isSubscription: true,
    recurringCycle: 'yearly',
    description: 'In-line margin prediction and natural language risk explanation for deal desks.',
    variants: [],
    pricelists: [
      { tier: 'Bronze', currency: 'USD', priceRule: '$400/mo equivalent' },
      { tier: 'Silver', currency: 'USD', priceRule: '$360/mo equivalent' },
      { tier: 'Gold', currency: 'USD', priceRule: '$320/mo equivalent' },
    ],
  },
  {
    id: 'prod-04',
    name: 'Enterprise Architecture Deployment Sprint',
    category: 'Professional Services',
    price: 28000,
    unit: 'sprint',
    tax: 0.0,
    status: 'Active',
    isSubscription: false,
    description: '4-week dedicated onboarding sprint led by principal solutions architects.',
    variants: [
      { attribute: 'Timeline', values: ['Standard (4 Weeks)', 'Accelerated Blitz (2 Weeks)'], extraPrice: 8500 },
    ],
    pricelists: [
      { tier: 'Bronze', currency: 'USD', priceRule: 'Fixed Sprint Rate' },
      { tier: 'Silver', currency: 'USD', priceRule: '10% Packaged Credit' },
      { tier: 'Gold', currency: 'USD', priceRule: 'Preferred Partner Flat Rate' },
    ],
  },
  {
    id: 'prod-05',
    name: 'High-Availability Multi-Region Mesh',
    category: 'Cloud Infrastructure',
    price: 2400,
    unit: 'month',
    tax: 5.0,
    status: 'Active',
    isSubscription: true,
    recurringCycle: 'monthly',
    description: 'Sub-10ms active-active cross-continental synchronised database mesh.',
    variants: [],
    pricelists: [
      { tier: 'Bronze', currency: 'USD', priceRule: '$2,400/mo' },
      { tier: 'Silver', currency: 'USD', priceRule: '$2,160/mo' },
      { tier: 'Gold', currency: 'USD', priceRule: '$1,920/mo' },
    ],
  },
];

export const INITIAL_QUOTATIONS = [
  {
    id: 'QT-2026-8841',
    customer: 'Apex Global Logistics',
    customerTier: 'Gold',
    status: 'pending_approval',
    stage: 'Sales Manager Review',
    assignedTo: 'Marcus Vance',
    blended_risk_score: 78,
    createdAt: '2026-09-02',
    expiresAt: '2026-09-16',
    requiresFinance: true,
    lines: [
      {
        id: 'ln-1',
        productId: 'prod-01',
        product: 'AETHER Edge Compute Node X4',
        category: 'Enterprise Hardware',
        qty: 8,
        unitPrice: 14500,
        discountPct: 22,
        categoryLimitPct: 12,
        tierLimitPct: 25,
        isRecurring: false,
        customerComment: 'Requires rack mount brackets included',
      },
      {
        id: 'ln-2',
        productId: 'prod-02',
        product: 'DealFlow360 Enterprise Core License',
        category: 'SaaS Licenses',
        qty: 2,
        unitPrice: 36000,
        discountPct: 28,
        categoryLimitPct: 20,
        tierLimitPct: 25,
        isRecurring: true,
        customerComment: 'Commitment for 3-year term pending board review',
      },
      {
        id: 'ln-3',
        productId: 'prod-04',
        product: 'Enterprise Architecture Deployment Sprint',
        category: 'Professional Services',
        qty: 1,
        unitPrice: 28000,
        discountPct: 10,
        categoryLimitPct: 15,
        tierLimitPct: 25,
        isRecurring: false,
        customerComment: '',
      },
    ],
    auditTrails: [
      { user: 'Marcus Vance (Rep)', action: 'Created Quotation', date: '2026-09-02 09:14', note: 'Configured standard multi-node bundle for customer RFP.' },
      { user: 'Marcus Vance (Rep)', action: 'Applied 28% SaaS Discount', date: '2026-09-02 11:30', note: 'Customer requested price parity with legacy vendor renewal.' },
      { user: 'System Governance', action: 'Flagged for Dual Approval', date: '2026-09-02 11:30', note: 'Hardware discount (22% vs 12% cap) and SaaS discount (28% vs 20% cap) breached limits. Risk score 78.' },
    ],
  },
  {
    id: 'QT-2026-8839',
    customer: 'Hyperion BioDynamics',
    customerTier: 'Silver',
    status: 'approved',
    stage: 'Awaiting Signature',
    assignedTo: 'Elena Rostova',
    blended_risk_score: 24,
    createdAt: '2026-08-30',
    expiresAt: '2026-09-14',
    requiresFinance: false,
    lines: [
      {
        id: 'ln-10',
        productId: 'prod-01',
        product: 'AETHER Edge Compute Node X4',
        category: 'Enterprise Hardware',
        qty: 4,
        unitPrice: 14500,
        discountPct: 8,
        categoryLimitPct: 12,
        tierLimitPct: 15,
        isRecurring: false,
        customerComment: '',
      },
      {
        id: 'ln-11',
        productId: 'prod-03',
        product: 'Autonomous Governance AI Copilot',
        category: 'SaaS Licenses',
        qty: 10,
        unitPrice: 4800,
        discountPct: 12,
        categoryLimitPct: 20,
        tierLimitPct: 15,
        isRecurring: true,
        customerComment: '',
      },
    ],
    auditTrails: [
      { user: 'Elena Rostova (Rep)', action: 'Created Quotation', date: '2026-08-30 14:20', note: 'Clean deal within Silver thresholds.' },
      { user: 'Sarah Lin (Manager)', action: 'Approved Quotation', date: '2026-08-31 09:10', note: 'Margin verified at 34.2%. Approved without escalation.' },
    ],
  },
  {
    id: 'QT-2026-8837',
    customer: 'Solaria Cyber Defense',
    customerTier: 'Bronze',
    status: 'negotiation',
    stage: 'Counter-Offer Active',
    assignedTo: 'Devon Miles',
    blended_risk_score: 62,
    createdAt: '2026-09-01',
    expiresAt: '2026-09-15',
    requiresFinance: true,
    negotiation: {
      sellerMin: 72000,
      sellerMax: 89000,
      buyerMin: 65000,
      buyerMax: 76000,
      stepPercent: 2.5,
      currentRound: 3,
      maxRounds: 5,
      counterDiscountPct: 18.5,
      requestedDeliveryDate: '2026-10-15',
      customerComment: 'We have competitive quotes from Dynatrace and Datadog. Countering at 18.5% with annual upfront payment.',
      roundHistory: [
        { round: 1, buyerOffer: 66000, sellerOffer: 87000, status: 'Active' },
        { round: 2, buyerOffer: 69500, sellerOffer: 82000, status: 'Active' },
        { round: 3, buyerOffer: 73500, sellerOffer: 76800, status: 'Pending Seller Confirmation' },
      ],
    },
    lines: [
      {
        id: 'ln-20',
        productId: 'prod-02',
        product: 'DealFlow360 Enterprise Core License',
        category: 'SaaS Licenses',
        qty: 2,
        unitPrice: 36000,
        discountPct: 18.5,
        categoryLimitPct: 20,
        tierLimitPct: 10,
        isRecurring: true,
        customerComment: 'Need accelerated provisioning by mid October',
      },
    ],
    auditTrails: [
      { user: 'Devon Miles (Rep)', action: 'Submitted Counter-Proposal', date: '2026-09-01 16:45', note: 'Counter offer received from customer buyer desk.' },
      { user: 'Negotiation Engine', action: 'Round 3 Computed', date: '2026-09-03 10:12', note: 'Approaching convergence zone (delta $3,300).' },
    ],
  },
  {
    id: 'QT-2026-8835',
    customer: 'Vector Aerospace Systems',
    customerTier: 'Gold',
    status: 'confirmed',
    stage: 'Fulfilled & Active',
    assignedTo: 'Marcus Vance',
    blended_risk_score: 12,
    createdAt: '2026-08-20',
    expiresAt: '2026-09-04',
    requiresFinance: false,
    lines: [
      {
        id: 'ln-30',
        productId: 'prod-01',
        product: 'AETHER Edge Compute Node X4',
        category: 'Enterprise Hardware',
        qty: 12,
        unitPrice: 14500,
        discountPct: 10,
        categoryLimitPct: 12,
        tierLimitPct: 25,
        isRecurring: false,
        customerComment: '',
      },
      {
        id: 'ln-31',
        productId: 'prod-05',
        product: 'High-Availability Multi-Region Mesh',
        category: 'Cloud Infrastructure',
        qty: 12,
        unitPrice: 2400,
        discountPct: 5,
        categoryLimitPct: 18,
        tierLimitPct: 25,
        isRecurring: true,
        customerComment: '',
      },
    ],
    auditTrails: [
      { user: 'Marcus Vance (Rep)', action: 'Deal Confirmed', date: '2026-08-24 11:00', note: 'Master Services Agreement executed via DocuSign.' },
      { user: 'Logistics Engine', action: 'Fulfillment Split Created', date: '2026-08-24 11:05', note: 'Stock allocated from Austin and Berlin.' },
    ],
  },
  {
    id: 'QT-2026-8832',
    customer: 'Krypton Quantum Robotics',
    customerTier: 'Silver',
    status: 'draft',
    stage: 'Drafting Proposal',
    assignedTo: 'Elena Rostova',
    blended_risk_score: 35,
    createdAt: '2026-09-04',
    expiresAt: '2026-09-18',
    requiresFinance: false,
    lines: [
      {
        id: 'ln-40',
        productId: 'prod-01',
        product: 'AETHER Edge Compute Node X4',
        category: 'Enterprise Hardware',
        qty: 2,
        unitPrice: 14500,
        discountPct: 14,
        categoryLimitPct: 12,
        tierLimitPct: 15,
        isRecurring: false,
        customerComment: '',
      },
      {
        id: 'ln-41',
        productId: 'prod-04',
        product: 'Enterprise Architecture Deployment Sprint',
        category: 'Professional Services',
        qty: 1,
        unitPrice: 28000,
        discountPct: 5,
        categoryLimitPct: 15,
        tierLimitPct: 15,
        isRecurring: false,
        customerComment: '',
      },
    ],
    auditTrails: [
      { user: 'Elena Rostova (Rep)', action: 'Draft Created', date: '2026-09-04 15:30', note: 'Initial sizing for pilot robotics fleet.' },
    ],
  },
];

export const UPSELL_SUGGESTIONS = [
  {
    id: 'up-1',
    productId: 'prod-03',
    name: 'Autonomous Governance AI Copilot',
    category: 'SaaS Licenses',
    unitPrice: 4800,
    marginDeltaPct: +8.4,
    isPromoted: true,
    reason: 'Customers purchasing Hardware X4 typically add 5 Copilot seats to manage compliance in real time.',
  },
  {
    id: 'up-2',
    productId: 'prod-05',
    name: 'High-Availability Multi-Region Mesh',
    category: 'Cloud Infrastructure',
    unitPrice: 2400,
    marginDeltaPct: +5.2,
    isPromoted: false,
    reason: 'Adds sub-10ms disaster recovery mesh to Enterprise Core deployments.',
  },
  {
    id: 'up-3',
    productId: 'prod-04',
    name: 'Enterprise Architecture Deployment Sprint',
    category: 'Professional Services',
    unitPrice: 28000,
    marginDeltaPct: +12.6,
    isPromoted: true,
    reason: 'Accelerates customer production go-live by 30 days and increases Year 2 retention by 42%.',
  },
];

export const FULFILLMENT_ORDERS = [
  {
    id: 'ORD-2026-5510',
    quotationId: 'QT-2026-8835',
    customer: 'Vector Aerospace Systems',
    status: 'Split Pending',
    totalItems: 12,
    backorderQty: 2,
    backorderProduct: 'AETHER Edge Compute Node X4',
    warehouses: ['Austin Central (Hub A)', 'Berlin East (Hub B)'],
    splitDetail: [
      { warehouse: 'Austin Central Facility', qtyFulfilled: 7, estShipments: '2 Business Days', cost: '$1,420', status: 'Allocated' },
      { warehouse: 'Berlin East Logistics Hub', qtyFulfilled: 3, estShipments: '4 Business Days', cost: '$2,850', status: 'Allocated' },
      { warehouse: 'Factory Backorder (Austin Line 2)', qtyFulfilled: 2, estShipments: '12 Business Days (T-12)', cost: '$450', status: 'Backorder' },
    ],
  },
  {
    id: 'ORD-2026-5508',
    quotationId: 'QT-2026-8829',
    customer: 'AeroDynamics Propulsion Ltd',
    status: 'Fulfilled',
    totalItems: 6,
    backorderQty: 0,
    warehouses: ['Austin Central Facility'],
    splitDetail: [
      { warehouse: 'Austin Central Facility', qtyFulfilled: 6, estShipments: 'Delivered', cost: '$980', status: 'Completed' },
    ],
  },
  {
    id: 'ORD-2026-5502',
    quotationId: 'QT-2026-8819',
    customer: 'NorthStar Heavy Industries',
    status: 'Backorder',
    totalItems: 16,
    backorderQty: 5,
    backorderProduct: 'AETHER Edge Compute Node X4',
    warehouses: ['Austin Central Facility', 'Tokyo Logistics Bay'],
    splitDetail: [
      { warehouse: 'Austin Central Facility', qtyFulfilled: 6, estShipments: '1 Business Day', cost: '$1,100', status: 'Allocated' },
      { warehouse: 'Tokyo Logistics Bay', qtyFulfilled: 5, estShipments: '5 Business Days', cost: '$3,600', status: 'Allocated' },
      { warehouse: 'Global Backorder Queue', qtyFulfilled: 5, estShipments: '14 Business Days', cost: '$600', status: 'Backorder' },
    ],
  },
];

export const SUBSCRIPTIONS_DATA = [
  {
    id: 'SUB-9941',
    customer: 'Vector Aerospace Systems',
    customerTier: 'Gold',
    plan: 'Enterprise Multi-Region Core',
    cycle: 'yearly',
    amount: 36000,
    nextBill: '2027-08-24',
    status: 'Active',
    startDate: '2026-08-24',
    oneTimeLines: [
      { product: 'AETHER Edge Compute Node X4 (12 units)', qty: 12, amount: 156600 },
    ],
    recurringLines: [
      { plan: 'DealFlow360 Enterprise Core License', cycle: 'yearly', nextBill: '2027-08-24', amount: 36000 },
      { plan: 'High-Availability Multi-Region Mesh', cycle: 'monthly', nextBill: '2026-10-01', amount: 2400 },
    ],
  },
  {
    id: 'SUB-9938',
    customer: 'Hyperion BioDynamics',
    customerTier: 'Silver',
    plan: 'Autonomous AI Governance Fleet',
    cycle: 'yearly',
    amount: 42240,
    nextBill: '2027-09-01',
    status: 'Active',
    startDate: '2026-09-01',
    oneTimeLines: [
      { product: 'AETHER Edge Compute Node X4 (4 units)', qty: 4, amount: 53360 },
    ],
    recurringLines: [
      { plan: 'Autonomous Governance AI Copilot (10 Seats)', cycle: 'yearly', nextBill: '2027-09-01', amount: 42240 },
    ],
  },
  {
    id: 'SUB-9925',
    customer: 'OmniCorp Cloud Services',
    customerTier: 'Bronze',
    plan: 'Standard Mesh Tier',
    cycle: 'monthly',
    amount: 2400,
    nextBill: '2026-09-20',
    status: 'Paused',
    startDate: '2026-03-20',
    oneTimeLines: [],
    recurringLines: [
      { plan: 'High-Availability Multi-Region Mesh', cycle: 'monthly', nextBill: '2026-09-20', amount: 2400 },
    ],
  },
  {
    id: 'SUB-9912',
    customer: 'Legacy Systems Delta',
    customerTier: 'Bronze',
    plan: 'Core Starter Bundle',
    cycle: 'quarterly',
    amount: 9800,
    nextBill: 'Cancelled (Credit Note Issued)',
    status: 'Cancelled',
    startDate: '2026-01-10',
    oneTimeLines: [],
    recurringLines: [
      { plan: 'Legacy Core Starter', cycle: 'quarterly', nextBill: 'N/A', amount: 9800 },
    ],
  },
];

export const INVOICES_DATA = [
  {
    id: 'INV-2026-0042',
    orderId: 'ORD-2026-5510',
    quotationId: 'QT-2026-8835',
    customer: 'Vector Aerospace Systems',
    amount: 156600,
    status: 'Paid',
    dueDate: '2026-09-10',
    issuedDate: '2026-08-25',
    stepperState: 'Paid',
    lines: [
      { description: 'AETHER Edge Compute Node X4 (Initial Delivery 10 units)', qty: 10, unitPrice: 13050, total: 130500 },
      { description: 'Enterprise Architecture Deployment Sprint (Initial 50% Milestone)', qty: 1, unitPrice: 26100, total: 26100 },
    ],
    partialNote: 'Partial Invoice 1 of 2. Backorder remaining items will be billed upon warehouse dispatch.',
  },
  {
    id: 'INV-2026-0043',
    orderId: 'ORD-2026-5510',
    quotationId: 'QT-2026-8835',
    customer: 'Vector Aerospace Systems',
    amount: 26100,
    status: 'Unpaid',
    dueDate: '2026-09-28',
    issuedDate: '2026-09-02',
    stepperState: 'Invoiced',
    lines: [
      { description: 'AETHER Edge Compute Node X4 (Backorder 2 units)', qty: 2, unitPrice: 13050, total: 26100 },
    ],
    partialNote: 'Partial Invoice 2 of 2. Billed upon factory fulfillment confirmation.',
  },
  {
    id: 'INV-2026-0041',
    orderId: 'ORD-2026-5508',
    quotationId: 'QT-2026-8829',
    customer: 'AeroDynamics Propulsion Ltd',
    amount: 87400,
    status: 'Paid',
    dueDate: '2026-08-20',
    issuedDate: '2026-08-01',
    stepperState: 'Paid',
    lines: [
      { description: 'Full Order Fulfillment Complete', qty: 1, unitPrice: 87400, total: 87400 },
    ],
    partialNote: 'Full single invoice.',
  },
  {
    id: 'INV-2026-0044',
    orderId: 'ORD-2026-5514',
    quotationId: 'QT-2026-8841',
    customer: 'Apex Global Logistics',
    amount: 112000,
    status: 'Unpaid',
    dueDate: '2026-09-30',
    issuedDate: '2026-09-03',
    stepperState: 'Invoiced',
    lines: [
      { description: 'Hardware & SaaS Milestone 1', qty: 1, unitPrice: 112000, total: 112000 },
    ],
    partialNote: 'Awaiting customer accounts payable disbursement.',
  },
];

export const DEAL_HEALTH_ANOMALIES = [
  {
    id: 'ANOM-101',
    dealId: 'QT-2026-8841',
    customer: 'Apex Global Logistics',
    rep: 'Marcus Vance',
    issueType: 'ANOMALY',
    flaggedDate: '2026-09-02',
    severity: 'HIGH',
    summary: 'Hardware discount 22% vs rep historical avg 8.4% (+13.6% delta anomaly)',
    detail: 'Marcus Vance typically grants 7-10% discount on Hardware X4. A 22% concession triggered the behavioral anomaly model.',
    stalledDays: 0,
    actionNeeded: 'Requires VP Sales concession signoff',
  },
  {
    id: 'ANOM-102',
    dealId: 'QT-2026-8815',
    customer: 'Helios Semiconductor Fab',
    rep: 'Devon Miles',
    issueType: 'STALLED',
    flaggedDate: '2026-08-22',
    severity: 'MEDIUM',
    summary: 'Stalled in Pending Approval for 14 days without stakeholder touchpoint',
    detail: 'Quote value $240,000. Customer contact engaged 3 competitors in procurement portal.',
    stalledDays: 14,
    actionNeeded: 'Nudge Rep & Resend Procurement Link',
  },
  {
    id: 'ANOM-103',
    dealId: 'ORD-2026-5502',
    customer: 'NorthStar Heavy Industries',
    rep: 'Elena Rostova',
    issueType: 'SLIPPAGE',
    flaggedDate: '2026-08-31',
    severity: 'HIGH',
    summary: 'Estimated fulfillment date passed by 4 days due to Tokyo customs inspection',
    detail: 'Stock allocation delayed in transit from Tokyo Logistics Bay. SLA penalties accrue at day 7.',
    stalledDays: 4,
    actionNeeded: 'Reroute 5 units from Austin Reserve Hub',
  },
  {
    id: 'ANOM-104',
    dealId: 'QT-2026-8802',
    customer: 'Quantum Orbit Satellite Labs',
    rep: 'Marcus Vance',
    issueType: 'STALLED',
    flaggedDate: '2026-08-19',
    severity: 'MEDIUM',
    summary: 'Customer negotiation round 4 inactive for 9 business days',
    detail: 'Buyer proposed 24% discount. No seller counter-offer registered.',
    stalledDays: 9,
    actionNeeded: 'Nudge Rep to Submit Counter-Offer',
  },
];

// Helper calculations
export function calculateLineTotal(line) {
  const base = line.qty * line.unitPrice;
  const discount = base * (line.discountPct / 100);
  return base - discount;
}

export function calculateQuotationTotals(lines) {
  let subtotal = 0;
  let totalDiscount = 0;
  let total = 0;
  let hasRecurring = false;
  let hasOneTime = false;

  lines.forEach((line) => {
    const base = line.qty * line.unitPrice;
    const discount = base * (line.discountPct / 100);
    subtotal += base;
    totalDiscount += discount;
    total += base - discount;
    if (line.isRecurring) hasRecurring = true;
    else hasOneTime = true;
  });

  return {
    subtotal,
    totalDiscount,
    total,
    effectiveDiscountPct: subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0,
    hasRecurring,
    hasOneTime,
  };
}

export function calculateBlendedRisk(lines, customerTier) {
  if (!lines || lines.length === 0) return { score: 0, level: 'LOW', flaggedLines: [] };

  const tierCeiling = TIER_DISCOUNT_CEILINGS[customerTier] || 10;
  let maxExcess = 0;
  let weightedExcess = 0;
  let totalWeight = 0;
  const flaggedLines = [];

  lines.forEach((line) => {
    const catCeiling = CATEGORY_DISCOUNT_CEILINGS[line.category] || 15;
    const effectiveCeiling = Math.min(tierCeiling, catCeiling);
    const excess = Math.max(0, line.discountPct - effectiveCeiling);
    const weight = line.qty * line.unitPrice;

    if (line.discountPct > effectiveCeiling) {
      flaggedLines.push({
        productId: line.productId,
        product: line.product,
        category: line.category,
        discountGiven: line.discountPct,
        limitAllowed: effectiveCeiling,
        tierLimit: tierCeiling,
        categoryLimit: catCeiling,
        overBy: parseFloat((line.discountPct - effectiveCeiling).toFixed(1)),
      });
    }

    if (excess > maxExcess) maxExcess = excess;
    weightedExcess += excess * weight;
    totalWeight += weight;
  });

  const avgExcess = totalWeight > 0 ? weightedExcess / totalWeight : 0;
  // Score 0-100 based on weighted excess and count of violations
  const rawScore = Math.min(100, Math.round(avgExcess * 4.5 + flaggedLines.length * 10));

  let level = 'LOW';
  if (rawScore > 65) level = 'HIGH';
  else if (rawScore > 25) level = 'MEDIUM';

  return {
    score: rawScore,
    level,
    flaggedLines,
    requiresFinance: rawScore > 50 || maxExcess > 10,
  };
}

export function calculateProration(oldQty, newQty, unitPrice, daysRemainingInCycle, totalDaysInCycle) {
  const dailyRate = unitPrice / totalDaysInCycle;
  const deltaQty = newQty - oldQty;
  const prorationAmount = deltaQty * dailyRate * daysRemainingInCycle;
  return {
    deltaQty,
    dailyRate,
    daysRemainingInCycle,
    totalDaysInCycle,
    prorationAmount: Math.round(prorationAmount * 100) / 100,
  };
}
