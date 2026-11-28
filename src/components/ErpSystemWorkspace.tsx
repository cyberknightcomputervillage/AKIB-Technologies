import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
  Truck,
  Undo2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../lib/validation';
import {
  ERP_CATEGORIES,
  type AdminTab,
  type ErpBranch,
  type ErpCustomer,
  type ErpModel,
  type ErpPurchase,
  type ErpReturn,
  type ErpSale,
  type ErpSerial,
  type ErpSerialHistoryEventType,
  type ErpTabId,
  type ErpVendor,
} from '../types';

export interface ErpPendingAction {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  execute: (adminPassword: string) => Promise<void>;
}

interface ErpSystemWorkspaceProps {
  activeTab: ErpTabId;
  requestPasswordConfirm: (action: ErpPendingAction) => void;
  onNavigateTab: (tab: AdminTab) => void;
}

type StockDisplayMode = 'name-qty' | 'with-price' | 'with-serials';
type SetupSection = 'models' | 'vendors' | 'customers' | 'branches';

interface PurchaseDraftLine {
  key: string;
  modelId: string;
  unitCost: string;
  serialsText: string;
}

function getCurrentLocalMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function parseSerialList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const HISTORY_BADGE: Record<
  ErpSerialHistoryEventType,
  { label: string; badgeClass: string; dotClass: string }
> = {
  PURCHASE: {
    label: 'Purchased from Vendor',
    badgeClass: 'bg-blue-50 text-[#3749BB] border-blue-200',
    dotClass: 'bg-[#3749BB]',
  },
  SALE: {
    label: 'Sold to Customer',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  SALES_RETURN: {
    label: 'Sales Return (Restocked)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  PURCHASE_RETURN: {
    label: 'Purchase Return (To Vendor)',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-600',
  },
};

const TAB_HEADER_META: Record<
  ErpTabId,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  'erp-stock': {
    title: 'ERP Stock Inventory',
    subtitle:
      'Consolidated stock by Setup Product Name, filtered by Brand, Branch, and Model with price or serial inspection.',
    icon: Boxes,
  },
  'erp-purchase': {
    title: 'ERP Vendor Purchase',
    subtitle:
      'Record serialized vendor purchases into branch stock and review or edit purchase vouchers.',
    icon: Truck,
  },
  'erp-purchase-return': {
    title: 'ERP Purchase Return',
    subtitle:
      'Return in-stock serialized units back to vendors and manage purchase return records.',
    icon: Undo2,
  },
  'erp-sales': {
    title: 'ERP Sales Order',
    subtitle:
      'Create serialized sales invoices attributed to stored Managers and review or edit sales orders.',
    icon: ShoppingBag,
  },
  'erp-sales-return': {
    title: 'ERP Sales Return',
    subtitle:
      'Process customer sales returns to restock serials, adjust profit, and review or edit return logs.',
    icon: RotateCcw,
  },
  'erp-profit': {
    title: 'ERP Monthly Profit Report',
    subtitle:
      'Track end-of-month unit volume, net revenue, cost of goods sold, and net profit per Manager.',
    icon: TrendingUp,
  },
  'erp-serial-search': {
    title: 'ERP Advance Serial Search',
    subtitle:
      'Look up any serial number to inspect its full lifetime history across purchases, sales, and returns with exact date & time.',
    icon: Search,
  },
  'erp-setup': {
    title: 'ERP Master Setup',
    subtitle:
      'Configure consolidated Product Name & Models, Vendors, Customers, and Store Branches.',
    icon: Layers,
  },
};

export function ErpSystemWorkspace({
  activeTab,
  requestPasswordConfirm,
  onNavigateTab,
}: ErpSystemWorkspaceProps) {
  const {
    adminRole,
    activeStaffAccount,
    staffAccounts,
    erpBranches,
    erpVendors,
    erpCustomers,
    erpModels,
    erpSerials,
    erpPurchases,
    erpSales,
    erpReturns,
    saveErpBranch,
    saveErpVendor,
    saveErpCustomer,
    saveErpModel,
    createErpPurchase,
    createErpPurchaseReturn,
    createErpSale,
    createErpSalesReturn,
    editErpPurchase,
    editErpSale,
    editErpReturn,
    editErpSerial,
  } = useStore();

  const isSuperAdmin = adminRole === 'super_admin';
  const canErpStock = isSuperAdmin || Boolean(activeStaffAccount?.canErpStock);
  const canErpPurchase = isSuperAdmin || Boolean(activeStaffAccount?.canErpPurchase);
  const canErpPurchaseReturn = isSuperAdmin || Boolean(activeStaffAccount?.canErpPurchaseReturn);
  const canErpSale = isSuperAdmin || Boolean(activeStaffAccount?.canErpSale);
  const canErpSalesReturn = isSuperAdmin || Boolean(activeStaffAccount?.canErpSalesReturn);
  const canErpSerialSearch = isSuperAdmin || Boolean(activeStaffAccount?.canErpSerialSearch);
  const canErpSetup = isSuperAdmin || Boolean(activeStaffAccount?.canErpSetup);
  const canErpEdit = isSuperAdmin || Boolean(activeStaffAccount?.canErpEdit);

  // ---------------------------------------------------------
  // 1. STOCK STATE
  // ---------------------------------------------------------
  const [stockBrandFilter, setStockBrandFilter] = useState<string>('all');
  const [stockBranchFilter, setStockBranchFilter] = useState<string>('all');
  const [stockModelFilter, setStockModelFilter] = useState<string>('all');
  const [stockKeyword, setStockKeyword] = useState<string>('');
  const [stockDisplayMode, setStockDisplayMode] = useState<StockDisplayMode>('name-qty');

  // ---------------------------------------------------------
  // 2. PURCHASE STATE
  // ---------------------------------------------------------
  const [purInvoice, setPurInvoice] = useState<string>(
    () => `PUR-${Date.now().toString().slice(-6)}`
  );
  const [purVendorId, setPurVendorId] = useState<string>('');
  const [purBranchId, setPurBranchId] = useState<string>('');
  const [purNotes, setPurNotes] = useState<string>('');
  const [purLines, setPurLines] = useState<PurchaseDraftLine[]>([
    { key: 'line_1', modelId: '', unitCost: '', serialsText: '' },
  ]);
  const [purError, setPurError] = useState<string | null>(null);
  const [autoGenQtyMap, setAutoGenQtyMap] = useState<Record<string, number>>({});
  const [purSearch, setPurSearch] = useState<string>('');

  // ---------------------------------------------------------
  // 3. PURCHASE RETURN STATE
  // ---------------------------------------------------------
  const [purRetQuery, setPurRetQuery] = useState<string>('');
  const [purRetBranchFilter, setPurRetBranchFilter] = useState<string>('all');
  const [purRetVendorFilter, setPurRetVendorFilter] = useState<string>('all');

  // ---------------------------------------------------------
  // 4. SALES ORDER STATE
  // ---------------------------------------------------------
  const [saleInvoice, setSaleInvoice] = useState<string>(
    () => `INV-${Date.now().toString().slice(-6)}`
  );
  const [saleCustomerId, setSaleCustomerId] = useState<string>('');
  const [saleBranchId, setSaleBranchId] = useState<string>('');
  const [saleSalespersonId, setSaleSalespersonId] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [saleSerialSearch, setSaleSerialSearch] = useState<string>('');
  const [saleCart, setSaleCart] = useState<{ serial: ErpSerial; unitPrice: number }[]>([]);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleListSearch, setSaleListSearch] = useState<string>('');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 5. SALES RETURN STATE
  // ---------------------------------------------------------
  const [saleRetQuery, setSaleRetQuery] = useState<string>('');
  const [saleRetBranchFilter, setSaleRetBranchFilter] = useState<string>('all');
  const [saleRetSalespersonFilter, setSaleRetSalespersonFilter] = useState<string>('all');

  // ---------------------------------------------------------
  // 6. MONTHLY PROFIT REPORT STATE
  // ---------------------------------------------------------
  const [reportMonth, setReportMonth] = useState<string>(getCurrentLocalMonth);
  const [reportAllMonths, setReportAllMonths] = useState<boolean>(false);
  const [reportBranchFilter, setReportBranchFilter] = useState<string>('all');

  // ---------------------------------------------------------
  // 7. ADVANCE SERIAL SEARCH STATE
  // ---------------------------------------------------------
  const [serialQuery, setSerialQuery] = useState<string>('');
  const [serialStatusFilter, setSerialStatusFilter] = useState<
    'all' | 'in_stock' | 'sold' | 'purchase_returned'
  >('all');
  const [selectedSerialId, setSelectedSerialId] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 8. SETUP STATE
  // ---------------------------------------------------------
  const [setupSection, setSetupSection] = useState<SetupSection>('models');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState({
    brand: '',
    modelName: '',
    productName: '',
    category: 'Laptops',
    defaultBuyPrice: '',
    defaultSellPrice: '',
    warranty: '2 Years Official Warranty',
  });
  const [modelFormError, setModelFormError] = useState<string | null>(null);

  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    city: 'Dhaka',
    address: '',
    notes: '',
  });
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    location: '',
    phone: '',
  });
  const [branchFormError, setBranchFormError] = useState<string | null>(null);

  // ---------------------------------------------------------
  // MODALS: RETURN REASON + ERP EDIT MODALS
  // ---------------------------------------------------------
  const [returnTarget, setReturnTarget] = useState<{
    type: 'purchase_return' | 'sales_return';
    serial: ErpSerial;
  } | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');

  const [editPurchaseTarget, setEditPurchaseTarget] = useState<ErpPurchase | null>(null);
  const [editPurInvoice, setEditPurInvoice] = useState<string>('');
  const [editPurVendorId, setEditPurVendorId] = useState<string>('');
  const [editPurBranchId, setEditPurBranchId] = useState<string>('');
  const [editPurDateLocal, setEditPurDateLocal] = useState<string>('');
  const [editPurNotes, setEditPurNotes] = useState<string>('');
  const [editPurCosts, setEditPurCosts] = useState<Record<string, string>>({});

  const [editSaleTarget, setEditSaleTarget] = useState<ErpSale | null>(null);
  const [editSaleInvoice, setEditSaleInvoice] = useState<string>('');
  const [editSaleCustomerId, setEditSaleCustomerId] = useState<string>('');
  const [editSaleBranchId, setEditSaleBranchId] = useState<string>('');
  const [editSaleSalespersonId, setEditSaleSalespersonId] = useState<string>('');
  const [editSaleDateLocal, setEditSaleDateLocal] = useState<string>('');
  const [editSaleNotes, setEditSaleNotes] = useState<string>('');
  const [editSalePrices, setEditSalePrices] = useState<Record<string, string>>({});

  const [editReturnTarget, setEditReturnTarget] = useState<ErpReturn | null>(null);
  const [editRetNumber, setEditRetNumber] = useState<string>('');
  const [editRetDateLocal, setEditRetDateLocal] = useState<string>('');
  const [editRetAmount, setEditRetAmount] = useState<string>('');
  const [editRetReason, setEditRetReason] = useState<string>('');

  const [editSerialTarget, setEditSerialTarget] = useState<ErpSerial | null>(null);
  const [editSerialNumber, setEditSerialNumber] = useState<string>('');
  const [editSerialBranchId, setEditSerialBranchId] = useState<string>('');
  const [editSerialCost, setEditSerialCost] = useState<string>('');
  const [editSerialPrice, setEditSerialPrice] = useState<string>('');

  // Active setup collections
  const activeBranches = useMemo(
    () => erpBranches.filter((b) => b.status === 'active'),
    [erpBranches]
  );
  const activeVendors = useMemo(
    () => erpVendors.filter((v) => v.status === 'active'),
    [erpVendors]
  );
  const activeCustomers = useMemo(
    () => erpCustomers.filter((c) => c.status === 'active'),
    [erpCustomers]
  );
  const activeModels = useMemo(
    () => erpModels.filter((m) => m.status === 'active'),
    [erpModels]
  );
  const activeManagers = useMemo(
    () => staffAccounts.filter((s) => s.status === 'active' && s.active),
    [staffAccounts]
  );

  // Brand options
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of activeModels) set.add(m.brand);
    for (const s of erpSerials) set.add(s.brand);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeModels, erpSerials]);

  const modelFilterOptions = useMemo(() => {
    return activeModels.filter(
      (m) => stockBrandFilter === 'all' || m.brand.toLowerCase() === stockBrandFilter.toLowerCase()
    );
  }, [activeModels, stockBrandFilter]);

  // Consolidated Stock Rows (grouped by modelId)
  const stockSummary = useMemo(() => {
    const inStockSerials = erpSerials.filter((s) => s.status === 'in_stock');
    const q = stockKeyword.trim().toLowerCase();

    const filteredSerials = inStockSerials.filter((s) => {
      if (stockBrandFilter !== 'all' && s.brand.toLowerCase() !== stockBrandFilter.toLowerCase()) {
        return false;
      }
      if (stockBranchFilter !== 'all' && s.branchId !== stockBranchFilter) {
        return false;
      }
      if (stockModelFilter !== 'all' && s.modelId !== stockModelFilter) {
        return false;
      }
      return true;
    });

    const modelById = new Map(erpModels.map((m) => [m.modelId, m]));
    const map = new Map<
      string,
      {
        modelId: string;
        productName: string;
        brand: string;
        modelName: string;
        category: string;
        defaultBuyPrice: number;
        defaultSellPrice: number;
        quantity: number;
        totalCostValue: number;
        avgCost: number;
        branchCounts: { branchId: string; branchName: string; count: number }[];
        serials: ErpSerial[];
      }
    >();

    for (const m of activeModels) {
      if (stockBrandFilter !== 'all' && m.brand.toLowerCase() !== stockBrandFilter.toLowerCase()) {
        continue;
      }
      if (stockModelFilter !== 'all' && m.modelId !== stockModelFilter) {
        continue;
      }
      map.set(m.modelId, {
        modelId: m.modelId,
        productName: m.productName,
        brand: m.brand,
        modelName: m.modelName,
        category: m.category,
        defaultBuyPrice: m.defaultBuyPrice,
        defaultSellPrice: m.defaultSellPrice,
        quantity: 0,
        totalCostValue: 0,
        avgCost: m.defaultBuyPrice,
        branchCounts: [],
        serials: [],
      });
    }

    for (const s of filteredSerials) {
      const m = modelById.get(s.modelId);
      let entry = map.get(s.modelId);
      if (!entry) {
        entry = {
          modelId: s.modelId,
          productName: m?.productName || s.productName,
          brand: m?.brand || s.brand,
          modelName: m?.modelName || s.modelName,
          category: m?.category || 'Hardware',
          defaultBuyPrice: m?.defaultBuyPrice ?? s.purchaseCost,
          defaultSellPrice: m?.defaultSellPrice ?? s.salePrice,
          quantity: 0,
          totalCostValue: 0,
          avgCost: 0,
          branchCounts: [],
          serials: [],
        };
        map.set(s.modelId, entry);
      }
      entry.quantity += 1;
      entry.totalCostValue += s.purchaseCost;
      entry.serials.push(s);
      const bEntry = entry.branchCounts.find((b) => b.branchId === s.branchId);
      if (bEntry) bEntry.count += 1;
      else entry.branchCounts.push({ branchId: s.branchId, branchName: s.branchName, count: 1 });
    }

    const rows = Array.from(map.values())
      .map((r) => ({
        ...r,
        avgCost: r.quantity > 0 ? r.totalCostValue / r.quantity : r.defaultBuyPrice,
      }))
      .filter((r) => {
        if (stockBranchFilter !== 'all' && r.quantity === 0) return false;
        if (!q) return true;
        return (
          r.productName.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q) ||
          r.modelName.toLowerCase().includes(q) ||
          r.serials.some((sn) => sn.serialNumber.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName));

    const totalUnits = rows.reduce((sum, r) => sum + r.quantity, 0);
    const totalCostValuation = rows.reduce((sum, r) => sum + r.totalCostValue, 0);
    const totalRetailValuation = rows.reduce(
      (sum, r) => sum + r.quantity * r.defaultSellPrice,
      0
    );
    const inStockModelCount = rows.filter((r) => r.quantity > 0).length;

    return {
      rows,
      totalUnits,
      totalCostValuation,
      totalRetailValuation,
      inStockModelCount,
    };
  }, [
    erpSerials,
    erpModels,
    activeModels,
    stockBrandFilter,
    stockBranchFilter,
    stockModelFilter,
    stockKeyword,
  ]);

  // Purchases filtered
  const filteredPurchases = useMemo(() => {
    const q = purSearch.trim().toLowerCase();
    if (!q) return erpPurchases;
    return erpPurchases.filter(
      (p) =>
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        p.branchName.toLowerCase().includes(q) ||
        p.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            i.modelName.toLowerCase().includes(q) ||
            i.serialNumbers.some((sn) => sn.toLowerCase().includes(q))
        )
    );
  }, [erpPurchases, purSearch]);

  // Purchase Return candidates & history
  const purchaseReturnCandidates = useMemo(() => {
    const q = purRetQuery.trim().toLowerCase();
    return erpSerials
      .filter((s) => {
        if (s.status !== 'in_stock') return false;
        if (purRetBranchFilter !== 'all' && s.branchId !== purRetBranchFilter) return false;
        if (purRetVendorFilter !== 'all' && s.vendorId !== purRetVendorFilter) return false;
        if (!q) return true;
        return (
          s.serialNumber.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.modelName.toLowerCase().includes(q) ||
          s.purchaseInvoice.toLowerCase().includes(q) ||
          s.vendorName.toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [erpSerials, purRetQuery, purRetBranchFilter, purRetVendorFilter]);

  const purchaseReturnsHistory = useMemo(
    () => erpReturns.filter((r) => r.returnType === 'purchase_return'),
    [erpReturns]
  );

  // Available In-Stock serials for selected Sale Branch
  const availableSaleSerials = useMemo(() => {
    const selectedIds = new Set(saleCart.map((c) => c.serial.serialId));
    const q = saleSerialSearch.trim().toLowerCase();
    return erpSerials.filter((s) => {
      if (s.status !== 'in_stock') return false;
      if (saleBranchId && s.branchId !== saleBranchId) return false;
      if (selectedIds.has(s.serialId)) return false;
      if (!q) return true;
      return (
        s.serialNumber.toLowerCase().includes(q) ||
        s.productName.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.modelName.toLowerCase().includes(q)
      );
    });
  }, [erpSerials, saleBranchId, saleCart, saleSerialSearch]);

  const filteredSalesInvoices = useMemo(() => {
    const q = saleListSearch.trim().toLowerCase();
    if (!q) return erpSales;
    return erpSales.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.salespersonName.toLowerCase().includes(q) ||
        s.branchName.toLowerCase().includes(q) ||
        s.items.some(
          (i) =>
            i.serialNumber.toLowerCase().includes(q) ||
            i.productName.toLowerCase().includes(q)
        )
    );
  }, [erpSales, saleListSearch]);

  // Sales Return candidates & history
  const salesReturnCandidates = useMemo(() => {
    const q = saleRetQuery.trim().toLowerCase();
    return erpSerials
      .filter((s) => {
        if (s.status !== 'sold') return false;
        if (saleRetBranchFilter !== 'all' && s.branchId !== saleRetBranchFilter) return false;
        if (saleRetSalespersonFilter !== 'all' && s.salespersonId !== saleRetSalespersonFilter) {
          return false;
        }
        if (!q) return true;
        return (
          s.serialNumber.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.modelName.toLowerCase().includes(q) ||
          s.lastSaleInvoice.toLowerCase().includes(q) ||
          s.lastCustomerName.toLowerCase().includes(q) ||
          s.salespersonName.toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [erpSerials, saleRetQuery, saleRetBranchFilter, saleRetSalespersonFilter]);

  const salesReturnsHistory = useMemo(
    () => erpReturns.filter((r) => r.returnType === 'sales_return'),
    [erpReturns]
  );

  // Monthly Salesperson & Profit Report
  const monthlyReport = useMemo(() => {
    const relevantSales = erpSales.filter((s) => {
      if (!reportAllMonths && s.saleMonth !== reportMonth) return false;
      if (reportBranchFilter !== 'all' && s.branchId !== reportBranchFilter) return false;
      return true;
    });

    const byPerson = new Map<
      string,
      {
        salespersonId: string;
        salespersonName: string;
        salespersonUsername: string;
        invoices: number;
        unitsSold: number;
        returnedUnits: number;
        netRevenue: number;
        netCost: number;
        netProfit: number;
      }
    >();

    for (const mgr of activeManagers) {
      byPerson.set(mgr.staffId, {
        salespersonId: mgr.staffId,
        salespersonName: mgr.displayName,
        salespersonUsername: mgr.username,
        invoices: 0,
        unitsSold: 0,
        returnedUnits: 0,
        netRevenue: 0,
        netCost: 0,
        netProfit: 0,
      });
    }

    for (const s of relevantSales) {
      let row = byPerson.get(s.salespersonId);
      if (!row) {
        row = {
          salespersonId: s.salespersonId,
          salespersonName: s.salespersonName,
          salespersonUsername: s.salespersonUsername,
          invoices: 0,
          unitsSold: 0,
          returnedUnits: 0,
          netRevenue: 0,
          netCost: 0,
          netProfit: 0,
        };
        byPerson.set(s.salespersonId, row);
      }

      const activeItems = s.items.filter((i) => !i.returned);
      const returnedItemsCount = s.items.filter((i) => i.returned).length;
      row.invoices += 1;
      row.unitsSold += activeItems.length;
      row.returnedUnits += returnedItemsCount;
      row.netRevenue += activeItems.reduce((sum, i) => sum + i.unitPrice, 0);
      row.netCost += activeItems.reduce((sum, i) => sum + i.unitCost, 0);
      row.netProfit += activeItems.reduce((sum, i) => sum + i.profit, 0);
    }

    const rows = Array.from(byPerson.values()).sort(
      (a, b) => b.netProfit - a.netProfit || b.netRevenue - a.netRevenue
    );

    const totals = rows.reduce(
      (acc, r) => ({
        invoices: acc.invoices + r.invoices,
        unitsSold: acc.unitsSold + r.unitsSold,
        netRevenue: acc.netRevenue + r.netRevenue,
        netCost: acc.netCost + r.netCost,
        netProfit: acc.netProfit + r.netProfit,
      }),
      { invoices: 0, unitsSold: 0, netRevenue: 0, netCost: 0, netProfit: 0 }
    );

    return { rows, totals, relevantSales };
  }, [erpSales, activeManagers, reportMonth, reportAllMonths, reportBranchFilter]);

  // Advance Serial Search
  const matchingSerials = useMemo(() => {
    const q = serialQuery.trim().toLowerCase();
    return erpSerials
      .filter((s) => {
        if (serialStatusFilter !== 'all' && s.status !== serialStatusFilter) return false;
        if (!q) return true;
        return (
          s.serialNumber.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.modelName.toLowerCase().includes(q) ||
          s.vendorName.toLowerCase().includes(q) ||
          s.lastCustomerName.toLowerCase().includes(q) ||
          s.purchaseInvoice.toLowerCase().includes(q) ||
          s.lastSaleInvoice.toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [erpSerials, serialQuery, serialStatusFilter]);

  const inspectedSerial = useMemo(() => {
    if (selectedSerialId) {
      const found = erpSerials.find((s) => s.serialId === selectedSerialId);
      if (found) return found;
    }
    return matchingSerials[0] || null;
  }, [selectedSerialId, erpSerials, matchingSerials]);

  // Live Purchase preview totals
  const purchaseSummary = useMemo(() => {
    let units = 0;
    let total = 0;
    for (const l of purLines) {
      const cnt = parseSerialList(l.serialsText).length;
      const cost = Math.max(0, Number(l.unitCost || 0));
      units += cnt;
      total += cnt * cost;
    }
    return { units, total };
  }, [purLines]);

  // ---------------------------------------------------------
  // OPEN MODAL HELPERS
  // ---------------------------------------------------------
  const jumpToSerialHistory = (serialId: string, serialNumber: string) => {
    setSerialQuery(serialNumber);
    setSerialStatusFilter('all');
    setSelectedSerialId(serialId);
    if (canErpSerialSearch) {
      onNavigateTab('erp-serial-search');
    }
  };

  const openEditPurchaseModal = (p: ErpPurchase) => {
    const costs: Record<string, string> = {};
    for (const item of p.items) {
      costs[item.modelId] = String(item.unitCost);
    }
    setEditPurchaseTarget(p);
    setEditPurInvoice(p.invoiceNumber);
    setEditPurVendorId(p.vendorId);
    setEditPurBranchId(p.branchId);
    setEditPurDateLocal(toDateTimeLocalValue(p.purchaseDateIso));
    setEditPurNotes(p.notes || '');
    setEditPurCosts(costs);
  };

  const openEditSaleModal = (s: ErpSale) => {
    const prices: Record<string, string> = {};
    for (const item of s.items) {
      prices[item.serialId] = String(item.unitPrice);
    }
    setEditSaleTarget(s);
    setEditSaleInvoice(s.invoiceNumber);
    setEditSaleCustomerId(s.customerId);
    setEditSaleBranchId(s.branchId);
    setEditSaleSalespersonId(s.salespersonId);
    setEditSaleDateLocal(toDateTimeLocalValue(s.saleDateIso));
    setEditSaleNotes(s.notes || '');
    setEditSalePrices(prices);
  };

  const openEditReturnModal = (r: ErpReturn) => {
    setEditReturnTarget(r);
    setEditRetNumber(r.returnNumber);
    setEditRetDateLocal(toDateTimeLocalValue(r.returnDateIso));
    setEditRetAmount(String(r.amount));
    setEditRetReason(r.reason);
  };

  const openEditSerialModal = (s: ErpSerial) => {
    setEditSerialTarget(s);
    setEditSerialNumber(s.serialNumber);
    setEditSerialBranchId(s.branchId);
    setEditSerialCost(String(s.purchaseCost));
    setEditSerialPrice(String(s.salePrice));
  };

  // ---------------------------------------------------------
  // SUBMIT HANDLERS (ALL PASSWORD-GATED)
  // ---------------------------------------------------------
  const handleAddPurchaseLine = () => {
    setPurLines((prev) => [
      ...prev,
      {
        key: `line_${Date.now().toString(36)}_${prev.length + 1}`,
        modelId: '',
        unitCost: '',
        serialsText: '',
      },
    ]);
  };

  const handleAutoGenerateSerials = (lineKey: string, modelId: string) => {
    const qty = Math.max(1, Math.min(50, Number(autoGenQtyMap[lineKey] || 5)));
    const model = activeModels.find((m) => m.modelId === modelId);
    const prefix = (model?.modelName || 'SN')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8);
    const batchTag = Date.now().toString(36).toUpperCase().slice(-4);
    const generated = Array.from({ length: qty }, (_, i) => {
      return `${prefix || 'AKB'}-${batchTag}-${String(i + 1).padStart(2, '0')}`;
    });
    setPurLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l;
        const existing = parseSerialList(l.serialsText);
        return {
          ...l,
          serialsText: [...existing, ...generated].join('\n'),
        };
      })
    );
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPurError(null);
    if (!purVendorId) {
      setPurError('Select a Vendor from Setup.');
      return;
    }
    if (!purBranchId) {
      setPurError('Select a destination Branch from Setup.');
      return;
    }
    if (purInvoice.trim().length < 2) {
      setPurError('Enter a valid Purchase Invoice number.');
      return;
    }

    const preparedItems: { modelId: string; unitCost: number; serialNumbers: string[] }[] = [];
    for (const line of purLines) {
      if (!line.modelId) {
        setPurError('Select a Setup Model for every purchase line.');
        return;
      }
      const serials = parseSerialList(line.serialsText);
      if (serials.length === 0) {
        setPurError('Enter at least one serial number for every purchase line.');
        return;
      }
      const cost = Number(line.unitCost);
      if (!Number.isFinite(cost) || cost < 0) {
        setPurError('Enter a valid unit purchase cost (>= 0).');
        return;
      }
      preparedItems.push({
        modelId: line.modelId,
        unitCost: cost,
        serialNumbers: serials,
      });
    }

    const totalUnits = preparedItems.reduce((sum, i) => sum + i.serialNumbers.length, 0);
    const totalCost = preparedItems.reduce(
      (sum, i) => sum + i.unitCost * i.serialNumbers.length,
      0
    );

    requestPasswordConfirm({
      title: 'Confirm Vendor Purchase Entry',
      description: `Record Purchase #${purInvoice.trim()} (${totalUnits} unit(s), ${formatCurrency(totalCost)}) and automatically add all serials to stock.`,
      confirmLabel: 'Confirm & Add to Stock',
      execute: async (pw) => {
        await createErpPurchase(
          {
            invoiceNumber: purInvoice.trim(),
            vendorId: purVendorId,
            branchId: purBranchId,
            notes: purNotes,
            items: preparedItems,
          },
          pw
        );
        setPurInvoice(`PUR-${Date.now().toString().slice(-6)}`);
        setPurNotes('');
        setPurLines([{ key: `line_${Date.now()}`, modelId: '', unitCost: '', serialsText: '' }]);
      },
    });
  };

  const handleEditPurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPurchaseTarget) return;
    const lineCosts: Record<string, number> = {};
    for (const [mId, val] of Object.entries(editPurCosts)) {
      lineCosts[mId] = Math.max(0, Number(val || 0));
    }
    const target = editPurchaseTarget;
    const payload = {
      purchaseId: target.purchaseId,
      invoiceNumber: editPurInvoice.trim(),
      vendorId: editPurVendorId,
      branchId: editPurBranchId,
      purchaseDateIso: new Date(editPurDateLocal || target.purchaseDateIso).toISOString(),
      notes: editPurNotes,
      lineCosts,
    };
    setEditPurchaseTarget(null);

    requestPasswordConfirm({
      title: 'Confirm Edit Purchase Voucher',
      description: `Save updates to Purchase #${payload.invoiceNumber} and sync linked serial records.`,
      confirmLabel: 'Save Purchase Changes',
      execute: async (pw) => {
        await editErpPurchase(payload, pw);
      },
    });
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);
    if (!saleCustomerId) {
      setSaleError('Select a Customer from Setup.');
      return;
    }
    if (!saleBranchId) {
      setSaleError('Select a Branch.');
      return;
    }
    if (!saleSalespersonId) {
      setSaleError('Select a Sales Person from your stored Managers.');
      return;
    }
    if (saleCart.length === 0) {
      setSaleError('Add at least one in-stock serial number to sell.');
      return;
    }

    const totalRev = saleCart.reduce((sum, i) => sum + Number(i.unitPrice || 0), 0);
    const totalProfit = saleCart.reduce(
      (sum, i) => sum + (Number(i.unitPrice || 0) - i.serial.purchaseCost),
      0
    );
    const sp = activeManagers.find((m) => m.staffId === saleSalespersonId);

    requestPasswordConfirm({
      title: 'Confirm ERP Sales Invoice',
      description: `Complete Sale #${saleInvoice.trim()} (${saleCart.length} unit(s), Revenue ${formatCurrency(totalRev)}, Profit ${formatCurrency(totalProfit)}) credited to ${sp?.displayName || 'Manager'}.`,
      confirmLabel: 'Confirm Sale',
      execute: async (pw) => {
        await createErpSale(
          {
            invoiceNumber: saleInvoice.trim(),
            customerId: saleCustomerId,
            branchId: saleBranchId,
            salespersonId: saleSalespersonId,
            notes: saleNotes,
            items: saleCart.map((c) => ({
              serialId: c.serial.serialId,
              unitPrice: Number(c.unitPrice || 0),
            })),
          },
          pw
        );
        setSaleInvoice(`INV-${Date.now().toString().slice(-6)}`);
        setSaleNotes('');
        setSaleCart([]);
      },
    });
  };

  const handleEditSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSaleTarget) return;
    const itemPrices: Record<string, number> = {};
    for (const [sId, val] of Object.entries(editSalePrices)) {
      itemPrices[sId] = Math.max(0, Number(val || 0));
    }
    const target = editSaleTarget;
    const payload = {
      saleId: target.saleId,
      invoiceNumber: editSaleInvoice.trim(),
      customerId: editSaleCustomerId,
      branchId: editSaleBranchId,
      salespersonId: editSaleSalespersonId,
      saleDateIso: new Date(editSaleDateLocal || target.saleDateIso).toISOString(),
      notes: editSaleNotes,
      itemPrices,
    };
    setEditSaleTarget(null);

    requestPasswordConfirm({
      title: 'Confirm Edit Sales Invoice',
      description: `Update Sales Invoice #${payload.invoiceNumber}, recalculate profit, and sync serial history.`,
      confirmLabel: 'Save Sales Changes',
      execute: async (pw) => {
        await editErpSale(payload, pw);
      },
    });
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    const { type, serial } = returnTarget;
    const reason = returnReason.trim();
    setReturnTarget(null);

    requestPasswordConfirm({
      title:
        type === 'purchase_return'
          ? 'Confirm Purchase Return to Vendor'
          : 'Confirm Customer Sales Return',
      description:
        type === 'purchase_return'
          ? `Return serial "${serial.serialNumber}" (${serial.productName}) back to vendor ${serial.vendorName} and remove from stock.`
          : `Process Sales Return for serial "${serial.serialNumber}" (${serial.productName}), restock into ${serial.branchName}, and adjust profit.`,
      confirmLabel: type === 'purchase_return' ? 'Confirm Purchase Return' : 'Confirm Sales Return',
      danger: type === 'purchase_return',
      execute: async (pw) => {
        if (type === 'purchase_return') {
          await createErpPurchaseReturn({ serialId: serial.serialId, reason }, pw);
        } else {
          await createErpSalesReturn({ serialId: serial.serialId, reason }, pw);
        }
        setReturnReason('');
      },
    });
  };

  const handleEditReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReturnTarget) return;
    const target = editReturnTarget;
    const payload = {
      returnId: target.returnId,
      returnNumber: editRetNumber.trim(),
      reason: editRetReason.trim(),
      amount: Math.max(0, Number(editRetAmount || 0)),
      returnDateIso: new Date(editRetDateLocal || target.returnDateIso).toISOString(),
    };
    setEditReturnTarget(null);

    requestPasswordConfirm({
      title: 'Confirm Edit Return Record',
      description: `Update Return #${payload.returnNumber} for serial ${target.serialNumber}.`,
      confirmLabel: 'Save Return Changes',
      execute: async (pw) => {
        await editErpReturn(payload, pw);
      },
    });
  };

  const handleEditSerialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSerialTarget) return;
    const payload = {
      serialId: editSerialTarget.serialId,
      serialNumber: editSerialNumber.trim(),
      branchId: editSerialBranchId,
      purchaseCost: Math.max(0, Number(editSerialCost || 0)),
      salePrice: Math.max(0, Number(editSerialPrice || 0)),
    };
    setEditSerialTarget(null);

    requestPasswordConfirm({
      title: 'Confirm Edit Serial Record',
      description: `Save updates for serial "${payload.serialNumber}" (Branch transfer / Cost / Price).`,
      confirmLabel: 'Save Serial Changes',
      execute: async (pw) => {
        await editErpSerial(payload, pw);
      },
    });
  };

  // Setup save handlers
  const handleModelSave = (e: React.FormEvent) => {
    e.preventDefault();
    setModelFormError(null);
    if (modelForm.brand.trim().length < 1 || modelForm.modelName.trim().length < 1) {
      setModelFormError('Brand and Model Code/Name are required.');
      return;
    }
    if (modelForm.productName.trim().length < 2) {
      setModelFormError('Product Name must be at least 2 characters.');
      return;
    }
    requestPasswordConfirm({
      title: editingModelId ? 'Confirm Update Setup Model' : 'Confirm Add Setup Model',
      description: `${editingModelId ? 'Update' : 'Register'} "${modelForm.productName.trim()}" (${modelForm.brand.trim()} ${modelForm.modelName.trim()}) for ERP stock consolidation.`,
      confirmLabel: editingModelId ? 'Save Model' : 'Add Model',
      execute: async (pw) => {
        await saveErpModel(
          {
            brand: modelForm.brand,
            modelName: modelForm.modelName,
            productName: modelForm.productName,
            category: modelForm.category,
            defaultBuyPrice: Number(modelForm.defaultBuyPrice || 0),
            defaultSellPrice: Number(modelForm.defaultSellPrice || 0),
            warranty: modelForm.warranty,
          },
          editingModelId || undefined,
          pw
        );
        setEditingModelId(null);
        setModelForm({
          brand: '',
          modelName: '',
          productName: '',
          category: 'Laptops',
          defaultBuyPrice: '',
          defaultSellPrice: '',
          warranty: '2 Years Official Warranty',
        });
      },
    });
  };

  const handleVendorSave = (e: React.FormEvent) => {
    e.preventDefault();
    setVendorFormError(null);
    if (vendorForm.name.trim().length < 2) {
      setVendorFormError('Vendor Name must be at least 2 characters.');
      return;
    }
    requestPasswordConfirm({
      title: editingVendorId ? 'Confirm Update Vendor' : 'Confirm Add Vendor',
      description: `${editingVendorId ? 'Update' : 'Save'} vendor "${vendorForm.name.trim()}".`,
      confirmLabel: editingVendorId ? 'Save Vendor' : 'Add Vendor',
      execute: async (pw) => {
        await saveErpVendor(vendorForm, editingVendorId || undefined, pw);
        setEditingVendorId(null);
        setVendorForm({ name: '', company: '', phone: '', email: '', address: '', notes: '' });
      },
    });
  };

  const handleCustomerSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerFormError(null);
    if (customerForm.name.trim().length < 2) {
      setCustomerFormError('Customer Name must be at least 2 characters.');
      return;
    }
    requestPasswordConfirm({
      title: editingCustomerId ? 'Confirm Update Customer' : 'Confirm Add Customer',
      description: `${editingCustomerId ? 'Update' : 'Save'} ERP customer "${customerForm.name.trim()}".`,
      confirmLabel: editingCustomerId ? 'Save Customer' : 'Add Customer',
      execute: async (pw) => {
        await saveErpCustomer(customerForm, editingCustomerId || undefined, pw);
        setEditingCustomerId(null);
        setCustomerForm({
          name: '',
          company: '',
          phone: '',
          email: '',
          city: 'Dhaka',
          address: '',
          notes: '',
        });
      },
    });
  };

  const handleBranchSave = (e: React.FormEvent) => {
    e.preventDefault();
    setBranchFormError(null);
    if (branchForm.name.trim().length < 2 || branchForm.location.trim().length < 2) {
      setBranchFormError('Branch Name and Location must be at least 2 characters.');
      return;
    }
    requestPasswordConfirm({
      title: editingBranchId ? 'Confirm Update Branch' : 'Confirm Add Branch',
      description: `${editingBranchId ? 'Update' : 'Save'} branch "${branchForm.name.trim()}".`,
      confirmLabel: editingBranchId ? 'Save Branch' : 'Add Branch',
      execute: async (pw) => {
        await saveErpBranch(branchForm, editingBranchId || undefined, pw);
        setEditingBranchId(null);
        setBranchForm({ name: '', location: '', phone: '' });
      },
    });
  };

  const headerMeta = TAB_HEADER_META[activeTab];
  const HeaderIcon = headerMeta.icon;

  return (
    <div className="space-y-6">
      {/* Focused Single-Tab Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#081621] to-[#112A3E] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
              <HeaderIcon className="w-5 h-5 text-[#EF4A23]" />
              {headerMeta.title}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">{headerMeta.subtitle}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">In Stock</span>
              <span className="font-bold text-white">{stockSummary.totalUnits} units</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Models</span>
              <span className="font-bold text-white">{activeModels.length}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Branches</span>
              <span className="font-bold text-white">{activeBranches.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          TAB: STOCK ONLY ('erp-stock')
         ========================================================= */}
      {activeTab === 'erp-stock' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Filtered In-Stock Units</p>
              <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {stockSummary.totalUnits}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Models With Stock</p>
              <p className="font-mono text-2xl font-bold text-[#3749BB] mt-1 tabular-nums">
                {stockSummary.inStockModelCount}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Purchase Cost Value</p>
              <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatCurrency(stockSummary.totalCostValuation)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Est. Retail Value</p>
              <p className="font-mono text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                {formatCurrency(stockSummary.totalRetailValuation)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Brand
                </label>
                <select
                  value={stockBrandFilter}
                  onChange={(e) => {
                    setStockBrandFilter(e.target.value);
                    setStockModelFilter('all');
                  }}
                  aria-label="Filter stock by brand"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                >
                  <option value="all">All Brands</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Branch
                </label>
                <select
                  value={stockBranchFilter}
                  onChange={(e) => setStockBranchFilter(e.target.value)}
                  aria-label="Filter stock by branch"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                >
                  <option value="all">All Branches</option>
                  {activeBranches.map((br) => (
                    <option key={br.branchId} value={br.branchId}>
                      {br.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Model
                </label>
                <select
                  value={stockModelFilter}
                  onChange={(e) => setStockModelFilter(e.target.value)}
                  aria-label="Filter stock by model"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                >
                  <option value="all">All Models</option>
                  {modelFilterOptions.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.brand} — {m.modelName} ({m.productName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Keyword / Serial
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={stockKeyword}
                    onChange={(e) => setStockKeyword(e.target.value)}
                    placeholder="Product name or serial..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1">Display:</span>
                {(
                  [
                    { id: 'name-qty', label: 'Name & Qty Only' },
                    { id: 'with-price', label: 'With Price' },
                    { id: 'with-serials', label: 'With Serials' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setStockDisplayMode(mode.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      stockDisplayMode === mode.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {(stockBrandFilter !== 'all' ||
                stockBranchFilter !== 'all' ||
                stockModelFilter !== 'all' ||
                stockKeyword) && (
                <button
                  type="button"
                  onClick={() => {
                    setStockBrandFilter('all');
                    setStockBranchFilter('all');
                    setStockModelFilter('all');
                    setStockKeyword('');
                  }}
                  className="text-xs font-semibold text-[#3749BB] hover:underline self-start sm:self-center cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {stockSummary.rows.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Boxes className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-800">
                  {activeModels.length === 0
                    ? 'No Setup Models registered yet.'
                    : 'No matching stock items found.'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {activeModels.length === 0
                    ? 'Register your Branches, Vendors, Customers, and Product Models in the Setup tab, then record a Purchase to add serialized stock.'
                    : 'Try clearing filters or record a new Vendor Purchase to add stock.'}
                </p>
                {activeModels.length === 0 && canErpSetup && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('erp-setup')}
                    className="px-4 py-2 rounded-lg bg-[#EF4A23] text-white text-xs font-semibold hover:bg-[#D93E18] cursor-pointer"
                  >
                    Open Setup Tab
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Product Name</th>
                      {stockDisplayMode !== 'name-qty' && (
                        <th className="py-3 px-4">Brand / Model</th>
                      )}
                      {stockDisplayMode === 'with-price' && (
                        <>
                          <th className="py-3 px-4 text-right">Avg Buy Cost</th>
                          <th className="py-3 px-4 text-right">Sale Price</th>
                          <th className="py-3 px-4 text-right">Stock Cost Value</th>
                        </>
                      )}
                      {stockDisplayMode === 'with-serials' && (
                        <th className="py-3 px-4">
                          In-Stock Serials {canErpEdit ? '(Edit or View History)' : ''}
                        </th>
                      )}
                      <th className="py-3 px-4 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {stockSummary.rows.map((row) => (
                      <tr key={row.modelId} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{row.productName}</p>
                          {stockDisplayMode === 'name-qty' && row.branchCounts.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {row.branchCounts.map((b) => `${b.branchName}: ${b.count}`).join(' · ')}
                            </p>
                          )}
                        </td>

                        {stockDisplayMode !== 'name-qty' && (
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{row.brand}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="font-mono">{row.modelName}</span>
                          </td>
                        )}

                        {stockDisplayMode === 'with-price' && (
                          <>
                            <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                              {formatCurrency(row.avgCost)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                              {formatCurrency(row.defaultSellPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(row.totalCostValue)}
                            </td>
                          </>
                        )}

                        {stockDisplayMode === 'with-serials' && (
                          <td className="py-3 px-4">
                            {row.serials.length === 0 ? (
                              <span className="text-xs text-slate-400">Out of stock</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {row.serials.map((sn) => (
                                  <div
                                    key={sn.serialId}
                                    className="inline-flex items-center rounded border border-slate-200 bg-slate-50 overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        jumpToSerialHistory(sn.serialId, sn.serialNumber)
                                      }
                                      title={
                                        canErpSerialSearch
                                          ? `Inspect lifetime history of ${sn.serialNumber}`
                                          : sn.serialNumber
                                      }
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-slate-700 ${
                                        canErpSerialSearch
                                          ? 'hover:bg-blue-50 hover:text-[#3749BB] cursor-pointer'
                                          : 'cursor-default'
                                      }`}
                                    >
                                      <span>{sn.serialNumber}</span>
                                      <span className="text-[10px] text-slate-400">
                                        ({sn.branchName})
                                      </span>
                                    </button>
                                    {canErpEdit && (
                                      <button
                                        type="button"
                                        onClick={() => openEditSerialModal(sn)}
                                        title={`Edit serial ${sn.serialNumber}`}
                                        className="px-1.5 py-0.5 border-l border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-[#3749BB] cursor-pointer"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )}

                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded font-mono text-xs font-bold tabular-nums ${
                              row.quantity > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {row.quantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: PURCHASE ONLY ('erp-purchase')
         ========================================================= */}
      {activeTab === 'erp-purchase' && (
        <div className="space-y-6">
          {canErpPurchase && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    New Vendor Purchase Entry (Auto-Adds to Stock)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a Model from Setup so repeat purchases automatically add quantity under the exact same Product Name.
                  </p>
                </div>
                {canErpSetup && (activeModels.length === 0 || activeVendors.length === 0 || activeBranches.length === 0) && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('erp-setup')}
                    className="px-3 py-1.5 rounded bg-[#3749BB] text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Complete Setup First
                  </button>
                )}
              </div>

              <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-5">
                {purError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {purError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Purchase Invoice # *
                    </label>
                    <input
                      type="text"
                      required
                      value={purInvoice}
                      onChange={(e) => setPurInvoice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor *
                    </label>
                    <select
                      required
                      value={purVendorId}
                      onChange={(e) => setPurVendorId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">Select Vendor...</option>
                      {activeVendors.map((v) => (
                        <option key={v.vendorId} value={v.vendorId}>
                          {v.name}
                          {v.company ? ` (${v.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destination Branch *
                    </label>
                    <select
                      required
                      value={purBranchId}
                      onChange={(e) => setPurBranchId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">Select Branch...</option>
                      {activeBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Purchase Notes
                    </label>
                    <input
                      type="text"
                      value={purNotes}
                      onChange={(e) => setPurNotes(e.target.value)}
                      placeholder="Challan or shipment memo"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                      Purchase Model Lines & Serial Numbers
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPurchaseLine}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Model Line
                    </button>
                  </div>

                  {purLines.map((line, index) => {
                    const parsedCount = parseSerialList(line.serialsText).length;
                    return (
                      <div
                        key={line.key}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-6">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Line {index + 1}: Setup Model *
                            </label>
                            <select
                              required
                              value={line.modelId}
                              onChange={(e) => {
                                const mId = e.target.value;
                                const model = activeModels.find((m) => m.modelId === mId);
                                setPurLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
                                          modelId: mId,
                                          unitCost:
                                            model && !l.unitCost
                                              ? String(model.defaultBuyPrice)
                                              : l.unitCost,
                                        }
                                      : l
                                  )
                                );
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                            >
                              <option value="">Select Product / Model...</option>
                              {activeModels.map((m) => (
                                <option key={m.modelId} value={m.modelId}>
                                  {m.brand} {m.modelName} — {m.productName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Unit Purchase Cost (BDT) *
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              required
                              value={line.unitCost}
                              onChange={(e) =>
                                setPurLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key ? { ...l, unitCost: e.target.value } : l
                                  )
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                            />
                          </div>

                          <div className="sm:col-span-3 flex items-center justify-between gap-2">
                            <div className="text-xs font-mono text-slate-700">
                              <span className="block text-[10px] text-slate-500 uppercase">
                                Line Total
                              </span>
                              <span className="font-bold">
                                {parsedCount} × {formatCurrency(Number(line.unitCost || 0))}
                              </span>
                            </div>
                            {purLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPurLines((prev) => prev.filter((l) => l.key !== line.key))
                                }
                                className="p-2 rounded text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Remove line"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Serial Numbers * (One per line or comma-separated — {parsedCount}{' '}
                              entered)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={autoGenQtyMap[line.key] ?? 5}
                                onChange={(e) =>
                                  setAutoGenQtyMap((prev) => ({
                                    ...prev,
                                    [line.key]: Number(e.target.value || 1),
                                  }))
                                }
                                className="w-14 px-2 py-1 rounded border border-slate-200 bg-white text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleAutoGenerateSerials(line.key, line.modelId)}
                                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                              >
                                Auto-Generate Serials
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={line.serialsText}
                            onChange={(e) =>
                              setPurLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, serialsText: e.target.value } : l
                                )
                              )
                            }
                            placeholder="Scan barcode or paste serial numbers..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  <div className="text-sm font-mono tabular-nums text-slate-800">
                    Total Purchase:{' '}
                    <span className="font-bold text-slate-900">
                      {purchaseSummary.units} unit(s)
                    </span>{' '}
                    ·{' '}
                    <span className="font-bold text-[#3749BB]">
                      {formatCurrency(purchaseSummary.total)}
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[42px]"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Record Purchase & Add to Stock
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Purchase Vouchers History + Edit */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Purchase Vouchers ({erpPurchases.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All vendor purchase entries. Use the Purchase Return tab to return items to vendors.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={purSearch}
                  onChange={(e) => setPurSearch(e.target.value)}
                  placeholder="Search invoice, vendor, serial..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching purchase vouchers found.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredPurchases.map((p) => {
                  const voucherSerials = erpSerials.filter((s) => s.purchaseId === p.purchaseId);
                  return (
                    <div key={p.purchaseId} className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              #{p.invoiceNumber}
                            </span>
                            <span className="text-xs text-slate-600">
                              Vendor: <strong className="text-slate-900">{p.vendorName}</strong>
                            </span>
                            <span className="text-xs text-slate-600">
                              Branch: <strong className="text-slate-900">{p.branchName}</strong>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                p.status === 'returned'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : p.status === 'partial_return'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {p.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDateTimeFull(p.purchaseDateIso)} · Recorded by {p.createdByName}
                            {p.notes ? ` · ${p.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono tabular-nums">
                            <p className="text-sm font-bold text-slate-900">
                              {formatCurrency(p.totalAmount)}
                            </p>
                            <p className="text-[11px] text-slate-500">{p.totalUnits} unit(s)</p>
                          </div>
                          {canErpEdit && (
                            <button
                              type="button"
                              onClick={() => openEditPurchaseModal(p)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#3749BB]" />
                              Edit Purchase
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {p.items.map((item) => (
                          <div
                            key={item.modelId}
                            className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-slate-800">
                              {item.productName} ({item.brand} {item.modelName}) × {item.quantity}
                            </span>
                            <span className="font-mono text-slate-700">
                              {formatCurrency(item.unitCost)}/unit · {formatCurrency(item.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {voucherSerials.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {voucherSerials.map((sn) => (
                            <button
                              key={sn.serialId}
                              type="button"
                              onClick={() => jumpToSerialHistory(sn.serialId, sn.serialNumber)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono ${
                                sn.status === 'in_stock'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : sn.status === 'sold'
                                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                                    : 'bg-red-50 border-red-200 text-red-700'
                              } ${canErpSerialSearch ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                            >
                              <span>{sn.serialNumber}</span>
                              <span className="text-[10px] opacity-75">
                                ({sn.status.replace('_', ' ')})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: PURCHASE RETURN ONLY ('erp-purchase-return')
         ========================================================= */}
      {activeTab === 'erp-purchase-return' && (
        <div className="space-y-6">
          {canErpPurchaseReturn && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Process Purchase Return to Vendor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select any currently In-Stock serial number to return to its supplier and automatically deduct it from stock.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={purRetQuery}
                      onChange={(e) => setPurRetQuery(e.target.value)}
                      placeholder="Serial, product name, purchase invoice..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                  <select
                    value={purRetBranchFilter}
                    onChange={(e) => setPurRetBranchFilter(e.target.value)}
                    aria-label="Filter by branch"
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  >
                    <option value="all">All Branches</option>
                    {activeBranches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={purRetVendorFilter}
                    onChange={(e) => setPurRetVendorFilter(e.target.value)}
                    aria-label="Filter by vendor"
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  >
                    <option value="all">All Vendors</option>
                    {activeVendors.map((v) => (
                      <option key={v.vendorId} value={v.vendorId}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {purchaseReturnCandidates.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No In-Stock serials match your filter for Purchase Return.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Serial Number</th>
                          <th className="py-2.5 px-3">Product / Model</th>
                          <th className="py-2.5 px-3">Vendor</th>
                          <th className="py-2.5 px-3">Purchase Inv</th>
                          <th className="py-2.5 px-3">Branch</th>
                          <th className="py-2.5 px-3 text-right">Buy Cost</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {purchaseReturnCandidates.map((sn) => (
                          <tr key={sn.serialId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => jumpToSerialHistory(sn.serialId, sn.serialNumber)}
                                className={
                                  canErpSerialSearch
                                    ? 'text-[#3749BB] hover:underline cursor-pointer'
                                    : ''
                                }
                              >
                                {sn.serialNumber}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-medium">
                              {sn.productName}
                              <span className="block text-[11px] text-slate-500">
                                {sn.brand} {sn.modelName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{sn.vendorName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              #{sn.purchaseInvoice}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{sn.branchName}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatCurrency(sn.purchaseCost)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnReason('');
                                  setReturnTarget({ type: 'purchase_return', serial: sn });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold cursor-pointer"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Return to Vendor
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Purchase Returns History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Purchase Returns History ({purchaseReturnsHistory.length})
              </h3>
            </div>

            {purchaseReturnsHistory.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No purchase returns recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Return # / Date</th>
                      <th className="py-3 px-4">Serial & Product</th>
                      <th className="py-3 px-4">Vendor & Orig. Invoice</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-right">Cost Returned</th>
                      {canErpEdit && <th className="py-3 px-4 text-right">Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseReturnsHistory.map((r) => (
                      <tr key={r.returnId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-red-700 block">
                            #{r.returnNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDateTimeFull(r.returnDateIso)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => jumpToSerialHistory(r.serialId, r.serialNumber)}
                            className={`font-mono font-semibold text-slate-900 ${
                              canErpSerialSearch ? 'hover:text-[#3749BB] hover:underline cursor-pointer' : ''
                            }`}
                          >
                            {r.serialNumber}
                          </button>
                          <span className="block text-[11px] text-slate-500">{r.productName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <span className="font-semibold">{r.partyName}</span>
                          <span className="block text-[11px] text-slate-500">
                            Ref Inv #{r.refInvoiceNumber} · {r.branchName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{r.reason}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(r.amount)}
                        </td>
                        {canErpEdit && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditReturnModal(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-[#3749BB]" />
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: SALES ORDER ONLY ('erp-sales')
         ========================================================= */}
      {activeTab === 'erp-sales' && (
        <div className="space-y-6">
          {canErpSale && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Create ERP Sales Order
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sales Person must be selected from your stored Managers so Profit Reports stay accurate.
                  </p>
                </div>
                {activeManagers.length === 0 && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('users')}
                    className="px-3 py-1.5 rounded bg-[#EF4A23] text-white text-xs font-semibold cursor-pointer"
                  >
                    Add Manager First
                  </button>
                )}
              </div>

              <form onSubmit={handleSaleSubmit} className="p-6 space-y-5">
                {saleError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {saleError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sales Invoice # *
                    </label>
                    <input
                      type="text"
                      required
                      value={saleInvoice}
                      onChange={(e) => setSaleInvoice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer (Setup) *
                    </label>
                    <select
                      required
                      value={saleCustomerId}
                      onChange={(e) => setSaleCustomerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">Select Customer...</option>
                      {activeCustomers.map((c) => (
                        <option key={c.customerId} value={c.customerId}>
                          {c.name}
                          {c.phone ? ` (${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch *
                    </label>
                    <select
                      required
                      value={saleBranchId}
                      onChange={(e) => {
                        setSaleBranchId(e.target.value);
                        setSaleCart([]);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">Select Branch...</option>
                      {activeBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sales Person (Stored Managers) *
                    </label>
                    <select
                      required
                      value={saleSalespersonId}
                      onChange={(e) => setSaleSalespersonId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">Select Manager...</option>
                      {activeManagers.map((m) => (
                        <option key={m.staffId} value={m.staffId}>
                          {m.displayName} (@{m.username})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Serial Picker + Selected Cart */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6 border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Available In-Stock Serials {saleBranchId ? '' : '(Select Branch)'}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={saleSerialSearch}
                        onChange={(e) => setSaleSerialSearch(e.target.value)}
                        placeholder="Search serial or product name..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
                      {!saleBranchId ? (
                        <p className="p-4 text-xs text-slate-500 text-center">
                          Choose a Branch above to view serials available for sale.
                        </p>
                      ) : availableSaleSerials.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500 text-center">
                          No matching in-stock serials in this branch.
                        </p>
                      ) : (
                        availableSaleSerials.slice(0, 40).map((sn) => {
                          const model = erpModels.find((m) => m.modelId === sn.modelId);
                          const defaultSell = model?.defaultSellPrice || sn.salePrice || sn.purchaseCost;
                          return (
                            <div
                              key={sn.serialId}
                              className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-blue-50/50"
                            >
                              <div className="min-w-0">
                                <p className="font-mono font-semibold text-slate-900 truncate">
                                  {sn.serialNumber}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {sn.productName} · Cost {formatCurrency(sn.purchaseCost)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSaleCart((prev) => [
                                    ...prev,
                                    { serial: sn, unitPrice: defaultSell },
                                  ])
                                }
                                className="px-2.5 py-1 rounded bg-[#3749BB] text-white text-[11px] font-semibold hover:bg-[#2A3998] shrink-0 cursor-pointer"
                              >
                                + Add
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-6 border border-slate-200 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Invoice Line Items ({saleCart.length})
                    </span>
                    {saleCart.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        Add serial numbers from the left list to build this Sales Order.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {saleCart.map((c) => {
                          const profit = Number(c.unitPrice || 0) - c.serial.purchaseCost;
                          return (
                            <div
                              key={c.serial.serialId}
                              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-mono font-semibold text-slate-900">
                                  {c.serial.serialNumber}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {c.serial.productName} · Cost {formatCurrency(c.serial.purchaseCost)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={c.unitPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value || 0);
                                    setSaleCart((prev) =>
                                      prev.map((item) =>
                                        item.serial.serialId === c.serial.serialId
                                          ? { ...item, unitPrice: val }
                                          : item
                                      )
                                    );
                                  }}
                                  aria-label={`Sale price for ${c.serial.serialNumber}`}
                                  className="w-24 px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs text-right"
                                />
                                <span
                                  className={`font-mono font-semibold w-20 text-right ${
                                    profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                                  }`}
                                >
                                  {profit >= 0 ? '+' : ''}
                                  {formatCurrency(profit)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSaleCart((prev) =>
                                      prev.filter((i) => i.serial.serialId !== c.serial.serialId)
                                    )
                                  }
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        value={saleNotes}
                        onChange={(e) => setSaleNotes(e.target.value)}
                        placeholder="Optional invoice notes..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-mono tabular-nums">
                    <span>
                      Total:{' '}
                      <strong className="text-slate-900">
                        {formatCurrency(saleCart.reduce((s, i) => s + Number(i.unitPrice || 0), 0))}
                      </strong>
                    </span>
                    <span>
                      Est. Profit:{' '}
                      <strong className="text-emerald-700">
                        {formatCurrency(
                          saleCart.reduce(
                            (s, i) => s + (Number(i.unitPrice || 0) - i.serial.purchaseCost),
                            0
                          )
                        )}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[42px]"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Complete Sales Order
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sales Invoices List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  ERP Sales Invoices ({erpSales.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expand an invoice to view sold serials, or edit invoice details if permitted.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={saleListSearch}
                  onChange={(e) => setSaleListSearch(e.target.value)}
                  placeholder="Search invoice, customer, serial..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
              </div>
            </div>

            {filteredSalesInvoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching sales invoices found.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredSalesInvoices.map((s) => {
                  const expanded = expandedSaleId === s.saleId;
                  const netRev = s.totalRevenue - s.returnedRevenue;
                  const netProfit = s.totalProfit - s.returnedProfit;
                  return (
                    <div key={s.saleId} className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              #{s.invoiceNumber}
                            </span>
                            <span className="text-xs text-slate-600">
                              Customer: <strong className="text-slate-900">{s.customerName}</strong>
                            </span>
                            <span className="text-xs text-slate-600">
                              Sales Person:{' '}
                              <strong className="text-[#3749BB]">{s.salespersonName}</strong>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                s.status === 'returned'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : s.status === 'partial_return'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDateTimeFull(s.saleDateIso)} · Branch: {s.branchName}
                            {s.notes ? ` · ${s.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="text-right font-mono text-xs tabular-nums">
                            <p className="font-bold text-slate-900">Rev: {formatCurrency(netRev)}</p>
                            <p
                              className={`font-semibold ${
                                netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              Profit: {formatCurrency(netProfit)}
                            </p>
                          </div>
                          {canErpEdit && (
                            <button
                              type="button"
                              onClick={() => openEditSaleModal(s)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#3749BB]" />
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedSaleId(expanded ? null : s.saleId)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {expanded ? 'Hide Serials' : `View Serials (${s.totalUnits})`}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          {s.items.map((item) => (
                            <div
                              key={item.serialId}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2"
                            >
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    jumpToSerialHistory(item.serialId, item.serialNumber)
                                  }
                                  className={`font-mono font-bold text-slate-900 ${
                                    canErpSerialSearch
                                      ? 'hover:text-[#3749BB] hover:underline cursor-pointer'
                                      : ''
                                  }`}
                                >
                                  {item.serialNumber}
                                </button>
                                <span className="text-slate-600 ml-2">{item.productName}</span>
                                {item.returned && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                    Sales Returned
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-slate-700">
                                Sold: {formatCurrency(item.unitPrice)} · Profit:{' '}
                                <span className="text-emerald-700 font-semibold">
                                  {formatCurrency(item.profit)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: SALES RETURN ONLY ('erp-sales-return')
         ========================================================= */}
      {activeTab === 'erp-sales-return' && (
        <div className="space-y-6">
          {canErpSalesReturn && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Process Customer Sales Return (Restock to Branch)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search any currently Sold serial number to bring it back into stock and adjust salesperson profit.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={saleRetQuery}
                      onChange={(e) => setSaleRetQuery(e.target.value)}
                      placeholder="Serial, customer, sales invoice..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                  <select
                    value={saleRetBranchFilter}
                    onChange={(e) => setSaleRetBranchFilter(e.target.value)}
                    aria-label="Filter by branch"
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  >
                    <option value="all">All Branches</option>
                    {activeBranches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={saleRetSalespersonFilter}
                    onChange={(e) => setSaleRetSalespersonFilter(e.target.value)}
                    aria-label="Filter by salesperson"
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  >
                    <option value="all">All Managers</option>
                    {activeManagers.map((m) => (
                      <option key={m.staffId} value={m.staffId}>
                        {m.displayName} (@{m.username})
                      </option>
                    ))}
                  </select>
                </div>

                {salesReturnCandidates.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No currently Sold serials match your search.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Serial Number</th>
                          <th className="py-2.5 px-3">Product / Model</th>
                          <th className="py-2.5 px-3">Customer & Invoice</th>
                          <th className="py-2.5 px-3">Sales Person</th>
                          <th className="py-2.5 px-3">Branch</th>
                          <th className="py-2.5 px-3 text-right">Sale Price</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {salesReturnCandidates.map((sn) => (
                          <tr key={sn.serialId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => jumpToSerialHistory(sn.serialId, sn.serialNumber)}
                                className={
                                  canErpSerialSearch
                                    ? 'text-[#3749BB] hover:underline cursor-pointer'
                                    : ''
                                }
                              >
                                {sn.serialNumber}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-medium">
                              {sn.productName}
                              <span className="block text-[11px] text-slate-500">
                                {sn.brand} {sn.modelName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {sn.lastCustomerName || 'Customer'}
                              <span className="block font-mono text-[11px] text-slate-500">
                                #{sn.lastSaleInvoice}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#3749BB] font-medium">
                              {sn.salespersonName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{sn.branchName}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatCurrency(sn.salePrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnReason('');
                                  setReturnTarget({ type: 'sales_return', serial: sn });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Sales Return
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sales Returns History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Sales Returns History ({salesReturnsHistory.length})
              </h3>
            </div>

            {salesReturnsHistory.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No customer sales returns recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Return # / Date</th>
                      <th className="py-3 px-4">Serial & Product</th>
                      <th className="py-3 px-4">Customer & Ref Inv</th>
                      <th className="py-3 px-4">Sales Person</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-right">Refund Amount</th>
                      {canErpEdit && <th className="py-3 px-4 text-right">Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesReturnsHistory.map((r) => (
                      <tr key={r.returnId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-700 block">
                            #{r.returnNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDateTimeFull(r.returnDateIso)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => jumpToSerialHistory(r.serialId, r.serialNumber)}
                            className={`font-mono font-semibold text-slate-900 ${
                              canErpSerialSearch ? 'hover:text-[#3749BB] hover:underline cursor-pointer' : ''
                            }`}
                          >
                            {r.serialNumber}
                          </button>
                          <span className="block text-[11px] text-slate-500">{r.productName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <span className="font-semibold">{r.partyName}</span>
                          <span className="block text-[11px] text-slate-500">
                            Ref Inv #{r.refInvoiceNumber} · {r.branchName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#3749BB] font-medium">{r.salespersonName}</td>
                        <td className="py-3 px-4 text-slate-600">{r.reason}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(r.amount)}
                        </td>
                        {canErpEdit && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditReturnModal(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-[#3749BB]" />
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: MONTHLY PROFIT REPORT ONLY ('erp-profit')
         ========================================================= */}
      {activeTab === 'erp-profit' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Report Period & Branch Filter
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Net Revenue & Net Profit automatically exclude sales-returned units.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={reportBranchFilter}
                onChange={(e) => setReportBranchFilter(e.target.value)}
                aria-label="Filter report by branch"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              >
                <option value="all">All Branches</option>
                {activeBranches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.name}
                  </option>
                ))}
              </select>

              <input
                type="month"
                disabled={reportAllMonths}
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono disabled:opacity-50"
              />

              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reportAllMonths}
                  onChange={(e) => setReportAllMonths(e.target.checked)}
                  className="rounded border-slate-300 text-[#3749BB]"
                />
                All Months
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">Period Net Units Sold</p>
              <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {monthlyReport.totals.unitsSold}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">Net Sales Revenue</p>
              <p className="font-mono text-xl sm:text-2xl font-bold text-[#3749BB] mt-1 tabular-nums">
                {formatCurrency(monthlyReport.totals.netRevenue)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">Cost of Goods Sold</p>
              <p className="font-mono text-xl sm:text-2xl font-bold text-slate-700 mt-1 tabular-nums">
                {formatCurrency(monthlyReport.totals.netCost)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">Period Net Profit</p>
              <p
                className={`font-mono text-xl sm:text-2xl font-bold mt-1 tabular-nums ${
                  monthlyReport.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatCurrency(monthlyReport.totals.netProfit)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Salesperson Revenue & Profit Breakdown (
                {reportAllMonths ? 'All Months' : reportMonth})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Sales Person (Manager)</th>
                    <th className="py-3 px-4 text-right">Invoices</th>
                    <th className="py-3 px-4 text-right">Net Units</th>
                    <th className="py-3 px-4 text-right">Returned</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">Cost</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyReport.rows.map((r) => {
                    const margin =
                      r.netRevenue > 0 ? Math.round((r.netProfit / r.netRevenue) * 1000) / 10 : 0;
                    return (
                      <tr key={r.salespersonId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {r.salespersonName}{' '}
                          <span className="font-mono font-normal text-slate-500">
                            @{r.salespersonUsername}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{r.invoices}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{r.unitsSold}</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-700 tabular-nums">
                          {r.returnedUnits}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(r.netRevenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                          {formatCurrency(r.netCost)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                            r.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(r.netProfit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                          {margin}%
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="py-3 px-4 text-slate-900">TOTAL</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {monthlyReport.totals.invoices}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {monthlyReport.totals.unitsSold}
                    </td>
                    <td className="py-3 px-4 text-right">—</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 tabular-nums">
                      {formatCurrency(monthlyReport.totals.netRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {formatCurrency(monthlyReport.totals.netCost)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        monthlyReport.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(monthlyReport.totals.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {monthlyReport.totals.netRevenue > 0
                        ? `${Math.round(
                            (monthlyReport.totals.netProfit / monthlyReport.totals.netRevenue) *
                              1000
                          ) / 10}%`
                        : '0%'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Invoices Included in Period ({monthlyReport.relevantSales.length})
              </h3>
            </div>
            {monthlyReport.relevantSales.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No sales invoices recorded in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Invoice #</th>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Sales Person</th>
                      <th className="py-2.5 px-4">Customer / Branch</th>
                      <th className="py-2.5 px-4 text-right">Net Revenue</th>
                      <th className="py-2.5 px-4 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyReport.relevantSales.map((s) => {
                      const netRev = s.totalRevenue - s.returnedRevenue;
                      const netProfit = s.totalProfit - s.returnedProfit;
                      return (
                        <tr key={s.saleId} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            #{s.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {formatDateTimeFull(s.saleDateIso)}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#3749BB]">
                            {s.salespersonName}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {s.customerName} ({s.branchName})
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                            {formatCurrency(netRev)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(netProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: ADVANCE SERIAL SEARCH ONLY ('erp-serial-search')
         ========================================================= */}
      {activeTab === 'erp-serial-search' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={serialQuery}
                  onChange={(e) => {
                    setSerialQuery(e.target.value);
                    setSelectedSerialId(null);
                  }}
                  placeholder="Enter exact or partial Serial Number, Product, Invoice, Vendor, or Customer..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
              </div>

              <select
                value={serialStatusFilter}
                onChange={(e) =>
                  setSerialStatusFilter(
                    e.target.value as 'all' | 'in_stock' | 'sold' | 'purchase_returned'
                  )
                }
                aria-label="Filter serial status"
                className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              >
                <option value="all">All Statuses</option>
                <option value="in_stock">In Stock</option>
                <option value="sold">Sold</option>
                <option value="purchase_returned">Purchase Returned</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                Matching Serials ({matchingSerials.length})
              </div>
              {matchingSerials.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No serial numbers match your query.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                  {matchingSerials.map((sn) => {
                    const selected = inspectedSerial?.serialId === sn.serialId;
                    return (
                      <button
                        key={sn.serialId}
                        type="button"
                        onClick={() => setSelectedSerialId(sn.serialId)}
                        className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                          selected ? 'bg-blue-50/80 border-l-4 border-[#3749BB]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {sn.serialNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              sn.status === 'in_stock'
                                ? 'bg-emerald-50 text-emerald-700'
                                : sn.status === 'sold'
                                  ? 'bg-blue-50 text-[#3749BB]'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {sn.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium mt-0.5 truncate">
                          {sn.productName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {sn.brand} {sn.modelName} · {sn.branchName} ·{' '}
                          {sn.history?.length || 0} event(s)
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              {!inspectedSerial ? (
                <div className="p-10 text-center space-y-2 text-slate-500 text-sm">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <p>Select a serial number on the left to view its complete lifetime history.</p>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-bold text-slate-900">
                          {inspectedSerial.serialNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
                            inspectedSerial.status === 'in_stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inspectedSerial.status === 'sold'
                                ? 'bg-blue-50 text-[#3749BB] border border-blue-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {inspectedSerial.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1">
                        {inspectedSerial.productName} ({inspectedSerial.brand}{' '}
                        {inspectedSerial.modelName})
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Branch: {inspectedSerial.branchName} · Purchased from{' '}
                        <strong>{inspectedSerial.vendorName}</strong> (#
                        {inspectedSerial.purchaseInvoice}) · Cost{' '}
                        {formatCurrency(inspectedSerial.purchaseCost)}
                        {inspectedSerial.salePrice > 0
                          ? ` · Sale ${formatCurrency(inspectedSerial.salePrice)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {canErpEdit && (
                        <button
                          type="button"
                          onClick={() => openEditSerialModal(inspectedSerial)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#3749BB]" />
                          Edit Serial
                        </button>
                      )}
                      {inspectedSerial.status === 'in_stock' && canErpPurchaseReturn && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnReason('');
                            setReturnTarget({ type: 'purchase_return', serial: inspectedSerial });
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                        >
                          Purchase Return
                        </button>
                      )}
                      {inspectedSerial.status === 'sold' && canErpSalesReturn && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnReason('');
                            setReturnTarget({ type: 'sales_return', serial: inspectedSerial });
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
                        >
                          Sales Return
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#3749BB]" />
                      Complete Lifetime History (By Date & Time)
                    </h4>

                    {!inspectedSerial.history || inspectedSerial.history.length === 0 ? (
                      <p className="text-xs text-slate-500">No events recorded yet.</p>
                    ) : (
                      <ol className="relative border-l border-slate-200 ml-2.5 space-y-4">
                        {[...inspectedSerial.history]
                          .sort((a, b) => a.timestampMs - b.timestampMs)
                          .map((ev, idx) => {
                            const meta = HISTORY_BADGE[ev.type] || HISTORY_BADGE.PURCHASE;
                            return (
                              <li key={`${ev.refId}_${idx}`} className="ml-5 relative">
                                <span
                                  className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${meta.dotClass}`}
                                />
                                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.badgeClass}`}
                                    >
                                      {meta.label}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                      {formatDateTimeFull(ev.timestampIso)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-800 flex flex-wrap gap-x-4 gap-y-1">
                                    <span>
                                      Ref:{' '}
                                      <strong className="font-mono">#{ev.invoiceNumber}</strong>
                                    </span>
                                    <span>
                                      Party: <strong>{ev.partyName}</strong>
                                    </span>
                                    <span>
                                      Branch: <strong>{ev.branchName}</strong>
                                    </span>
                                    <span>
                                      By: <strong>{ev.salespersonName}</strong>
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                    <span className="text-slate-600 font-sans">
                                      {ev.notes || '—'}
                                    </span>
                                    <span className="font-semibold text-slate-900">
                                      Amount: {formatCurrency(ev.amount)}
                                      {ev.profit !== 0 &&
                                        ` · Profit Adj: ${ev.profit > 0 ? '+' : ''}${formatCurrency(
                                          ev.profit
                                        )}`}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB: SETUP ONLY ('erp-setup')
         ========================================================= */}
      {activeTab === 'erp-setup' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'models', label: `Product Name & Models (${erpModels.length})`, icon: Tag },
                { id: 'vendors', label: `Vendors (${erpVendors.length})`, icon: Truck },
                { id: 'customers', label: `Customers (${erpCustomers.length})`, icon: Users },
                { id: 'branches', label: `Branches (${erpBranches.length})`, icon: Building2 },
              ] as const
            ).map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSetupSection(sec.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    setupSection === sec.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* 1. SETUP MODELS */}
          {setupSection === 'models' && (
            <div className="space-y-5">
              {(canErpSetup || (canErpEdit && editingModelId)) && (
                <form
                  onSubmit={handleModelSave}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        {editingModelId
                          ? 'Edit Consolidated Model'
                          : 'Add Product Name & Model to Setup'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Every repeat purchase of a Setup model automatically consolidates under its exact Product Name in Stock.
                      </p>
                    </div>
                    {editingModelId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModelId(null);
                          setModelForm({
                            brand: '',
                            modelName: '',
                            productName: '',
                            category: 'Laptops',
                            defaultBuyPrice: '',
                            defaultSellPrice: '',
                            warranty: '2 Years Official Warranty',
                          });
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {modelFormError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {modelFormError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Brand *
                      </label>
                      <input
                        type="text"
                        required
                        value={modelForm.brand}
                        onChange={(e) => setModelForm((p) => ({ ...p, brand: e.target.value }))}
                        placeholder="e.g. ASUS, MSI, AMD"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Model Code / Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={modelForm.modelName}
                        onChange={(e) => setModelForm((p) => ({ ...p, modelName: e.target.value }))}
                        placeholder="e.g. FA507NU, 7800X3D"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={modelForm.category}
                        onChange={(e) => setModelForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      >
                        {ERP_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Consolidated Stock Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={modelForm.productName}
                        onChange={(e) =>
                          setModelForm((p) => ({ ...p, productName: e.target.value }))
                        }
                        placeholder="e.g. ASUS TUF Gaming A15 FA507NU"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Default Buy Price (BDT)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={modelForm.defaultBuyPrice}
                        onChange={(e) =>
                          setModelForm((p) => ({ ...p, defaultBuyPrice: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Default Sell Price (BDT)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={modelForm.defaultSellPrice}
                        onChange={(e) =>
                          setModelForm((p) => ({ ...p, defaultSellPrice: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <input
                      type="text"
                      value={modelForm.warranty}
                      onChange={(e) => setModelForm((p) => ({ ...p, warranty: e.target.value }))}
                      placeholder="Warranty terms"
                      className="sm:w-80 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {editingModelId ? 'Save Model Changes' : 'Add Setup Model'}
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">Brand / Model</th>
                        <th className="py-3 px-4 text-right">Buy Price</th>
                        <th className="py-3 px-4 text-right">Sell Price</th>
                        <th className="py-3 px-4">Status</th>
                        {canErpEdit && <th className="py-3 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {erpModels.map((m: ErpModel) => (
                        <tr key={m.modelId} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {m.productName}
                            <span className="block text-[11px] font-normal text-slate-500">
                              {m.category} · {m.warranty}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {m.brand} · {m.modelName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatCurrency(m.defaultBuyPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                            {formatCurrency(m.defaultSellPrice)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                m.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          {canErpEdit && (
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingModelId(m.modelId);
                                  setModelForm({
                                    brand: m.brand,
                                    modelName: m.modelName,
                                    productName: m.productName,
                                    category: m.category,
                                    defaultBuyPrice: String(m.defaultBuyPrice),
                                    defaultSellPrice: String(m.defaultSellPrice),
                                    warranty: m.warranty,
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[#3749BB] font-semibold hover:underline cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestPasswordConfirm({
                                    title:
                                      m.status === 'active' ? 'Archive Model' : 'Restore Model',
                                    description: `${
                                      m.status === 'active' ? 'Archive' : 'Restore'
                                    } model "${m.productName}".`,
                                    confirmLabel: m.status === 'active' ? 'Archive' : 'Restore',
                                    execute: async (pw) => {
                                      await saveErpModel(
                                        {
                                          brand: m.brand,
                                          modelName: m.modelName,
                                          productName: m.productName,
                                          category: m.category,
                                          defaultBuyPrice: m.defaultBuyPrice,
                                          defaultSellPrice: m.defaultSellPrice,
                                          warranty: m.warranty,
                                          status: m.status === 'active' ? 'archived' : 'active',
                                        },
                                        m.modelId,
                                        pw
                                      );
                                    },
                                  })
                                }
                                className="text-slate-600 font-semibold hover:underline cursor-pointer"
                              >
                                {m.status === 'active' ? 'Archive' : 'Restore'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {erpModels.length === 0 && (
                        <tr>
                          <td
                            colSpan={canErpEdit ? 6 : 5}
                            className="py-8 text-center text-slate-500"
                          >
                            No Setup models yet. Add your first model above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. SETUP VENDORS */}
          {setupSection === 'vendors' && (
            <div className="space-y-5">
              {(canErpSetup || (canErpEdit && editingVendorId)) && (
                <form
                  onSubmit={handleVendorSave}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {editingVendorId ? 'Edit Vendor' : 'Add Vendor / Supplier'}
                    </h3>
                    {editingVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVendorId(null);
                          setVendorForm({
                            name: '',
                            company: '',
                            phone: '',
                            email: '',
                            address: '',
                            notes: '',
                          });
                        }}
                        className="text-xs font-semibold text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {vendorFormError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {vendorFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Vendor Name *"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={vendorForm.company}
                      onChange={(e) => setVendorForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Company / Distributor"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone (+880...)"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={vendorForm.address}
                      onChange={(e) => setVendorForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Address"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={vendorForm.notes}
                      onChange={(e) => setVendorForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Payment terms / notes"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingVendorId ? 'Save Vendor' : 'Add Vendor'}
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpVendors.map((v: ErpVendor) => (
                  <div
                    key={v.vendorId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {v.name} {v.company ? `(${v.company})` : ''}
                      </p>
                      <p className="text-slate-500">
                        {[v.phone, v.email, v.address].filter(Boolean).join(' · ') || 'No contact info'}
                      </p>
                    </div>
                    {canErpEdit && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVendorId(v.vendorId);
                            setVendorForm({
                              name: v.name,
                              company: v.company,
                              phone: v.phone,
                              email: v.email,
                              address: v.address,
                              notes: v.notes,
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[#3749BB] font-semibold hover:underline cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestPasswordConfirm({
                              title: v.status === 'active' ? 'Archive Vendor' : 'Restore Vendor',
                              description: `${v.status === 'active' ? 'Archive' : 'Restore'} "${v.name}".`,
                              confirmLabel: v.status === 'active' ? 'Archive' : 'Restore',
                              execute: async (pw) => {
                                await saveErpVendor(
                                  { ...v, status: v.status === 'active' ? 'archived' : 'active' },
                                  v.vendorId,
                                  pw
                                );
                              },
                            })
                          }
                          className="text-slate-600 font-semibold hover:underline cursor-pointer"
                        >
                          {v.status === 'active' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {erpVendors.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">No vendors added yet.</div>
                )}
              </div>
            </div>
          )}

          {/* 3. SETUP CUSTOMERS */}
          {setupSection === 'customers' && (
            <div className="space-y-5">
              {(canErpSetup || canErpSale || (canErpEdit && editingCustomerId)) && (
                <form
                  onSubmit={handleCustomerSave}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {editingCustomerId ? 'Edit Customer' : 'Add ERP Customer'}
                    </h3>
                    {editingCustomerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomerId(null);
                          setCustomerForm({
                            name: '',
                            company: '',
                            phone: '',
                            email: '',
                            city: 'Dhaka',
                            address: '',
                            notes: '',
                          });
                        }}
                        className="text-xs font-semibold text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {customerFormError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {customerFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Customer Name *"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={customerForm.company}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Company (optional)"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder="City"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Address"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingCustomerId ? 'Save Customer' : 'Add Customer'}
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpCustomers.map((c: ErpCustomer) => (
                  <div
                    key={c.customerId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </p>
                      <p className="text-slate-500">
                        {[c.phone, c.email, c.city, c.address].filter(Boolean).join(' · ') ||
                          'No contact info'}
                      </p>
                    </div>
                    {canErpEdit && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomerId(c.customerId);
                            setCustomerForm({
                              name: c.name,
                              company: c.company,
                              phone: c.phone,
                              email: c.email,
                              city: c.city,
                              address: c.address,
                              notes: c.notes,
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[#3749BB] font-semibold hover:underline cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestPasswordConfirm({
                              title:
                                c.status === 'active' ? 'Archive Customer' : 'Restore Customer',
                              description: `${c.status === 'active' ? 'Archive' : 'Restore'} "${c.name}".`,
                              confirmLabel: c.status === 'active' ? 'Archive' : 'Restore',
                              execute: async (pw) => {
                                await saveErpCustomer(
                                  { ...c, status: c.status === 'active' ? 'archived' : 'active' },
                                  c.customerId,
                                  pw
                                );
                              },
                            })
                          }
                          className="text-slate-600 font-semibold hover:underline cursor-pointer"
                        >
                          {c.status === 'active' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {erpCustomers.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No ERP customers added yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. SETUP BRANCHES */}
          {setupSection === 'branches' && (
            <div className="space-y-5">
              {(canErpSetup || (canErpEdit && editingBranchId)) && (
                <form
                  onSubmit={handleBranchSave}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {editingBranchId ? 'Edit Branch' : 'Add Store / Warehouse Branch'}
                    </h3>
                    {editingBranchId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBranchId(null);
                          setBranchForm({ name: '', location: '', phone: '' });
                        }}
                        className="text-xs font-semibold text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {branchFormError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {branchFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      value={branchForm.name}
                      onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Branch Name (e.g. Multiplan Branch) *"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={branchForm.location}
                      onChange={(e) => setBranchForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Location (e.g. Elephant Road, Dhaka) *"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Branch Phone"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingBranchId ? 'Save Branch' : 'Add Branch'}
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpBranches.map((b: ErpBranch) => (
                  <div
                    key={b.branchId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{b.name}</p>
                      <p className="text-slate-500">
                        {b.location}
                        {b.phone ? ` · ${b.phone}` : ''}
                      </p>
                    </div>
                    {canErpEdit && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBranchId(b.branchId);
                            setBranchForm({ name: b.name, location: b.location, phone: b.phone });
                          }}
                          className="inline-flex items-center gap-1 text-[#3749BB] font-semibold hover:underline cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestPasswordConfirm({
                              title: b.status === 'active' ? 'Archive Branch' : 'Restore Branch',
                              description: `${b.status === 'active' ? 'Archive' : 'Restore'} "${b.name}".`,
                              confirmLabel: b.status === 'active' ? 'Archive' : 'Restore',
                              execute: async (pw) => {
                                await saveErpBranch(
                                  { ...b, status: b.status === 'active' ? 'archived' : 'active' },
                                  b.branchId,
                                  pw
                                );
                              },
                            })
                          }
                          className="text-slate-600 font-semibold hover:underline cursor-pointer"
                        >
                          {b.status === 'active' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {erpBranches.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No branches configured yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          MODAL 1: PURCHASE RETURN / SALES RETURN REASON
         ========================================================= */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {returnTarget.type === 'purchase_return'
                    ? 'Purchase Return to Vendor'
                    : 'Customer Sales Return'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Serial: {returnTarget.serial.serialNumber} · {returnTarget.serial.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Reason / Remarks
                </label>
                <input
                  type="text"
                  autoFocus
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder={
                    returnTarget.type === 'purchase_return'
                      ? 'e.g. DOA / Warranty replacement to vendor'
                      : 'e.g. Customer exchange or spec change'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                    returnTarget.type === 'purchase_return'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Continue to Password Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: EDIT PURCHASE VOUCHER
         ========================================================= */}
      {editPurchaseTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Edit Purchase Voucher #{editPurchaseTarget.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Updates voucher metadata, unit costs, and linked serial records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditPurchaseTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditPurchaseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPurInvoice}
                    onChange={(e) => setEditPurInvoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editPurDateLocal}
                    onChange={(e) => setEditPurDateLocal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor *
                  </label>
                  <select
                    required
                    value={editPurVendorId}
                    onChange={(e) => setEditPurVendorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    {activeVendors.map((v) => (
                      <option key={v.vendorId} value={v.vendorId}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Branch (In-Stock Items) *
                  </label>
                  <select
                    required
                    value={editPurBranchId}
                    onChange={(e) => setEditPurBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    {activeBranches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Unit Purchase Cost per Model (BDT)
                </label>
                {editPurchaseTarget.items.map((item) => (
                  <div
                    key={item.modelId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <span className="font-semibold text-slate-800">
                      {item.productName} (×{item.quantity})
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={editPurCosts[item.modelId] ?? ''}
                      onChange={(e) =>
                        setEditPurCosts((prev) => ({
                          ...prev,
                          [item.modelId]: e.target.value,
                        }))
                      }
                      className="w-28 px-2.5 py-1.5 rounded border border-slate-200 bg-white font-mono text-right"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editPurNotes}
                  onChange={(e) => setEditPurNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditPurchaseTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] cursor-pointer"
                >
                  Continue to Password Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: EDIT SALES INVOICE
         ========================================================= */}
      {editSaleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Edit Sales Invoice #{editSaleTarget.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Updates customer, salesperson attribution, sale date, and line prices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditSaleTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSaleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSaleInvoice}
                    onChange={(e) => setEditSaleInvoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sale Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editSaleDateLocal}
                    onChange={(e) => setEditSaleDateLocal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={editSaleCustomerId}
                    onChange={(e) => setEditSaleCustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    {activeCustomers.map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Branch *
                  </label>
                  <select
                    required
                    value={editSaleBranchId}
                    onChange={(e) => setEditSaleBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    {activeBranches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sales Person (Stored Managers) *
                  </label>
                  <select
                    required
                    value={editSaleSalespersonId}
                    onChange={(e) => setEditSaleSalespersonId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium"
                  >
                    {activeManagers.map((m) => (
                      <option key={m.staffId} value={m.staffId}>
                        {m.displayName} (@{m.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Item Sale Price (BDT)
                </label>
                {editSaleTarget.items.map((item) => (
                  <div
                    key={item.serialId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-slate-900 block">
                        {item.serialNumber}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.productName} · Cost {formatCurrency(item.unitCost)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={editSalePrices[item.serialId] ?? ''}
                      onChange={(e) =>
                        setEditSalePrices((prev) => ({
                          ...prev,
                          [item.serialId]: e.target.value,
                        }))
                      }
                      className="w-28 px-2.5 py-1.5 rounded border border-slate-200 bg-white font-mono text-right"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editSaleNotes}
                  onChange={(e) => setEditSaleNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditSaleTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] cursor-pointer"
                >
                  Continue to Password Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 4: EDIT RETURN RECORD
         ========================================================= */}
      {editReturnTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Edit{' '}
                  {editReturnTarget.returnType === 'purchase_return'
                    ? 'Purchase Return'
                    : 'Sales Return'}{' '}
                  #{editReturnTarget.returnNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Serial: {editReturnTarget.serialNumber} · {editReturnTarget.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditReturnTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditReturnSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRetNumber}
                    onChange={(e) => setEditRetNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={editRetAmount}
                    onChange={(e) => setEditRetAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editRetDateLocal}
                  onChange={(e) => setEditRetDateLocal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={editRetReason}
                  onChange={(e) => setEditRetReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditReturnTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] cursor-pointer"
                >
                  Continue to Password Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 5: EDIT SERIAL RECORD (NUMBER / BRANCH TRANSFER / PRICE)
         ========================================================= */}
      {editSerialTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Edit Serial Record
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editSerialTarget.productName} ({editSerialTarget.brand}{' '}
                  {editSerialTarget.modelName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditSerialTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSerialSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch (Transfer) *
                </label>
                <select
                  required
                  value={editSerialBranchId}
                  onChange={(e) => setEditSerialBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                >
                  {activeBranches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Cost (BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={editSerialCost}
                    onChange={(e) => setEditSerialCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sale Price (BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={editSerialPrice}
                    onChange={(e) => setEditSerialPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditSerialTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] cursor-pointer"
                >
                  Continue to Password Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
