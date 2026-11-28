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
  type ErpSerial,
  type ErpSerialHistoryEventType,
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
  requestPasswordConfirm: (action: ErpPendingAction) => void;
  onNavigateTab: (tab: AdminTab) => void;
}

type ErpSubTab = 'stock' | 'purchase' | 'sales' | 'serial-search' | 'setup';
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

export function ErpSystemWorkspace({
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
  } = useStore();

  const isSuperAdmin = adminRole === 'super_admin';
  const canSetupOrPurchase =
    isSuperAdmin ||
    Boolean(activeStaffAccount?.canAddProduct || activeStaffAccount?.canEditProduct);
  const canManageSales = isSuperAdmin || Boolean(activeStaffAccount?.canManageOrders);

  const [subTab, setSubTab] = useState<ErpSubTab>('stock');

  // ---------------------------------------------------------
  // 1. STOCK VIEW STATE
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

  // ---------------------------------------------------------
  // 3. SALES & MONTHLY PROFIT STATE
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
  const [reportMonth, setReportMonth] = useState<string>(getCurrentLocalMonth);
  const [reportAllMonths, setReportAllMonths] = useState<boolean>(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 4. ADVANCE SERIAL SEARCH STATE
  // ---------------------------------------------------------
  const [serialQuery, setSerialQuery] = useState<string>('');
  const [serialStatusFilter, setSerialStatusFilter] = useState<
    'all' | 'in_stock' | 'sold' | 'purchase_returned'
  >('all');
  const [selectedSerialId, setSelectedSerialId] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 5. SETUP STATE
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

  // Return reason modal state (for Purchase Return or Sales Return)
  const [returnTarget, setReturnTarget] = useState<{
    type: 'purchase_return' | 'sales_return';
    serial: ErpSerial;
  } | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');

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

  // Brand list for Stock filter
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of activeModels) set.add(m.brand);
    for (const s of erpSerials) set.add(s.brand);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeModels, erpSerials]);

  // Model filter options narrowed optionally by selected Brand
  const modelFilterOptions = useMemo(() => {
    return activeModels.filter(
      (m) => stockBrandFilter === 'all' || m.brand.toLowerCase() === stockBrandFilter.toLowerCase()
    );
  }, [activeModels, stockBrandFilter]);

  // Consolidated Stock Rows (grouped by modelId so repeated purchases count under exact same Product Name!)
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

    // Include active Setup models matching current filters even if 0 in stock (unless branch filter excludes or keyword doesn't match)
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

  // Monthly Salesperson & Profit Report
  const monthlyReport = useMemo(() => {
    const relevantSales = reportAllMonths
      ? erpSales
      : erpSales.filter((s) => s.saleMonth === reportMonth);

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
  }, [erpSales, activeManagers, reportMonth, reportAllMonths]);

  // Advance Serial Search results
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

  // ---------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------
  const jumpToSerialHistory = (serialId: string, serialNumber: string) => {
    setSerialQuery(serialNumber);
    setSerialStatusFilter('all');
    setSelectedSerialId(serialId);
    setSubTab('serial-search');
  };

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

  const subTabs: {
    id: ErpSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'purchase', label: 'Purchase & Return', icon: Truck },
    { id: 'sales', label: 'Sales & Profit', icon: TrendingUp },
    { id: 'serial-search', label: 'Serial Search', icon: Search },
    { id: 'setup', label: 'Setup', icon: Layers },
  ];

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

  return (
    <div className="space-y-6">
      {/* ERP Header & Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#081621] to-[#112A3E] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#EF4A23]" />
              AKIB Technologies ERP System
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Serialized inventory, vendor purchases, branch stock, manager sales attribution & monthly profit tracking.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
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

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#3749BB] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          SUB-TAB 1: LIVE ERP STOCK VIEW
         ========================================================= */}
      {subTab === 'stock' && (
        <div className="space-y-5">
          {/* KPI Summary Strip */}
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

          {/* Filters & View Mode Toolbar */}
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

          {/* Stock Table */}
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
                    ? 'Start in Setup to add your Branches, Vendors, Customers, and Product Models, then record a Purchase to add serialized stock.'
                    : 'Try clearing filters or record a new Vendor Purchase to add stock.'}
                </p>
                {activeModels.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setSubTab('setup')}
                    className="px-4 py-2 rounded-lg bg-[#EF4A23] text-white text-xs font-semibold hover:bg-[#D93E18] cursor-pointer"
                  >
                    Open ERP Setup
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
                        <th className="py-3 px-4">In-Stock Serials (Click for History)</th>
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
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(row.defaultSellPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#3749BB] tabular-nums whitespace-nowrap">
                              {formatCurrency(row.totalCostValue)}
                            </td>
                          </>
                        )}

                        {stockDisplayMode === 'with-serials' && (
                          <td className="py-3 px-4">
                            {row.serials.length === 0 ? (
                              <span className="text-xs text-slate-400">No serials in stock</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {row.serials.map((sn) => (
                                  <div
                                    key={sn.serialId}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        jumpToSerialHistory(sn.serialId, sn.serialNumber)
                                      }
                                      title="View complete lifetime history"
                                      className="font-mono font-semibold text-[#3749BB] hover:underline cursor-pointer"
                                    >
                                      {sn.serialNumber}
                                    </button>
                                    <span className="text-[10px] text-slate-500">
                                      ({sn.branchName})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReturnTarget({ type: 'purchase_return', serial: sn });
                                        setReturnReason('');
                                      }}
                                      title="Purchase Return to Vendor"
                                      className="ml-0.5 text-[10px] font-semibold text-red-600 hover:text-red-800 cursor-pointer"
                                    >
                                      [Return]
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )}

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center min-w-[44px] px-2.5 py-1 rounded-md font-mono text-xs font-bold tabular-nums ${
                              row.quantity === 0
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : row.quantity <= 3
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
          SUB-TAB 2: VENDOR PURCHASE & PURCHASE RETURN
         ========================================================= */}
      {subTab === 'purchase' && (
        <div className="space-y-6">
          {!canSetupOrPurchase ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-900">
              Manager permission <strong>Add / Edit Products & Stock</strong> is required to record vendor purchases.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                    New Vendor Purchase (Auto-Adds to Stock)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a Setup Vendor, target Branch, and Setup Model(s). Every serial number is immediately added to Stock and timestamped.
                  </p>
                </div>
                {(activeVendors.length === 0 ||
                  activeBranches.length === 0 ||
                  activeModels.length === 0) && (
                  <button
                    type="button"
                    onClick={() => setSubTab('setup')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer self-start"
                  >
                    Complete Setup First →
                  </button>
                )}
              </div>

              <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-5">
                {purError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {purError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor
                    </label>
                    <select
                      value={purVendorId}
                      onChange={(e) => setPurVendorId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">-- Select Vendor --</option>
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
                      Receiving Branch
                    </label>
                    <select
                      value={purBranchId}
                      onChange={(e) => setPurBranchId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">-- Select Branch --</option>
                      {activeBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.name} ({b.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor Invoice #
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={purInvoice}
                      onChange={(e) => setPurInvoice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                </div>

                {/* Purchase Line Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                      Models & Serial Numbers
                    </p>
                    <button
                      type="button"
                      onClick={handleAddPurchaseLine}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer"
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            Item #{index + 1} · {parsedCount} serial(s)
                          </span>
                          {purLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPurLines((prev) => prev.filter((l) => l.key !== line.key))
                              }
                              className="text-xs text-red-600 hover:underline cursor-pointer"
                            >
                              Remove Line
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-8">
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Product & Model (From Setup)
                            </label>
                            <select
                              value={line.modelId}
                              onChange={(e) => {
                                const mid = e.target.value;
                                const m = activeModels.find((x) => x.modelId === mid);
                                setPurLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
                                          modelId: mid,
                                          unitCost: m ? String(m.defaultBuyPrice) : l.unitCost,
                                        }
                                      : l
                                  )
                                );
                              }}
                              required
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                            >
                              <option value="">-- Choose Setup Model --</option>
                              {activeModels.map((m) => (
                                <option key={m.modelId} value={m.modelId}>
                                  {m.productName} [{m.brand} · {m.modelName}]
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-4">
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Unit Cost (BDT ৳)
                            </label>
                            <input
                              type="number"
                              required
                              min={0}
                              step="1"
                              value={line.unitCost}
                              onChange={(e) =>
                                setPurLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key ? { ...l, unitCost: e.target.value } : l
                                  )
                                )
                              }
                              placeholder="0"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <label className="text-[11px] font-medium text-slate-600">
                              Serial Numbers (one per line or comma-separated)
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
                                    [line.key]: Number(e.target.value),
                                  }))
                                }
                                aria-label="Bulk serial quantity"
                                className="w-14 px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleAutoGenerateSerials(line.key, line.modelId)}
                                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                + Auto-Generate Serials
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            required
                            value={line.serialsText}
                            onChange={(e) =>
                              setPurLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, serialsText: e.target.value } : l
                                )
                              )
                            }
                            placeholder="Scan or paste serial numbers, e.g.:&#10;SN-RTX4060-001&#10;SN-RTX4060-002"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Notes (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={purNotes}
                    onChange={(e) => setPurNotes(e.target.value)}
                    placeholder="Supplier challan reference, warranty terms..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="text-sm font-mono tabular-nums text-slate-700">
                    Total: <strong>{purchaseSummary.units} unit(s)</strong> ·{' '}
                    <strong className="text-[#3749BB]">
                      {formatCurrency(purchaseSummary.total)}
                    </strong>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[42px]"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Record Purchase & Add to Stock
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Purchase History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Purchase History ({erpPurchases.length})
              </h3>
            </div>
            {erpPurchases.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No vendor purchases recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {erpPurchases.map((pur) => (
                  <div key={pur.purchaseId} className="p-4 sm:p-5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            #{pur.invoiceNumber}
                          </span>
                          <span className="text-xs font-semibold text-[#3749BB]">
                            {pur.vendorName}
                          </span>
                          <span className="text-xs text-slate-500">→ {pur.branchName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                              pur.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : pur.status === 'partial_return'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {pur.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatDateTimeFull(pur.purchaseDateIso)} · By {pur.createdByName}
                        </p>
                      </div>
                      <div className="text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {pur.totalUnits} units · {formatCurrency(pur.totalAmount)}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {pur.items.map((item, idx) => (
                        <div
                          key={`${pur.purchaseId}_${idx}`}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-slate-800">
                              {item.productName}{' '}
                              <span className="font-normal text-slate-500">
                                ({item.brand} · {item.modelName})
                              </span>
                            </span>
                            <span className="font-mono text-slate-700">
                              {item.quantity} × {formatCurrency(item.unitCost)} ={' '}
                              <strong>{formatCurrency(item.lineTotal)}</strong>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.serialNumbers.map((snText) => {
                              const liveSerial = erpSerials.find(
                                (s) => s.serialNumber.toLowerCase() === snText.toLowerCase()
                              );
                              return (
                                <span
                                  key={snText}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px]"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      liveSerial &&
                                      jumpToSerialHistory(liveSerial.serialId, liveSerial.serialNumber)
                                    }
                                    className="text-[#3749BB] hover:underline cursor-pointer"
                                  >
                                    {snText}
                                  </button>
                                  {liveSerial?.status === 'in_stock' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReturnTarget({
                                          type: 'purchase_return',
                                          serial: liveSerial,
                                        });
                                        setReturnReason('');
                                      }}
                                      className="text-[10px] font-semibold text-red-600 hover:underline cursor-pointer ml-1"
                                    >
                                      Return
                                    </button>
                                  )}
                                  {liveSerial?.status === 'sold' && (
                                    <span className="text-[10px] text-emerald-700 font-sans">
                                      Sold
                                    </span>
                                  )}
                                  {liveSerial?.status === 'purchase_returned' && (
                                    <span className="text-[10px] text-red-700 font-sans">
                                      Returned
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: SALES ORDER, SALES RETURN & MONTHLY PROFIT REPORT
         ========================================================= */}
      {subTab === 'sales' && (
        <div className="space-y-6">
          {/* Monthly Salesperson & Profit Report */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                  Monthly Salesperson Revenue & Profit Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check how much each stored Manager sold and exact net profit generated (automatically adjusts for Sales Returns).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="month"
                  value={reportMonth}
                  disabled={reportAllMonths}
                  onChange={(e) => setReportMonth(e.target.value)}
                  aria-label="Filter report by month"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs disabled:opacity-50"
                />
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
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

            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Net Units Sold</p>
                <p className="font-mono text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {monthlyReport.totals.unitsSold}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Net Sales Revenue</p>
                <p className="font-mono text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatCurrency(monthlyReport.totals.netRevenue)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Cost of Goods</p>
                <p className="font-mono text-xl font-bold text-slate-700 mt-0.5 tabular-nums">
                  {formatCurrency(monthlyReport.totals.netCost)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Net Profit</p>
                <p
                  className={`font-mono text-xl font-bold mt-0.5 tabular-nums ${
                    monthlyReport.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatCurrency(monthlyReport.totals.netProfit)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Salesperson (Manager)</th>
                    <th className="py-3 px-4 text-center">Invoices</th>
                    <th className="py-3 px-4 text-center">Net Units</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">Cost</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {monthlyReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        No active manager accounts or sales found for this period.
                      </td>
                    </tr>
                  ) : (
                    monthlyReport.rows.map((r) => {
                      const margin =
                        r.netRevenue > 0 ? ((r.netProfit / r.netRevenue) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={r.salespersonId} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{r.salespersonName}</p>
                            <p className="font-mono text-[11px] text-slate-500">
                              @{r.salespersonUsername}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs tabular-nums">
                            {r.invoices}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs font-semibold tabular-nums">
                            {r.unitsSold}
                            {r.returnedUnits > 0 && (
                              <span className="text-[10px] text-amber-700 ml-1">
                                ({r.returnedUnits} ret)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(r.netRevenue)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {formatCurrency(r.netCost)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-xs font-bold tabular-nums whitespace-nowrap ${
                              r.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {formatCurrency(r.netProfit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {margin}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create New Sales Order */}
          {!canManageSales ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-900">
              Manager permission <strong>Manage Orders</strong> is required to create ERP sales orders.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                  Create ERP Sales Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sell serialized branch stock to a Setup Customer. Sales Person must be chosen from stored Managers.
                </p>
              </div>

              <form onSubmit={handleSaleSubmit} className="p-6 space-y-5">
                {activeManagers.length === 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-amber-950">
                      <strong>No Stored Managers Found:</strong> Add at least one Manager account first so you can select them as Sales Person on invoices.
                    </p>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('users')}
                        className="px-3.5 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Add Manager Account →
                      </button>
                    )}
                  </div>
                )}

                {saleError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {saleError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer
                    </label>
                    <select
                      value={saleCustomerId}
                      onChange={(e) => setSaleCustomerId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">-- Select Customer --</option>
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
                      Branch
                    </label>
                    <select
                      value={saleBranchId}
                      onChange={(e) => {
                        setSaleBranchId(e.target.value);
                        setSaleCart([]);
                      }}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">-- Select Branch --</option>
                      {activeBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#3749BB]" />
                      Sales Person (Stored Managers Only)
                    </label>
                    <select
                      value={saleSalespersonId}
                      onChange={(e) => setSaleSalespersonId(e.target.value)}
                      required
                      aria-label="Sales Person"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    >
                      <option value="">-- Choose Stored Manager --</option>
                      {activeManagers.map((m) => (
                        <option key={m.staffId} value={m.staffId}>
                          {m.displayName} (@{m.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sales Invoice #
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={saleInvoice}
                      onChange={(e) => setSaleInvoice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                </div>

                {/* Branch In-Stock Serial Picker */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Pick In-Stock Serials {saleBranchId ? 'from Selected Branch' : '(Select a Branch first)'}
                    </p>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={saleSerialSearch}
                        onChange={(e) => setSaleSerialSearch(e.target.value)}
                        placeholder="Search serial or model..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>

                  {!saleBranchId ? (
                    <p className="text-xs text-slate-500">
                      Choose a Branch above to view available in-stock serial numbers.
                    </p>
                  ) : availableSaleSerials.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No available in-stock serials match in this branch.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableSaleSerials.slice(0, 40).map((sn) => (
                        <button
                          key={sn.serialId}
                          type="button"
                          onClick={() =>
                            setSaleCart((prev) => [
                              ...prev,
                              { serial: sn, unitPrice: sn.salePrice || sn.purchaseCost },
                            ])
                          }
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-[#3749BB] text-left cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {sn.productName}
                            </p>
                            <p className="font-mono text-[11px] text-[#3749BB]">
                              {sn.serialNumber} · Cost {formatCurrency(sn.purchaseCost)}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold shrink-0">
                            <Plus className="w-3 h-3" />
                            Add
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Items in Invoice */}
                {saleCart.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Product & Serial</th>
                          <th className="py-2.5 px-3 text-right">Cost</th>
                          <th className="py-2.5 px-3 text-right">Sale Price (৳)</th>
                          <th className="py-2.5 px-3 text-right">Profit</th>
                          <th className="py-2.5 px-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {saleCart.map((line) => {
                          const profit = Number(line.unitPrice || 0) - line.serial.purchaseCost;
                          return (
                            <tr key={line.serial.serialId}>
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-900">
                                  {line.serial.productName}
                                </p>
                                <p className="font-mono text-slate-500">{line.serial.serialNumber}</p>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                {formatCurrency(line.serial.purchaseCost)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={line.unitPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setSaleCart((prev) =>
                                      prev.map((c) =>
                                        c.serial.serialId === line.serial.serialId
                                          ? { ...c, unitPrice: val }
                                          : c
                                      )
                                    );
                                  }}
                                  className="w-28 px-2 py-1 rounded border border-slate-200 font-mono text-right"
                                />
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                                  profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {formatCurrency(profit)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSaleCart((prev) =>
                                      prev.filter((c) => c.serial.serialId !== line.serial.serialId)
                                    )
                                  }
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  aria-label="Remove serial"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder="Payment terms, delivery reference..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="text-xs sm:text-sm font-mono tabular-nums space-x-3">
                    <span>
                      Revenue:{' '}
                      <strong>
                        {formatCurrency(saleCart.reduce((s, c) => s + Number(c.unitPrice || 0), 0))}
                      </strong>
                    </span>
                    <span className="text-emerald-700">
                      Net Profit:{' '}
                      <strong>
                        {formatCurrency(
                          saleCart.reduce(
                            (s, c) => s + (Number(c.unitPrice || 0) - c.serial.purchaseCost),
                            0
                          )
                        )}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[42px]"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Complete Sales Order
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sales Invoices & Sales Return Action */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Sales Invoices ({monthlyReport.relevantSales.length})
              </h3>
              <span className="text-xs text-slate-500">
                {reportAllMonths ? 'All Months' : reportMonth}
              </span>
            </div>

            {monthlyReport.relevantSales.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No sales invoices recorded in this period.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {monthlyReport.relevantSales.map((sale) => {
                  const netRev = sale.totalRevenue - sale.returnedRevenue;
                  const netProf = sale.totalProfit - sale.returnedProfit;
                  const expanded = expandedSaleId === sale.saleId;
                  return (
                    <div key={sale.saleId} className="p-4 sm:p-5 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              #{sale.invoiceNumber}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {sale.customerName}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#3749BB] text-[11px] font-semibold">
                              Salesperson: {sale.salespersonName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                sale.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : sale.status === 'partial_return'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {sale.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {formatDateTimeFull(sale.saleDateIso)} · {sale.branchName} ·{' '}
                            {sale.totalUnits} unit(s)
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono text-xs tabular-nums">
                            <p className="font-bold text-slate-900">{formatCurrency(netRev)}</p>
                            <p
                              className={
                                netProf >= 0
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-red-700 font-semibold'
                              }
                            >
                              Profit: {formatCurrency(netProf)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedSaleId(expanded ? null : sale.saleId)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {expanded ? 'Hide' : 'Items / Return'}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="pt-2 space-y-1.5">
                          {sale.items.map((item) => {
                            const liveSerial = erpSerials.find(
                              (s) => s.serialId === item.serialId
                            );
                            return (
                              <div
                                key={item.serialId}
                                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900">
                                    {item.productName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      jumpToSerialHistory(item.serialId, item.serialNumber)
                                    }
                                    className="ml-2 font-mono text-[#3749BB] hover:underline cursor-pointer"
                                  >
                                    {item.serialNumber}
                                  </button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-slate-600 tabular-nums">
                                    Sale {formatCurrency(item.unitPrice)} · Profit{' '}
                                    {formatCurrency(item.profit)}
                                  </span>
                                  {item.returned ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                      Returned
                                    </span>
                                  ) : (
                                    liveSerial?.status === 'sold' &&
                                    canManageSales && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnTarget({
                                            type: 'sales_return',
                                            serial: liveSerial,
                                          });
                                          setReturnReason('');
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Sales Return
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
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
          SUB-TAB 4: ADVANCE SERIAL SEARCH & LIFETIME HISTORY
         ========================================================= */}
      {subTab === 'serial-search' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                Advance Serial Number Search (Full Lifetime History)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Search any serial number to trace where it was purchased, sold, purchase-returned, or sales-returned with exact date and time.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={serialQuery}
                  onChange={(e) => {
                    setSerialQuery(e.target.value);
                    setSelectedSerialId(null);
                  }}
                  placeholder="Enter full or partial serial number, invoice #, customer, vendor, or model..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={serialStatusFilter}
                  onChange={(e) =>
                    setSerialStatusFilter(
                      e.target.value as 'all' | 'in_stock' | 'sold' | 'purchase_returned'
                    )
                  }
                  aria-label="Filter by serial status"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                >
                  <option value="all">All Statuses ({erpSerials.length})</option>
                  <option value="in_stock">In Stock</option>
                  <option value="sold">Sold</option>
                  <option value="purchase_returned">Purchase Returned</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Matching Serials List */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                Matching Serials ({matchingSerials.length})
              </div>
              {matchingSerials.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No serial records match your query.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                  {matchingSerials.map((sn) => {
                    const active = inspectedSerial?.serialId === sn.serialId;
                    return (
                      <button
                        key={sn.serialId}
                        type="button"
                        onClick={() => setSelectedSerialId(sn.serialId)}
                        className={`w-full p-3.5 text-left transition-colors cursor-pointer ${
                          active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#3749BB]">
                            {sn.serialNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              sn.status === 'in_stock'
                                ? 'bg-emerald-50 text-emerald-700'
                                : sn.status === 'sold'
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {sn.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-900 mt-1 truncate">
                          {sn.productName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {sn.branchName} · {sn.history?.length || 1} event(s)
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Serial Lifetime Timeline */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              {!inspectedSerial ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Select a serial number to view its lifetime audit trail.
                </div>
              ) : (
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold text-slate-900">
                          {inspectedSerial.serialNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
                            inspectedSerial.status === 'in_stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inspectedSerial.status === 'sold'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {inspectedSerial.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1">
                        {inspectedSerial.productName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {inspectedSerial.brand} · Model {inspectedSerial.modelName} · Branch:{' '}
                        <strong>{inspectedSerial.branchName}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {inspectedSerial.status === 'in_stock' && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnTarget({
                              type: 'purchase_return',
                              serial: inspectedSerial,
                            });
                            setReturnReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          Purchase Return
                        </button>
                      )}
                      {inspectedSerial.status === 'sold' && canManageSales && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnTarget({
                              type: 'sales_return',
                              serial: inspectedSerial,
                            });
                            setReturnReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Sales Return (Restock)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Provenance Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase text-slate-500 block">Purchased From</span>
                      <span className="font-semibold text-slate-900">{inspectedSerial.vendorName}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase text-slate-500 block">Buy Cost</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {formatCurrency(inspectedSerial.purchaseCost)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase text-slate-500 block">Last Customer</span>
                      <span className="font-semibold text-slate-900">
                        {inspectedSerial.lastCustomerName === 'none'
                          ? '—'
                          : inspectedSerial.lastCustomerName}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase text-slate-500 block">Salesperson</span>
                      <span className="font-semibold text-slate-900">
                        {inspectedSerial.salespersonName === 'none'
                          ? '—'
                          : inspectedSerial.salespersonName}
                      </span>
                    </div>
                  </div>

                  {/* Lifetime Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#3749BB]" />
                      Complete Lifetime History (By Date & Time)
                    </h4>

                    <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {[...(inspectedSerial.history || [])]
                        .sort((a, b) => a.timestampMs - b.timestampMs)
                        .map((ev, idx) => {
                          const style = HISTORY_BADGE[ev.type] || HISTORY_BADGE.PURCHASE;
                          return (
                            <div key={`${ev.refId}_${idx}`} className="relative">
                              <span
                                className={`absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${style.dotClass}`}
                              />
                              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${style.badgeClass}`}
                                  >
                                    {style.label}
                                  </span>
                                  <span className="font-mono text-[11px] font-medium text-slate-600">
                                    {formatDateTimeFull(ev.timestampIso)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-800 space-y-0.5">
                                  <p>
                                    <strong>Party:</strong> {ev.partyName} ·{' '}
                                    <strong>Branch:</strong> {ev.branchName} ·{' '}
                                    <strong>Ref #:</strong>{' '}
                                    <span className="font-mono">{ev.invoiceNumber}</span>
                                  </p>
                                  <p>
                                    <strong>Amount:</strong>{' '}
                                    <span className="font-mono">{formatCurrency(ev.amount)}</span>
                                    {ev.profit !== 0 && (
                                      <span
                                        className={`ml-2 font-mono font-semibold ${
                                          ev.profit > 0 ? 'text-emerald-700' : 'text-amber-800'
                                        }`}
                                      >
                                        (Profit Impact: {ev.profit > 0 ? '+' : ''}
                                        {formatCurrency(ev.profit)})
                                      </span>
                                    )}
                                    <span className="ml-2 text-slate-500">
                                      · By: {ev.salespersonName}
                                    </span>
                                  </p>
                                  {ev.notes && (
                                    <p className="text-[11px] text-slate-500 italic">{ev.notes}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {erpReturns.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Recent Returns Log ({erpReturns.length})
                </h4>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {erpReturns.slice(0, 15).map((ret) => (
                  <div
                    key={ret.returnId}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold mr-2 ${
                          ret.returnType === 'purchase_return'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {ret.returnType === 'purchase_return'
                          ? 'Purchase Return'
                          : 'Sales Return'}
                      </span>
                      <span className="font-mono font-semibold">{ret.returnNumber}</span> ·{' '}
                      <span className="font-semibold text-slate-900">{ret.productName}</span> (
                      <button
                        type="button"
                        onClick={() => jumpToSerialHistory(ret.serialId, ret.serialNumber)}
                        className="font-mono text-[#3749BB] hover:underline cursor-pointer"
                      >
                        {ret.serialNumber}
                      </button>
                      ) · {ret.partyName}
                    </div>
                    <div className="font-mono text-slate-600 tabular-nums">
                      {formatCurrency(ret.amount)} · {formatDateTimeFull(ret.returnDateIso)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          SUB-TAB 5: ERP SETUP (MODELS, VENDORS, CUSTOMERS, BRANCHES)
         ========================================================= */}
      {subTab === 'setup' && (
        <div className="space-y-5">
          {/* Setup Section Switcher */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                {
                  id: 'models',
                  label: `Product Name & Models (${erpModels.length})`,
                  icon: Tag,
                },
                {
                  id: 'vendors',
                  label: `Vendors (${erpVendors.length})`,
                  icon: Truck,
                },
                {
                  id: 'customers',
                  label: `Customers (${erpCustomers.length})`,
                  icon: Users,
                },
                {
                  id: 'branches',
                  label: `Branches (${erpBranches.length})`,
                  icon: Building2,
                },
              ] as const
            ).map((sec) => {
              const Icon = sec.icon;
              const active = setupSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSetupSection(sec.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* 5A. PRODUCT NAME & MODELS SETUP */}
          {setupSection === 'models' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {editingModelId ? 'Edit Product & Model' : 'Add Product Name & Model'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      All future purchases of this model automatically count together under this exact Product Name in Stock.
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
                      className="text-xs text-slate-500 underline cursor-pointer"
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

                <form onSubmit={handleModelSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={modelForm.brand}
                      onChange={(e) => setModelForm((p) => ({ ...p, brand: e.target.value }))}
                      placeholder="e.g. ASUS"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Model Code / Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={modelForm.modelName}
                      onChange={(e) => setModelForm((p) => ({ ...p, modelName: e.target.value }))}
                      placeholder="e.g. ROG-G16-4060"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={modelForm.category}
                      onChange={(e) => setModelForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      {ERP_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consolidated Stock Product Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={modelForm.productName}
                      onChange={(e) => setModelForm((p) => ({ ...p, productName: e.target.value }))}
                      placeholder="e.g. ASUS ROG Strix G16 Core i7 RTX 4060 Gaming Laptop"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Purchase Cost (৳)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={modelForm.defaultBuyPrice}
                      onChange={(e) =>
                        setModelForm((p) => ({ ...p, defaultBuyPrice: e.target.value }))
                      }
                      placeholder="145000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Sale Price (৳)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={modelForm.defaultSellPrice}
                      onChange={(e) =>
                        setModelForm((p) => ({ ...p, defaultSellPrice: e.target.value }))
                      }
                      placeholder="165000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Warranty
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={modelForm.warranty}
                      onChange={(e) => setModelForm((p) => ({ ...p, warranty: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingModelId ? 'Save Model Changes' : 'Add Product Model'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">Brand / Model</th>
                        <th className="py-3 px-4 text-right">Default Cost</th>
                        <th className="py-3 px-4 text-right">Default Sell</th>
                        <th className="py-3 px-4 text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {erpModels.map((m) => (
                        <tr key={m.modelId} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{m.productName}</p>
                            <p className="text-[11px] text-slate-500">
                              {m.category} · {m.warranty}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="font-semibold">{m.brand}</span> ·{' '}
                            <span className="font-mono">{m.modelName}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">
                            {formatCurrency(m.defaultBuyPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-semibold">
                            {formatCurrency(m.defaultSellPrice)}
                          </td>
                          <td className="py-3 px-4 text-right">
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {erpModels.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                            No product models added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5B. VENDORS SETUP */}
          {setupSection === 'vendors' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {editingVendorId ? 'Edit Vendor Details' : 'Add Vendor / Supplier'}
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
                      className="text-xs text-slate-500 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                {vendorFormError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {vendorFormError}
                  </div>
                )}
                <form onSubmit={handleVendorSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Global Brand Distributors"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Contact Person
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={vendorForm.company}
                      onChange={(e) => setVendorForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder="e.g. Mr. Hasan"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      maxLength={160}
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={vendorForm.address}
                      onChange={(e) => setVendorForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Elephant Road / Multiplan Center, Dhaka"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingVendorId ? 'Save Vendor' : 'Add Vendor'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpVendors.map((v) => (
                  <div
                    key={v.vendorId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {v.name}{' '}
                        {v.company && (
                          <span className="text-xs font-normal text-slate-500">({v.company})</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[v.phone, v.email, v.address].filter(Boolean).join(' · ') || 'No contact details'}
                      </p>
                    </div>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 self-start cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                ))}
                {erpVendors.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">No vendors added yet.</div>
                )}
              </div>
            </div>
          )}

          {/* 5C. ERP CUSTOMERS SETUP */}
          {setupSection === 'customers' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {editingCustomerId ? 'Edit ERP Customer' : 'Add ERP Customer'}
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
                      className="text-xs text-slate-500 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                {customerFormError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {customerFormError}
                  </div>
                )}
                <form
                  onSubmit={handleCustomerSave}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Tariqul Islam"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={customerForm.company}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, company: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="018XXXXXXXX"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      maxLength={160}
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, city: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm((p) => ({ ...p, address: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingCustomerId ? 'Save Customer' : 'Add Customer'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpCustomers.map((c) => (
                  <div
                    key={c.customerId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {c.name}{' '}
                        {c.company && (
                          <span className="text-xs font-normal text-slate-500">({c.company})</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[c.phone, c.city, c.address].filter(Boolean).join(' · ') || 'No contact details'}
                      </p>
                    </div>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 self-start cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
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

          {/* 5D. BRANCHES SETUP */}
          {setupSection === 'branches' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {editingBranchId ? 'Edit Branch / Showroom' : 'Add Branch / Warehouse'}
                  </h3>
                  {editingBranchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranchId(null);
                        setBranchForm({ name: '', location: '', phone: '' });
                      }}
                      className="text-xs text-slate-500 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                {branchFormError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {branchFormError}
                  </div>
                )}
                <form onSubmit={handleBranchSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={branchForm.name}
                      onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Dhaka Multiplan Branch"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={branchForm.location}
                      onChange={(e) => setBranchForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="e.g. Elephant Road, Dhaka"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer"
                    >
                      {editingBranchId ? 'Save Branch' : 'Add Branch'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {erpBranches.map((b) => (
                  <div
                    key={b.branchId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">
                        {b.location}
                        {b.phone ? ` · ${b.phone}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranchId(b.branchId);
                        setBranchForm({ name: b.name, location: b.location, phone: b.phone });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 self-start cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                ))}
                {erpBranches.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No branches added yet. Add your primary showroom/warehouse branch above.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          RETURN REASON MODAL (PURCHASE RETURN / SALES RETURN)
         ========================================================= */}
      {returnTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    returnTarget.type === 'purchase_return' ? 'text-red-600' : 'text-amber-600'
                  }`}
                />
                {returnTarget.type === 'purchase_return'
                  ? 'Purchase Return to Vendor'
                  : 'Sales Return from Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="font-semibold text-slate-900">{returnTarget.serial.productName}</p>
                <p className="font-mono text-[#3749BB]">
                  Serial: {returnTarget.serial.serialNumber}
                </p>
                <p className="text-slate-600">
                  {returnTarget.type === 'purchase_return'
                    ? `Vendor: ${returnTarget.serial.vendorName} · Purchase Cost: ${formatCurrency(returnTarget.serial.purchaseCost)}`
                    : `Customer: ${returnTarget.serial.lastCustomerName} · Branch Restock: ${returnTarget.serial.branchName}`}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Reason / Remarks
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder={
                    returnTarget.type === 'purchase_return'
                      ? 'e.g. Dead on arrival / warranty exchange with vendor'
                      : 'e.g. Customer exchanged or returned item'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
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
                  Continue & Verify Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
