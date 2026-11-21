import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Link as LinkIcon,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency, isValidImageUrl, type ProductInput } from '../lib/validation';
import {
  PRODUCT_CATEGORIES,
  type AdminTab,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
  type ProductSpec,
} from '../types';
import { ProductImage } from './ProductImage';

interface AdminConsoleProps {
  onBackToStore: () => void;
}

const EMPTY_PRODUCT_FORM: ProductInput = {
  title: '',
  brand: '',
  category: 'Laptops',
  sku: '',
  price: 0,
  compareAtPrice: 0,
  stock: 10,
  imageUrl: '',
  summary: '',
  specs: [{ label: 'Warranty', value: '2 Years Official Warranty' }],
  featured: true,
  status: 'active',
};

export function AdminConsole({ onBackToStore }: AdminConsoleProps) {
  const {
    isAdmin,
    products,
    hasFirestoreProducts,
    orders,
    customers,
    seedStarterCatalog,
    saveProduct,
    adjustProductStock,
    deleteProduct,
    updateOrderStatus,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearch, setOrderSearch] = useState('');

  // Product Form Modal / Drawer State
  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProductInput>(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Order Inspection State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderNoteDraft, setOrderNoteDraft] = useState('');

  // Analytics Calculations
  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrdersCount = orders.length;
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

    // Customer aggregation across orders + users
    const customerMap = new Map<
      string,
      {
        uid: string;
        name: string;
        email: string;
        city: string;
        phone: string;
        orderCount: number;
        totalSpent: number;
        lastOrderMs: number;
      }
    >();

    for (const c of customers) {
      customerMap.set(c.uid, {
        uid: c.uid,
        name: c.displayName || 'Customer',
        email: c.email || '',
        city: c.city || '—',
        phone: c.phone || '—',
        orderCount: 0,
        totalSpent: 0,
        lastOrderMs: c.updatedAt?.toMillis?.() ?? 0,
      });
    }

    for (const o of orders) {
      const existing = customerMap.get(o.userId);
      const orderMs = o.createdAt?.toMillis?.() ?? Date.now();
      const spend = o.status !== 'cancelled' ? o.totalAmount : 0;
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += spend;
        existing.lastOrderMs = Math.max(existing.lastOrderMs, orderMs);
        if (existing.city === '—' && o.city) existing.city = o.city;
        if (existing.phone === '—' && o.customerPhone) existing.phone = o.customerPhone;
      } else {
        customerMap.set(o.userId, {
          uid: o.userId,
          name: o.customerName,
          email: o.customerEmail,
          city: o.city || '—',
          phone: o.customerPhone || '—',
          orderCount: 1,
          totalSpent: spend,
          lastOrderMs: orderMs,
        });
      }
    }

    // Category Revenue Breakdown
    const categoryStats = new Map<string, { revenue: number; units: number }>();
    for (const cat of PRODUCT_CATEGORIES) {
      categoryStats.set(cat, { revenue: 0, units: 0 });
    }
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const o of validOrders) {
      for (const item of o.items) {
        const prod = productById.get(item.productId);
        const cat = prod?.category || 'Peripherals';
        const cur = categoryStats.get(cat) || { revenue: 0, units: 0 };
        cur.revenue += item.price * item.quantity;
        cur.units += item.quantity;
        categoryStats.set(cat, cur);
      }
    }
    const categoryList = Array.from(categoryStats.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
    const maxCatRevenue = Math.max(1, ...categoryList.map((c) => c.revenue));

    const liveProducts = hasFirestoreProducts ? products : [];
    const lowStockProducts = liveProducts.filter((p) => p.stock > 0 && p.stock <= 5);
    const outOfStockProducts = liveProducts.filter((p) => p.stock === 0);
    const totalInventoryUnits = liveProducts.reduce((sum, p) => sum + p.stock, 0);

    const topProducts = [...liveProducts]
      .sort((a, b) => b.soldCount - a.soldCount || b.stock - a.stock)
      .slice(0, 5);

    const customerList = Array.from(customerMap.values()).sort(
      (a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount
    );

    const pendingCount = orders.filter((o) => o.status === 'pending').length;

    return {
      totalRevenue,
      totalOrdersCount,
      avgOrderValue,
      activeCustomersCount: customerMap.size,
      categoryList,
      maxCatRevenue,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryUnits,
      topProducts,
      customerList,
      pendingCount,
    };
  }, [orders, customers, products, hasFirestoreProducts]);

  const filteredProducts = useMemo(() => {
    const list = hasFirestoreProducts ? products : [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, hasFirestoreProducts, productSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderFilter !== 'all' && o.status !== orderFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
      );
    });
  }, [orders, orderFilter, orderSearch]);

  if (!isAdmin) {
    return (
      <section className="max-w-[720px] mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-10 space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-600">
            This console is restricted to verified AKIB Technologies administrators.
          </p>
          <button
            type="button"
            onClick={onBackToStore}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer min-h-[44px]"
          >
            Return to Storefront
          </button>
        </div>
      </section>
    );
  }

  const openCreateProduct = () => {
    setEditingProductId(null);
    setFormState({
      ...EMPTY_PRODUCT_FORM,
      sku: `AKB-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setFormState({
      title: product.title,
      brand: product.brand,
      category: product.category,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      imageUrl: product.imageUrl,
      summary: product.summary,
      specs: product.specs.length > 0 ? product.specs : [{ label: 'Warranty', value: '2 Years' }],
      featured: product.featured,
      status: product.status,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSpecChange = (idx: number, key: keyof ProductSpec, value: string) => {
    setFormState((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    }));
  };

  const handleAddSpecRow = () => {
    if (formState.specs.length >= 16) return;
    setFormState((prev) => ({
      ...prev,
      specs: [...prev.specs, { label: '', value: '' }],
    }));
  };

  const handleRemoveSpecRow = (idx: number) => {
    setFormState((prev) => ({
      ...prev,
      specs: prev.specs.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingProduct(true);
    try {
      const cleanedSpecs = formState.specs.filter(
        (s) => s.label.trim().length > 0 && s.value.trim().length > 0
      );
      await saveProduct(
        { ...formState, specs: cleanedSpecs },
        editingProductId || undefined
      );
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const navTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Storefront
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            AKIB Operations Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void seedStarterCatalog()}
            className="px-4 py-2.5 rounded border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
          >
            {hasFirestoreProducts ? 'Sync BDT Starter Catalog' : 'Seed BDT Starter Catalog'}
          </button>
          <button
            type="button"
            onClick={openCreateProduct}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            Post New Product
          </button>
        </div>
      </div>

      {/* Responsive Workspace Shell: 240px Sidebar on lg+, Tab bar on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3">
          <nav
            aria-label="Admin sections"
            className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0"
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[44px] ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 lg:border-transparent lg:bg-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </span>
                  {tab.id === 'orders' && analytics.pendingCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        active ? 'text-blue-300' : 'text-blue-700'
                      }`}
                    >
                      {analytics.pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Viewport */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* 4 KPI Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Gross Revenue</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatCurrency(analytics.totalRevenue)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Excludes cancelled orders</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Total Orders</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {analytics.totalOrdersCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {analytics.pendingCount} pending review
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Average Order Value</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatCurrency(analytics.avgOrderValue)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Across active checkouts</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Active Customers</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {analytics.activeCustomersCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {analytics.totalInventoryUnits} units in stock
                  </p>
                </div>
              </div>

              {/* Low Stock Alert Strip */}
              {(analytics.lowStockProducts.length > 0 ||
                analytics.outOfStockProducts.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-amber-900">
                      <span className="font-semibold">Inventory Alert: </span>
                      <span className="tabular-nums">
                        {analytics.outOfStockProducts.length} out of stock,{' '}
                        {analytics.lowStockProducts.length} low stock (5 or fewer units).
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="text-xs font-semibold text-amber-900 underline cursor-pointer self-start sm:self-center"
                  >
                    Restock in Products
                  </button>
                </div>
              )}

              {/* Category Revenue Breakdown & Top Products */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
                    Revenue by Category
                  </h2>
                  <div className="space-y-3.5">
                    {analytics.categoryList.map((row) => {
                      const pct = Math.round((row.revenue / analytics.maxCatRevenue) * 100);
                      return (
                        <div key={row.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">{row.category}</span>
                            <span className="font-mono text-slate-900 tabular-nums">
                              {formatCurrency(row.revenue)} · {row.units} sold
                            </span>
                          </div>
                          <div className="h-2 rounded-sm bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-blue-700 transition-all duration-300"
                              style={{ width: `${row.revenue > 0 ? Math.max(4, pct) : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
                    Top Hardware Inventory
                  </h2>
                  {analytics.topProducts.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">
                      No published products yet. Click "Post New Product" to add items.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {analytics.topProducts.map((item) => (
                        <div
                          key={item.id}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-9 rounded overflow-hidden border border-slate-200 shrink-0">
                              <ProductImage src={item.imageUrl} alt={item.title} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500 font-mono tabular-nums">
                                {item.stock} in stock · {item.soldCount} sold
                              </p>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT LISTINGS */}
          {activeTab === 'products' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Product Listings & Live Inventory
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Post items with external image links and adjust stock levels in real time.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Filter by title or SKU..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <p className="font-display font-semibold text-slate-900">
                    No products in Firestore catalog
                  </p>
                  <p className="text-sm text-slate-500">
                    Post your first product using an image URL or publish the starter hardware catalog.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={openCreateProduct}
                      className="px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 cursor-pointer min-h-[44px]"
                    >
                      Post New Product
                    </button>
                    {!hasFirestoreProducts && (
                      <button
                        type="button"
                        onClick={() => void seedStarterCatalog()}
                        className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer min-h-[44px]"
                      >
                        Seed Starter Catalog
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Price</th>
                        <th className="py-3 px-4 text-center">Live Stock</th>
                        <th className="py-3 px-4 text-right">Sold</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <div className="w-12 h-9 rounded overflow-hidden border border-slate-200 shrink-0">
                                <ProductImage src={p.imageUrl} alt={p.title} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate max-w-[220px]">
                                  {p.title}
                                </p>
                                <p className="text-xs font-mono text-slate-500">
                                  {p.sku} · {p.brand}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {p.category}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(p.price)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={p.stock <= 0}
                                onClick={() => void adjustProductStock(p.id, p.stock - 1)}
                                aria-label="Decrease stock"
                                className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className={`w-10 text-center font-mono text-xs font-semibold tabular-nums ${
                                  p.stock === 0
                                    ? 'text-red-700'
                                    : p.stock <= 5
                                      ? 'text-amber-700'
                                      : 'text-slate-900'
                                }`}
                              >
                                {p.stock}
                              </span>
                              <button
                                type="button"
                                onClick={() => void adjustProductStock(p.id, p.stock + 1)}
                                aria-label="Increase stock"
                                className="p-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                            {p.soldCount}
                          </td>
                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            <span
                              className={`font-medium ${
                                p.status === 'active' ? 'text-emerald-700' : 'text-slate-500'
                              }`}
                            >
                              {p.status === 'active' ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                aria-label={`Edit ${p.title}`}
                                className="p-2 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {confirmDeleteId === p.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void deleteProduct(p.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-red-600 text-white text-xs font-medium cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 rounded border border-slate-200 text-xs text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(p.id)}
                                  aria-label={`Delete ${p.title}`}
                                  className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setOrderFilter(st)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize cursor-pointer ${
                            orderFilter === st
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Order # or customer..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    No matching orders found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Order #</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Items</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                              #{order.orderNumber}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{order.customerName}</p>
                              <p className="text-xs text-slate-500">{order.customerEmail}</p>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                              {order.items.reduce((acc, i) => acc + i.quantity, 0)} items · {order.city}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={order.status}
                                onChange={(e) =>
                                  void updateOrderStatus(order.id, e.target.value as OrderStatus)
                                }
                                aria-label={`Update status for order ${order.orderNumber}`}
                                className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                              >
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setOrderNoteDraft(order.notes || '');
                                }}
                                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Order Inspection Panel */}
              {selectedOrder && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        Order #{selectedOrder.orderNumber} Details
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedOrder.customerName} · {selectedOrder.customerPhone} ·{' '}
                        {selectedOrder.shippingAddress}, {selectedOrder.city}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.productId}
                        className="py-2.5 flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{item.title}</span>
                          <span className="text-xs text-slate-500 font-mono ml-2">
                            ({item.sku}) × {item.quantity}
                          </span>
                        </div>
                        <span className="font-mono font-medium tabular-nums">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Fulfillment / Courier Note
                      </label>
                      <input
                        type="text"
                        maxLength={500}
                        value={orderNoteDraft}
                        onChange={(e) => setOrderNoteDraft(e.target.value)}
                        placeholder="Add tracking ID or dispatch remarks..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateOrderStatus(
                          selectedOrder.id,
                          selectedOrder.status,
                          orderNoteDraft
                        );
                        setSelectedOrder(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer min-h-[40px]"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CUSTOMER ANALYTICS & DIRECTORY */}
          {activeTab === 'customers' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Customer Spend & Activity Directory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregated real-time insights across registered profiles and verified orders.
                </p>
              </div>
              {analytics.customerList.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No customer activity recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Location & Phone</th>
                        <th className="py-3 px-4 text-right">Orders</th>
                        <th className="py-3 px-4 text-right">Lifetime Spend</th>
                        <th className="py-3 px-4 text-right">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {analytics.customerList.map((cust) => (
                        <tr key={cust.uid} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">{cust.name}</p>
                            <p className="text-xs text-slate-500">{cust.email}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {cust.city} · {cust.phone}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {cust.orderCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(cust.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                            {cust.lastOrderMs > 0
                              ? new Date(cust.lastOrderMs).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Registered'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Create / Edit Modal (With Image URL Link Input & Live Preview) */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={editingProductId ? 'Edit Product' : 'Post New Product'}
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full my-auto max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {editingProductId ? 'Edit Hardware Listing' : 'Post New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveProductSubmit}
              className="p-6 overflow-y-auto space-y-5"
            >
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {/* Image URL Link Input + Live Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <ProductImage
                    src={formState.imageUrl}
                    alt={formState.title || 'Product preview'}
                  />
                </div>
                <div className="sm:col-span-8 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-700" />
                    Product Image Link (URL)
                  </label>
                  <input
                    type="url"
                    required
                    maxLength={1000}
                    value={formState.imageUrl}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    placeholder="https://example.com/images/rtx-4080.jpg"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Supports any HTTPS/HTTP image link.</span>
                    {formState.imageUrl && isValidImageUrl(formState.imageUrl) && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valid URL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={formState.title}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. ASUS ROG Strix RTX 4090 OC Edition 24GB"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={formState.brand}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, brand: e.target.value }))
                    }
                    placeholder="e.g. ASUS, AMD, Dell"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        category: e.target.value as ProductCategory,
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={48}
                    value={formState.sku}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="AKB-GPU-4090"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000}
                    value={formState.stock}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        stock: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Special / Cash Price (BDT ৳)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="1"
                    value={formState.price || ''}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        price: Number(e.target.value),
                      }))
                    }
                    placeholder="85000"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Regular Price (BDT ৳, Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={formState.compareAtPrice || ''}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        compareAtPrice: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="94000"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Summary & Highlights
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={800}
                  value={formState.summary}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  placeholder="Describe key hardware capabilities, cooling architecture, and warranty coverage..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              {/* Dynamic Technical Specs Builder */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Technical Specifications ({formState.specs.length}/16)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSpecRow}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    + Add Spec Row
                  </button>
                </div>
                <div className="space-y-2">
                  {formState.specs.map((spec, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={60}
                        value={spec.label}
                        onChange={(e) => handleSpecChange(idx, 'label', e.target.value)}
                        placeholder="Label (e.g. VRAM)"
                        className="w-1/3 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={spec.value}
                        onChange={(e) => handleSpecChange(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. 24GB GDDR6X)"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecRow(idx)}
                        aria-label="Remove spec row"
                        className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visibility & Featured Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.featured}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, featured: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                  />
                  <span>Feature at top of storefront</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: e.target.value as 'active' | 'draft',
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                  >
                    <option value="active">Active (Live in Store)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {savingProduct
                    ? 'Publishing...'
                    : editingProductId
                      ? 'Save Changes'
                      : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
