import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Minus,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  PlusCircle,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  formatCurrency,
  isValidImageUrl,
  validateProductInput,
  type ProductInput,
} from '../lib/validation';
import {
  PRODUCT_CATEGORIES,
  type AdminTab,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
  type ProductSpec,
  type StaffAccount,
  type StaffPermissions,
} from '../types';
import { ProductImage } from './ProductImage';

interface AdminConsoleProps {
  onBackToStore: () => void;
}

interface PendingAdminAction {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  execute: (adminPassword: string) => Promise<void>;
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

function createFreshPostForm(): ProductInput {
  return {
    ...EMPTY_PRODUCT_FORM,
    sku: `AKB-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  };
}

const STAFF_PERMISSION_OPTIONS: {
  key: keyof StaffPermissions;
  label: string;
  hint: string;
}[] = [
  {
    key: 'canAddProduct',
    label: 'Add / Post Products',
    hint: 'Create new listings with image links and specs',
  },
  {
    key: 'canEditProduct',
    label: 'Edit Products & Stock',
    hint: 'Modify prices, details, and adjust stock counts',
  },
  {
    key: 'canDeleteProduct',
    label: 'Delete Products',
    hint: 'Remove product listings from the catalog',
  },
  {
    key: 'canManageOrders',
    label: 'Manage Orders',
    hint: 'View orders, update status, and save courier notes',
  },
  {
    key: 'canViewAnalytics',
    label: 'View Analytics',
    hint: 'Access gross revenue and sales breakdown',
  },
];

const DEFAULT_NEW_STAFF_PERMS: StaffPermissions = {
  canAddProduct: true,
  canEditProduct: true,
  canDeleteProduct: false,
  canManageOrders: false,
  canViewAnalytics: false,
};

export function AdminConsole({ onBackToStore }: AdminConsoleProps) {
  const {
    isAdmin,
    adminUnlocked,
    adminRole,
    activeStaffAccount,
    staffAccounts,
    products,
    hasFirestoreProducts,
    orders,
    customers,
    userAccessList,
    adminCredentialUsername,
    signInWithGoogle,
    seedStarterCatalog,
    saveProduct,
    adjustProductStock,
    deleteProduct,
    updateOrderStatus,
    updateUserPostPermission,
    createStaffAccount,
    updateStaffPermissions,
    updateStaffPassword,
    setStaffStatus,
    lockAdminPortal,
    updateAdminCredentials,
  } = useStore();

  const isSuperAdmin = adminRole === 'super_admin';
  const perms: StaffPermissions = useMemo(
    () =>
      isSuperAdmin
        ? {
            canAddProduct: true,
            canEditProduct: true,
            canDeleteProduct: true,
            canManageOrders: true,
            canViewAnalytics: true,
          }
        : {
            canAddProduct: Boolean(activeStaffAccount?.canAddProduct),
            canEditProduct: Boolean(activeStaffAccount?.canEditProduct),
            canDeleteProduct: Boolean(activeStaffAccount?.canDeleteProduct),
            canManageOrders: Boolean(activeStaffAccount?.canManageOrders),
            canViewAnalytics: Boolean(activeStaffAccount?.canViewAnalytics),
          },
    [isSuperAdmin, activeStaffAccount]
  );

  const [activeTab, setActiveTab] = useState<AdminTab>('post');
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Inline Quick Post Form State ('post' tab)
  const [postForm, setPostForm] = useState<ProductInput>(createFreshPostForm);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);

  // Add New Manager Form State ('users' tab, Super Admin only)
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showNewStaffPw, setShowNewStaffPw] = useState(false);
  const [newStaffPerms, setNewStaffPerms] = useState<StaffPermissions>(DEFAULT_NEW_STAFF_PERMS);
  const [newStaffError, setNewStaffError] = useState<string | null>(null);
  const [staffPermDrafts, setStaffPermDrafts] = useState<Record<string, StaffPermissions>>({});
  const [resetPwStaff, setResetPwStaff] = useState<StaffAccount | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [showResetPwValue, setShowResetPwValue] = useState(false);
  const [resetPwError, setResetPwError] = useState<string | null>(null);

  // Admin Login & Password Update State ('security' tab)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(adminCredentialUsername || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState<string | null>(null);

  // Product Edit Modal State ('products' & 'post' tabs)
  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProductInput>(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // Order Inspection State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderNoteDraft, setOrderNoteDraft] = useState('');

  // Global Admin/Manager Password Confirmation Modal State (required for EVERY Admin Panel change)
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [confirmActionPassword, setConfirmActionPassword] = useState('');
  const [showActionPassword, setShowActionPassword] = useState(false);
  const [confirmActionError, setConfirmActionError] = useState<string | null>(null);
  const [confirmActionBusy, setConfirmActionBusy] = useState(false);

  const requestPasswordConfirm = (action: PendingAdminAction) => {
    setConfirmActionPassword('');
    setShowActionPassword(false);
    setConfirmActionError(null);
    setConfirmActionBusy(false);
    setPendingAction(action);
  };

  const handleConfirmActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    setConfirmActionError(null);
    setConfirmActionBusy(true);
    try {
      await pendingAction.execute(confirmActionPassword);
      setPendingAction(null);
      setConfirmActionPassword('');
    } catch (err) {
      setConfirmActionError(
        err instanceof Error ? err.message : 'Admin password verification failed.'
      );
    } finally {
      setConfirmActionBusy(false);
    }
  };

  // Analytics & Unified Tracked Users Calculations
  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrdersCount = orders.length;
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

    const userMap = new Map<
      string,
      {
        uid: string;
        name: string;
        email: string;
        photoURL: string;
        city: string;
        phone: string;
        loginCount: number;
        lastLoginMs: number;
        canAddPost: boolean;
        canEditPost: boolean;
        orderCount: number;
        totalSpent: number;
        lastActivityMs: number;
      }
    >();

    for (const access of userAccessList) {
      const loginMs = access.lastLoginAt?.toMillis?.() ?? 0;
      userMap.set(access.uid, {
        uid: access.uid,
        name: access.displayName || 'Customer',
        email: access.email || '',
        photoURL: access.photoURL || '',
        city: '—',
        phone: '—',
        loginCount: access.loginCount || 1,
        lastLoginMs: loginMs,
        canAddPost: Boolean(access.canAddPost),
        canEditPost: Boolean(access.canEditPost),
        orderCount: 0,
        totalSpent: 0,
        lastActivityMs: loginMs,
      });
    }

    for (const c of customers) {
      const existing = userMap.get(c.uid);
      const updatedMs = c.updatedAt?.toMillis?.() ?? 0;
      if (existing) {
        if (c.displayName) existing.name = c.displayName;
        if (c.photoURL && !existing.photoURL) existing.photoURL = c.photoURL;
        if (c.city) existing.city = c.city;
        if (c.phone) existing.phone = c.phone;
        existing.lastActivityMs = Math.max(existing.lastActivityMs, updatedMs);
      } else {
        userMap.set(c.uid, {
          uid: c.uid,
          name: c.displayName || 'Customer',
          email: c.email || '',
          photoURL: c.photoURL || '',
          city: c.city || '—',
          phone: c.phone || '—',
          loginCount: 1,
          lastLoginMs: updatedMs,
          canAddPost: false,
          canEditPost: false,
          orderCount: 0,
          totalSpent: 0,
          lastActivityMs: updatedMs,
        });
      }
    }

    for (const o of orders) {
      const existing = userMap.get(o.userId);
      const orderMs = o.createdAt?.toMillis?.() ?? Date.now();
      const spend = o.status !== 'cancelled' ? o.totalAmount : 0;
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += spend;
        existing.lastActivityMs = Math.max(existing.lastActivityMs, orderMs);
        if (existing.city === '—' && o.city) existing.city = o.city;
        if (existing.phone === '—' && o.customerPhone) existing.phone = o.customerPhone;
      } else {
        userMap.set(o.userId, {
          uid: o.userId,
          name: o.customerName,
          email: o.customerEmail,
          photoURL: '',
          city: o.city || '—',
          phone: o.customerPhone || '—',
          loginCount: 1,
          lastLoginMs: orderMs,
          canAddPost: false,
          canEditPost: false,
          orderCount: 1,
          totalSpent: spend,
          lastActivityMs: orderMs,
        });
      }
    }

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

    const trackedUsers = Array.from(userMap.values()).sort(
      (a, b) => b.lastActivityMs - a.lastActivityMs || b.loginCount - a.loginCount
    );
    const totalLogins = trackedUsers.reduce((sum, u) => sum + u.loginCount, 0);
    const permittedEditorsCount = trackedUsers.filter(
      (u) => u.canAddPost || u.canEditPost
    ).length;

    const pendingCount = orders.filter((o) => o.status === 'pending').length;

    return {
      totalRevenue,
      totalOrdersCount,
      avgOrderValue,
      activeCustomersCount: userMap.size,
      categoryList,
      maxCatRevenue,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryUnits,
      topProducts,
      trackedUsers,
      totalLogins,
      permittedEditorsCount,
      pendingCount,
    };
  }, [orders, customers, userAccessList, products, hasFirestoreProducts]);

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

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return analytics.trackedUsers;
    return analytics.trackedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q)
    );
  }, [analytics.trackedUsers, userSearch]);

  if (!adminUnlocked) {
    return (
      <section className="max-w-[720px] mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-10 space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Admin Panel Locked
          </h1>
          <p className="text-sm text-slate-600">
            Enter your admin username and password at /admin to manage AKIB Technologies.
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

  const handlePostSpecChange = (idx: number, key: keyof ProductSpec, value: string) => {
    setPostForm((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    }));
  };

  const handleAddPostSpecRow = () => {
    if (postForm.specs.length >= 16) return;
    setPostForm((prev) => ({
      ...prev,
      specs: [...prev.specs, { label: '', value: '' }],
    }));
  };

  const handleRemovePostSpecRow = (idx: number) => {
    setPostForm((prev) => ({
      ...prev,
      specs: prev.specs.filter((_, i) => i !== idx),
    }));
  };

  const handleInlinePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPostError(null);
    setPostSuccess(null);

    const cleanedSpecs = postForm.specs.filter(
      (s) => s.label.trim().length > 0 && s.value.trim().length > 0
    );
    const payload: ProductInput = { ...postForm, specs: cleanedSpecs };
    const validationErr = validateProductInput(payload);
    if (validationErr) {
      setPostError(validationErr);
      return;
    }

    requestPasswordConfirm({
      title: 'Confirm New Product Post',
      description: `Enter your admin password to publish "${payload.title.trim()}" at ${formatCurrency(payload.price)}.`,
      confirmLabel: 'Confirm & Publish',
      execute: async (pw) => {
        await saveProduct(payload, undefined, pw);
        const publishedTitle = payload.title.trim();
        setPostForm(createFreshPostForm());
        setPostSuccess(`"${publishedTitle}" is now live on AKIB Technologies.`);
      },
    });
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError(null);
    setCredSuccess(null);
    if (newPassword !== confirmPassword) {
      setCredError('New password and confirmation do not match.');
      return;
    }
    setCredSaving(true);
    try {
      await updateAdminCredentials(currentPassword, newUsername, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCredSuccess(
        `Updated admin credentials. Next login username: "${newUsername.trim()}".`
      );
    } catch (err) {
      setCredError(err instanceof Error ? err.message : 'Unable to update admin credentials.');
    } finally {
      setCredSaving(false);
    }
  };

  const openCreateProduct = () => {
    setActiveTab('post');
    setPostError(null);
    setPostSuccess(null);
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
      status: product.status === 'draft' ? 'draft' : 'active',
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

  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanedSpecs = formState.specs.filter(
      (s) => s.label.trim().length > 0 && s.value.trim().length > 0
    );
    const payload: ProductInput = { ...formState, specs: cleanedSpecs };
    const validationErr = validateProductInput(payload);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    requestPasswordConfirm({
      title: editingProductId ? 'Confirm Product Changes' : 'Confirm Product Publish',
      description: `Enter your admin password to save changes for "${payload.title.trim()}".`,
      confirmLabel: editingProductId ? 'Confirm & Save Changes' : 'Confirm & Publish',
      execute: async (pw) => {
        await saveProduct(payload, editingProductId || undefined, pw);
        setFormOpen(false);
      },
    });
  };

  const requestDeleteProduct = (product: Product) => {
    requestPasswordConfirm({
      title: 'Confirm Delete Product',
      description: `Enter your admin password to delete "${product.title}" (${product.sku}) from AKIB Technologies.`,
      confirmLabel: 'Confirm & Delete',
      danger: true,
      execute: async (pw) => {
        await deleteProduct(product.id, pw);
      },
    });
  };

  const requestStockChange = (product: Product, nextStock: number) => {
    const clamped = Math.max(0, nextStock);
    requestPasswordConfirm({
      title: 'Confirm Stock Adjustment',
      description: `Update live stock for "${product.title}" from ${product.stock} to ${clamped} units.`,
      confirmLabel: 'Confirm Stock Update',
      execute: async (pw) => {
        await adjustProductStock(product.id, clamped, pw);
      },
    });
  };

  const requestSeedCatalog = () => {
    requestPasswordConfirm({
      title: hasFirestoreProducts
        ? 'Confirm Starter Catalog Sync'
        : 'Confirm Starter Catalog Publish',
      description:
        'Enter your admin password to publish the BDT starter hardware catalog to Firestore.',
      confirmLabel: 'Confirm & Publish Catalog',
      execute: async (pw) => {
        await seedStarterCatalog(pw);
      },
    });
  };

  const navTabs = useMemo(() => {
    const list: {
      id: AdminTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }[] = [];
    if (perms.canAddProduct) {
      list.push({ id: 'post', label: 'Post Product', icon: PlusCircle });
    }
    if (perms.canEditProduct || perms.canDeleteProduct) {
      list.push({
        id: 'products',
        label:
          perms.canEditProduct && perms.canDeleteProduct
            ? 'Products (Edit / Delete)'
            : perms.canEditProduct
              ? 'Products (Edit & Stock)'
              : 'Products (Delete)',
        icon: Package,
      });
    }
    if (perms.canManageOrders) {
      list.push({ id: 'orders', label: 'Orders', icon: ShoppingCart });
    }
    if (isSuperAdmin) {
      list.push({ id: 'users', label: 'Managers & Users', icon: Users });
    }
    if (perms.canViewAnalytics) {
      list.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
    }
    if (isSuperAdmin) {
      list.push({ id: 'security', label: 'Change Password', icon: KeyRound });
    }
    return list;
  }, [perms, isSuperAdmin]);

  useEffect(() => {
    if (navTabs.length > 0 && !navTabs.some((t) => t.id === activeTab)) {
      setActiveTab(navTabs[0].id);
    }
  }, [navTabs, activeTab]);

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewStaffError(null);
    const cleanName = newStaffName.trim();
    const cleanUser = newStaffUsername.trim();
    if (cleanName.length < 2) {
      setNewStaffError('Manager full name must be at least 2 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,60}$/.test(cleanUser)) {
      setNewStaffError(
        'Username must be 3–60 characters using only letters, numbers, hyphens (-), or underscores (_).'
      );
      return;
    }
    if (newStaffPassword.length < 4 || newStaffPassword.length > 100) {
      setNewStaffError('Manager password must be between 4 and 100 characters.');
      return;
    }
    if (staffAccounts.some((s) => s.staffId === cleanUser.toLowerCase())) {
      setNewStaffError(`Username "@${cleanUser}" already exists.`);
      return;
    }

    const enabledLabels = STAFF_PERMISSION_OPTIONS.filter((o) => newStaffPerms[o.key]).map(
      (o) => o.label
    );

    requestPasswordConfirm({
      title: 'Confirm Create Manager Account',
      description: `Create manager "${cleanName}" (@${cleanUser}) with ${
        enabledLabels.length > 0 ? enabledLabels.join(', ') : 'no permissions checked yet'
      }.`,
      confirmLabel: 'Create Manager',
      execute: async (pw) => {
        await createStaffAccount(
          {
            displayName: cleanName,
            username: cleanUser,
            password: newStaffPassword,
            ...newStaffPerms,
          },
          pw
        );
        setNewStaffName('');
        setNewStaffUsername('');
        setNewStaffPassword('');
        setNewStaffPerms(DEFAULT_NEW_STAFF_PERMS);
      },
    });
  };

  const getManagerPerms = (m: StaffAccount): StaffPermissions => {
    return (
      staffPermDrafts[m.staffId] || {
        canAddProduct: Boolean(m.canAddProduct),
        canEditProduct: Boolean(m.canEditProduct),
        canDeleteProduct: Boolean(m.canDeleteProduct),
        canManageOrders: Boolean(m.canManageOrders),
        canViewAnalytics: Boolean(m.canViewAnalytics),
      }
    );
  };

  const isManagerPermsDirty = (m: StaffAccount): boolean => {
    const draft = staffPermDrafts[m.staffId];
    if (!draft) return false;
    return (
      draft.canAddProduct !== Boolean(m.canAddProduct) ||
      draft.canEditProduct !== Boolean(m.canEditProduct) ||
      draft.canDeleteProduct !== Boolean(m.canDeleteProduct) ||
      draft.canManageOrders !== Boolean(m.canManageOrders) ||
      draft.canViewAnalytics !== Boolean(m.canViewAnalytics)
    );
  };

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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              AKIB Operations Console
            </h1>
            {!isSuperAdmin && activeStaffAccount && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-semibold text-[#3749BB]">
                Manager: {activeStaffAccount.displayName} (@{activeStaffAccount.username})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3749BB]" />
            Password confirmation is required before every database change.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={requestSeedCatalog}
              className="px-4 py-2.5 rounded border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
            >
              {hasFirestoreProducts ? 'Sync BDT Starter Catalog' : 'Seed BDT Starter Catalog'}
            </button>
          )}
          {perms.canAddProduct && (
            <button
              type="button"
              onClick={openCreateProduct}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              Post New Product
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer min-h-[42px]"
            >
              <KeyRound className="w-4 h-4 text-[#3749BB]" />
              Change Password
            </button>
          )}
          <button
            type="button"
            onClick={lockAdminPortal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer min-h-[42px]"
          >
            <Lock className="w-4 h-4" />
            Lock Panel
          </button>
        </div>
      </div>

      {/* Responsive Workspace Shell */}
      {navTabs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3 max-w-xl mx-auto">
          <Lock className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No Permissions Enabled
          </h2>
          <p className="text-sm text-slate-600">
            Your manager account (@{adminCredentialUsername}) does not have any checked permissions yet. Ask the store administrator to check permissions for your account.
          </p>
        </div>
      ) : (
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
                  {tab.id === 'users' && (staffAccounts.length > 0 || analytics.trackedUsers.length > 0) && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        active ? 'text-blue-300' : 'text-slate-500'
                      }`}
                    >
                      {staffAccounts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Viewport */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* TAB 0: POST PRODUCT + QUICK MANAGE */}
          {activeTab === 'post' && perms.canAddProduct && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Post a Product to AKIB Technologies
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Paste any external image link, set your BDT price and stock, then confirm with your admin password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPostForm(createFreshPostForm());
                      setPostError(null);
                      setPostSuccess(null);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 underline self-start sm:self-center cursor-pointer"
                  >
                    Clear Form
                  </button>
                </div>

                <form onSubmit={handleInlinePostSubmit} className="p-6 space-y-5">
                  {postSuccess && (
                    <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-800">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        {postSuccess}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('products')}
                        className="text-xs font-semibold text-emerald-900 underline shrink-0 cursor-pointer"
                      >
                        Manage Products
                      </button>
                    </div>
                  )}

                  {postError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {postError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <ProductImage
                        src={postForm.imageUrl}
                        alt={postForm.title || 'New product preview'}
                      />
                    </div>
                    <div className="sm:col-span-8 space-y-2">
                      <label
                        htmlFor="post-image-url"
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-[#3749BB]" />
                        Product Image Link (URL)
                      </label>
                      <input
                        id="post-image-url"
                        type="url"
                        required
                        maxLength={1000}
                        value={postForm.imageUrl}
                        onChange={(e) =>
                          setPostForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                        }
                        placeholder="https://example.com/images/laptop-or-gpu.jpg"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Paste any direct HTTPS or HTTP image URL.</span>
                        {postForm.imageUrl && isValidImageUrl(postForm.imageUrl) && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valid Link
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="post-title"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Product Title
                      </label>
                      <input
                        id="post-title"
                        type="text"
                        required
                        maxLength={160}
                        value={postForm.title}
                        onChange={(e) =>
                          setPostForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="e.g. Lenovo IdeaPad Slim 5 Core i5 13th Gen 16GB RAM"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="post-brand"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Brand
                      </label>
                      <input
                        id="post-brand"
                        type="text"
                        required
                        maxLength={60}
                        value={postForm.brand}
                        onChange={(e) =>
                          setPostForm((prev) => ({ ...prev, brand: e.target.value }))
                        }
                        placeholder="e.g. ASUS, MSI, Lenovo, AMD"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="post-category"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Category
                      </label>
                      <select
                        id="post-category"
                        value={postForm.category}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            category: e.target.value as ProductCategory,
                          }))
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      >
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="post-price"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Special / Cash Price (BDT ৳)
                      </label>
                      <input
                        id="post-price"
                        type="number"
                        required
                        min={1}
                        step="1"
                        value={postForm.price || ''}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            price: Number(e.target.value),
                          }))
                        }
                        placeholder="85000"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="post-compare-price"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Regular Price (BDT ৳, Optional)
                      </label>
                      <input
                        id="post-compare-price"
                        type="number"
                        min={0}
                        step="1"
                        value={postForm.compareAtPrice || ''}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            compareAtPrice: Number(e.target.value || 0),
                          }))
                        }
                        placeholder="92000"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="post-stock"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Stock Quantity
                      </label>
                      <input
                        id="post-stock"
                        type="number"
                        required
                        min={0}
                        max={100000}
                        value={postForm.stock}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            stock: Number(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="post-sku"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        SKU Code
                      </label>
                      <input
                        id="post-sku"
                        type="text"
                        required
                        maxLength={48}
                        value={postForm.sku}
                        onChange={(e) =>
                          setPostForm((prev) => ({ ...prev, sku: e.target.value }))
                        }
                        placeholder="AKB-LTP-001"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-summary"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Short Description & Key Highlights
                    </label>
                    <textarea
                      id="post-summary"
                      required
                      rows={3}
                      maxLength={800}
                      value={postForm.summary}
                      onChange={(e) =>
                        setPostForm((prev) => ({ ...prev, summary: e.target.value }))
                      }
                      placeholder="Key features, processor/GPU specs, display, and official Bangladesh warranty details..."
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800">
                        Key Specifications ({postForm.specs.length}/16)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddPostSpecRow}
                        className="text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer"
                      >
                        + Add Spec Row
                      </button>
                    </div>
                    <div className="space-y-2">
                      {postForm.specs.map((spec, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={60}
                            value={spec.label}
                            onChange={(e) =>
                              handlePostSpecChange(idx, 'label', e.target.value)
                            }
                            placeholder="Label (e.g. Processor)"
                            className="w-1/3 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                          />
                          <input
                            type="text"
                            maxLength={120}
                            value={spec.value}
                            onChange={(e) =>
                              handlePostSpecChange(idx, 'value', e.target.value)
                            }
                            placeholder="Value (e.g. Intel Core i5-13420H)"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePostSpecRow(idx)}
                            aria-label="Remove spec row"
                            className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={postForm.featured}
                        onChange={(e) =>
                          setPostForm((prev) => ({ ...prev, featured: e.target.checked }))
                        }
                        className="rounded border-slate-300 text-[#3749BB] focus:ring-[#3749BB]"
                      />
                      <span>Show in Featured Products</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Status:</span>
                      <select
                        value={postForm.status}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            status: e.target.value as 'active' | 'draft',
                          }))
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                      >
                        <option value="active">Active (Live on Storefront)</option>
                        <option value="draft">Draft (Hidden)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[44px]"
                    >
                      Publish Product
                    </button>
                  </div>
                </form>
              </div>

              {/* Quick Edit & Delete List right under Post Form */}
              {hasFirestoreProducts && (perms.canEditProduct || perms.canDeleteProduct) && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        Manage Live Storefront Posts
                      </h3>
                      <p className="text-xs text-slate-500">
                        Quickly manage published product listings.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('products')}
                      className="text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer"
                    >
                      View All ({products.length})
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {products.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-9 rounded overflow-hidden border border-slate-200 shrink-0">
                            <ProductImage src={p.imageUrl} alt={p.title} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {p.title}
                            </p>
                            <p className="text-xs font-mono text-slate-500 tabular-nums">
                              {formatCurrency(p.price)} · {p.stock} in stock · {p.sku}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {perms.canEditProduct && (
                            <button
                              type="button"
                              onClick={() => openEditProduct(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}
                          {perms.canDeleteProduct && (
                            <button
                              type="button"
                              onClick={() => requestDeleteProduct(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && perms.canViewAnalytics && (
            <div className="space-y-6">
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
                  <p className="text-xs font-medium text-slate-500">Tracked Users</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {analytics.activeCustomersCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {analytics.totalLogins} total sign-ins
                  </p>
                </div>
              </div>

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
                  {perms.canEditProduct && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('products')}
                      className="text-xs font-semibold text-amber-900 underline cursor-pointer self-start sm:self-center"
                    >
                      Restock in Products
                    </button>
                  )}
                </div>
              )}

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
                      No published products yet. Click &quot;Post New Product&quot; to add items.
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

          {/* TAB 2: PRODUCT LISTINGS (EDIT & DELETE) */}
          {activeTab === 'products' && (perms.canEditProduct || perms.canDeleteProduct) && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Product Listings — Edit, Delete & Stock
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All edits, stock updates, and product deletions require password confirmation.
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
                    No matching products available yet.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    {perms.canAddProduct && (
                      <button
                        type="button"
                        onClick={openCreateProduct}
                        className="px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 cursor-pointer min-h-[44px]"
                      >
                        Post New Product
                      </button>
                    )}
                    {isSuperAdmin && !hasFirestoreProducts && (
                      <button
                        type="button"
                        onClick={requestSeedCatalog}
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
                            <div className="flex items-center gap-3 min-w-[210px]">
                              <div className="w-12 h-9 rounded overflow-hidden border border-slate-200 shrink-0">
                                <ProductImage src={p.imageUrl} alt={p.title} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate max-w-[210px]">
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
                              {perms.canEditProduct && (
                                <button
                                  type="button"
                                  disabled={p.stock <= 0}
                                  onClick={() => requestStockChange(p, p.stock - 1)}
                                  aria-label="Decrease stock"
                                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                              {perms.canEditProduct && (
                                <button
                                  type="button"
                                  onClick={() => requestStockChange(p, p.stock + 1)}
                                  aria-label="Increase stock"
                                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                            <div className="inline-flex items-center gap-2">
                              {perms.canEditProduct && (
                                <button
                                  type="button"
                                  onClick={() => openEditProduct(p)}
                                  aria-label={`Edit ${p.title}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                              )}
                              {perms.canDeleteProduct && (
                                <button
                                  type="button"
                                  onClick={() => requestDeleteProduct(p)}
                                  aria-label={`Delete ${p.title}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
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
          {activeTab === 'orders' && perms.canManageOrders && (
            <div className="space-y-4">
              {!isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-blue-950">
                    <span className="font-semibold">Customer Privacy Protection: </span>
                    Sign in with your authorized Google account to load private customer phone numbers, shipping addresses, and order records.
                  </div>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="px-4 py-2 rounded bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] shrink-0 cursor-pointer min-h-[38px]"
                  >
                    Connect Google Admin
                  </button>
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const
                    ).map((st) => (
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
                    ))}
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
                              {order.items.reduce((acc, i) => acc + i.quantity, 0)} items ·{' '}
                              {order.city}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={order.status}
                                onChange={(e) => {
                                  const nextStatus = e.target.value as OrderStatus;
                                  if (nextStatus === order.status) return;
                                  requestPasswordConfirm({
                                    title: 'Confirm Order Status Change',
                                    description: `Change Order #${order.orderNumber} (${order.customerName}) status from "${order.status}" to "${nextStatus}".`,
                                    confirmLabel: 'Confirm Status Update',
                                    execute: async (pw) => {
                                      await updateOrderStatus(order.id, nextStatus, pw);
                                    },
                                  });
                                }}
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            requestPasswordConfirm({
                              title: 'Confirm Courier Note Update',
                              description: `Save fulfillment note for Order #${selectedOrder.orderNumber}.`,
                              confirmLabel: 'Confirm & Save Note',
                              execute: async (pw) => {
                                await updateOrderStatus(
                                  selectedOrder.id,
                                  selectedOrder.status,
                                  pw,
                                  orderNoteDraft
                                );
                                setSelectedOrder(null);
                              },
                            });
                          }
                        }}
                        placeholder="Add tracking ID or dispatch remarks..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        requestPasswordConfirm({
                          title: 'Confirm Courier Note Update',
                          description: `Save fulfillment note for Order #${selectedOrder.orderNumber}.`,
                          confirmLabel: 'Confirm & Save Note',
                          execute: async (pw) => {
                            await updateOrderStatus(
                              selectedOrder.id,
                              selectedOrder.status,
                              pw,
                              orderNoteDraft
                            );
                            setSelectedOrder(null);
                          },
                        });
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

          {/* TAB 4: MANAGERS (ADD USERNAME/PASSWORD + CHECKBOXES) & TRACKED USERS */}
          {activeTab === 'users' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Create New Manager Account Form */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2.5">
                  <UserPlus className="w-5 h-5 text-[#EF4A23]" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Add New Manager Account
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create a username and password for a manager and check the boxes for what they are allowed to do in /admin.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateStaffSubmit} className="p-6 space-y-5">
                  {newStaffError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {newStaffError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="mgr-name"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Manager Name
                      </label>
                      <input
                        id="mgr-name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={80}
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        placeholder="e.g. Rahim Ahmed"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="mgr-username"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Login Username
                      </label>
                      <input
                        id="mgr-username"
                        type="text"
                        required
                        minLength={3}
                        maxLength={60}
                        value={newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        placeholder="e.g. rahim"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="mgr-password"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Login Password
                      </label>
                      <div className="relative">
                        <input
                          id="mgr-password"
                          type={showNewStaffPw ? 'text' : 'password'}
                          required
                          minLength={4}
                          maxLength={100}
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          placeholder="Min 4 characters"
                          className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewStaffPw((v) => !v)}
                          aria-label={showNewStaffPw ? 'Hide password' : 'Show password'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showNewStaffPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-800 mb-2.5">
                      Select Manager Permissions (Checkboxes)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {STAFF_PERMISSION_OPTIONS.map((opt) => (
                        <label
                          key={opt.key}
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                            newStaffPerms[opt.key]
                              ? 'bg-blue-50/70 border-[#3749BB]/40'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newStaffPerms[opt.key]}
                            onChange={(e) =>
                              setNewStaffPerms((prev) => ({
                                ...prev,
                                [opt.key]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 rounded border-slate-300 text-[#3749BB] focus:ring-[#3749BB]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">{opt.label}</p>
                            <p className="text-[11px] text-slate-500 leading-snug">{opt.hint}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[42px]"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Manager Account
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Manager Accounts List with Editable Checkboxes */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Manager Accounts ({staffAccounts.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Check or uncheck permissions per manager, reset their password, or suspend/delete access.
                    </p>
                  </div>
                </div>

                {staffAccounts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No manager accounts added yet. Use the form above to create a username, password, and permission checkboxes for your manager.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {staffAccounts.map((mgr) => {
                      const currentPerms = getManagerPerms(mgr);
                      const dirty = isManagerPermsDirty(mgr);
                      const lastLoginMs = mgr.lastLoginAt?.toMillis?.() ?? 0;
                      return (
                        <div key={mgr.staffId} className="p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 text-sm">
                                  {mgr.displayName}
                                </span>
                                <span className="font-mono text-xs text-slate-500">
                                  @{mgr.username}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    mgr.status === 'active' && mgr.active
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {mgr.status === 'active' && mgr.active ? 'Active' : 'Suspended'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                                {mgr.loginCount || 0} logins ·{' '}
                                {lastLoginMs > 0
                                  ? `Last login ${new Date(lastLoginMs).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : 'Never signed in yet'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPwStaff(mgr);
                                  setResetPwValue('');
                                  setShowResetPwValue(false);
                                  setResetPwError(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                Reset Password
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextStatus =
                                    mgr.status === 'active' ? 'suspended' : 'active';
                                  requestPasswordConfirm({
                                    title:
                                      nextStatus === 'suspended'
                                        ? 'Confirm Suspend Manager'
                                        : 'Confirm Activate Manager',
                                    description: `${
                                      nextStatus === 'suspended' ? 'Suspend' : 'Re-activate'
                                    } login access for ${mgr.displayName} (@${mgr.username}).`,
                                    confirmLabel:
                                      nextStatus === 'suspended'
                                        ? 'Suspend Manager'
                                        : 'Activate Manager',
                                    execute: async (pw) => {
                                      await setStaffStatus(mgr.staffId, nextStatus, pw);
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
                              >
                                {mgr.status === 'active' ? (
                                  <>
                                    <PauseCircle className="w-3.5 h-3.5" />
                                    Suspend
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    Activate
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  requestPasswordConfirm({
                                    title: 'Confirm Delete Manager',
                                    description: `Permanently delete manager "${mgr.displayName}" (@${mgr.username}). Their login will stop working immediately (use Suspend if you may re-enable them later).`,
                                    confirmLabel: 'Confirm & Delete',
                                    danger: true,
                                    execute: async (pw) => {
                                      await setStaffStatus(mgr.staffId, 'deleted', pw);
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                            <div className="flex flex-wrap items-center gap-3">
                              {STAFF_PERMISSION_OPTIONS.map((opt) => (
                                <label
                                  key={opt.key}
                                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={currentPerms[opt.key]}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setStaffPermDrafts((prev) => ({
                                        ...prev,
                                        [mgr.staffId]: {
                                          ...getManagerPerms(mgr),
                                          [opt.key]: checked,
                                        },
                                      }));
                                    }}
                                    className="rounded border-slate-300 text-[#3749BB] focus:ring-[#3749BB]"
                                  />
                                  <span className="font-medium">{opt.label}</span>
                                </label>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={!dirty}
                              onClick={() => {
                                const snapshot = getManagerPerms(mgr);
                                requestPasswordConfirm({
                                  title: 'Confirm Save Manager Permissions',
                                  description: `Update permission checkboxes for ${mgr.displayName} (@${mgr.username}).`,
                                  confirmLabel: 'Save Checkboxes',
                                  execute: async (pw) => {
                                    await updateStaffPermissions(mgr.staffId, snapshot, pw);
                                    setStaffPermDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[mgr.staffId];
                                      return next;
                                    });
                                  },
                                });
                              }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                dirty
                                  ? 'bg-[#3749BB] text-white hover:bg-[#2A3998]'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              Save Checkboxes
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-blue-950">
                    <span className="font-semibold">User Login Privacy Protection: </span>
                    Sign in with your authorized Google Admin account to view logged-in users and manage their Add/Edit product post permissions.
                  </div>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="px-4 py-2 rounded bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] shrink-0 cursor-pointer min-h-[38px]"
                  >
                    Connect Google Admin
                  </button>
                </div>
              )}

              {/* Summary KPIs for Logged-In Users */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Tracked Logged-In Users</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {analytics.trackedUsers.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Total Sign-In Sessions</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {analytics.totalLogins}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Users Permitted to Post / Edit</p>
                  <p className="font-mono text-2xl font-bold text-[#3749BB] mt-1 tabular-nums">
                    {analytics.permittedEditorsCount}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Logged-In Users & Post Permissions
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Track user sign-ins and grant or revoke permission to Add or Edit product posts. Every permission change requires your admin password.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Filter users by name or email..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    No logged-in user activity recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4 text-center">Logins</th>
                          <th className="py-3 px-4">Last Login</th>
                          <th className="py-3 px-4 text-right">Orders / Spend</th>
                          <th className="py-3 px-4 text-center">Add Post</th>
                          <th className="py-3 px-4 text-center">Edit Post</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredUsers.map((u) => (
                          <tr key={u.uid} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {u.photoURL ? (
                                  <img
                                    src={u.photoURL}
                                    alt={u.name}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate max-w-[180px]">
                                    {u.name}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-slate-900 tabular-nums">
                              {u.loginCount}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {u.lastLoginMs > 0
                                ? new Date(u.lastLoginMs).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recorded'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                              {u.orderCount} · {formatCurrency(u.totalSpent)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextAdd = !u.canAddPost;
                                  requestPasswordConfirm({
                                    title: 'Confirm Permission Update',
                                    description: `${nextAdd ? 'Grant' : 'Revoke'} "Add Product Post" permission for ${u.name} (${u.email}).`,
                                    confirmLabel: 'Confirm Permission Update',
                                    execute: async (pw) => {
                                      await updateUserPostPermission(
                                        {
                                          uid: u.uid,
                                          email: u.email,
                                          displayName: u.name,
                                          photoURL: u.photoURL,
                                        },
                                        {
                                          canAddPost: nextAdd,
                                          canEditPost: u.canEditPost,
                                        },
                                        pw
                                      );
                                    },
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                  u.canAddPost
                                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {u.canAddPost ? 'Allowed' : 'Disabled'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextEdit = !u.canEditPost;
                                  requestPasswordConfirm({
                                    title: 'Confirm Permission Update',
                                    description: `${nextEdit ? 'Grant' : 'Revoke'} "Edit Product Post" permission for ${u.name} (${u.email}).`,
                                    confirmLabel: 'Confirm Permission Update',
                                    execute: async (pw) => {
                                      await updateUserPostPermission(
                                        {
                                          uid: u.uid,
                                          email: u.email,
                                          displayName: u.name,
                                          photoURL: u.photoURL,
                                        },
                                        {
                                          canAddPost: u.canAddPost,
                                          canEditPost: nextEdit,
                                        },
                                        pw
                                      );
                                    },
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                  u.canEditPost
                                    ? 'bg-[#3749BB] border-[#3749BB] text-white hover:bg-[#2A3998]'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {u.canEditPost ? 'Allowed' : 'Disabled'}
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

          {/* TAB 5: CHANGE ADMIN USERNAME & PASSWORD */}
          {activeTab === 'security' && isSuperAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-2xl">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Change Admin Username & Password
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update the username and password required to unlock{' '}
                  <span className="font-mono text-slate-700">/admin</span> and authorize every admin change.
                </p>
              </div>

              <form onSubmit={handleCredentialsSubmit} className="p-6 space-y-4">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Current Admin Username</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {adminCredentialUsername}
                  </span>
                </div>

                {credSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{credSuccess}</span>
                  </div>
                )}

                {credError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {credError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="sec-current-pw"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Current Admin Password
                  </label>
                  <div className="relative">
                    <input
                      id="sec-current-pw"
                      type={showCurrentPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current admin password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showCurrentPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="sec-new-username"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Admin Username
                  </label>
                  <input
                    id="sec-new-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={60}
                    autoComplete="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username (min 3 characters)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sec-new-pw"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="sec-new-pw"
                        type={showNewPw ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={100}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 4 characters"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showNewPw ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="sec-confirm-pw"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="sec-confirm-pw"
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={4}
                      maxLength={100}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={credSaving}
                    className="px-6 py-2.5 rounded bg-[#3749BB] text-white text-sm font-semibold hover:bg-[#2A3998] disabled:opacity-50 transition-colors cursor-pointer min-h-[44px]"
                  >
                    {credSaving ? 'Updating...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Product Edit Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
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
                  className="px-6 py-2.5 rounded-lg bg-[#3749BB] text-white text-sm font-semibold hover:bg-[#2A3998] cursor-pointer min-h-[44px]"
                >
                  {editingProductId ? 'Save Changes' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Confirmation Modal (Required before EVERY Admin Panel change) */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pendingAction.title}
          onClick={() => {
            if (!confirmActionBusy) setPendingAction(null);
          }}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#081621] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#EF4A23]" />
                <h2 className="font-display text-base font-bold">{pendingAction.title}</h2>
              </div>
              <button
                type="button"
                disabled={confirmActionBusy}
                onClick={() => setPendingAction(null)}
                aria-label="Cancel action"
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmActionSubmit} className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {pendingAction.description}
              </p>

              {confirmActionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {confirmActionError}
                </div>
              )}

              <div>
                <label
                  htmlFor="confirm-admin-pw"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {isSuperAdmin ? 'Admin' : 'Manager'} Password ({adminCredentialUsername})
                </label>
                <div className="relative">
                  <input
                    id="confirm-admin-pw"
                    type={showActionPassword ? 'text' : 'password'}
                    autoFocus
                    required
                    autoComplete="current-password"
                    value={confirmActionPassword}
                    onChange={(e) => setConfirmActionPassword(e.target.value)}
                    placeholder={`Enter your ${isSuperAdmin ? 'admin' : 'manager'} password to confirm`}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActionPassword((v) => !v)}
                    aria-label={showActionPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showActionPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={confirmActionBusy}
                  onClick={() => setPendingAction(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmActionBusy}
                  className={`px-5 py-2.5 rounded-lg text-white text-xs sm:text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer min-h-[42px] ${
                    pendingAction.danger
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#3749BB] hover:bg-[#2A3998]'
                  }`}
                >
                  {confirmActionBusy ? 'Verifying...' : pendingAction.confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager Password Reset Modal */}
      {resetPwStaff && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Reset password for ${resetPwStaff.displayName}`}
          onClick={() => setResetPwStaff(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#081621] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#EF4A23]" />
                <h2 className="font-display text-base font-bold">
                  Reset Manager Password
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setResetPwStaff(null)}
                aria-label="Close"
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setResetPwError(null);
                if (resetPwValue.length < 4 || resetPwValue.length > 100) {
                  setResetPwError('Password must be between 4 and 100 characters.');
                  return;
                }
                const target = resetPwStaff;
                const nextPw = resetPwValue;
                setResetPwStaff(null);
                requestPasswordConfirm({
                  title: 'Confirm Manager Password Reset',
                  description: `Set a new login password for ${target.displayName} (@${target.username}).`,
                  confirmLabel: 'Confirm Password Reset',
                  execute: async (pw) => {
                    await updateStaffPassword(target.staffId, nextPw, pw);
                  },
                });
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-slate-600">
                Enter a new login password for{' '}
                <span className="font-semibold text-slate-900">{resetPwStaff.displayName}</span>{' '}
                (<span className="font-mono">@{resetPwStaff.username}</span>).
              </p>
              {resetPwError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {resetPwError}
                </div>
              )}
              <div>
                <label
                  htmlFor="reset-mgr-pw"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  New Manager Password
                </label>
                <div className="relative">
                  <input
                    id="reset-mgr-pw"
                    type={showResetPwValue ? 'text' : 'password'}
                    autoFocus
                    required
                    minLength={4}
                    maxLength={100}
                    value={resetPwValue}
                    onChange={(e) => setResetPwValue(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPwValue((v) => !v)}
                    aria-label={showResetPwValue ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showResetPwValue ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setResetPwStaff(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
