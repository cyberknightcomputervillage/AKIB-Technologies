import type { Timestamp } from 'firebase/firestore';

export const PRODUCT_CATEGORIES = [
  'Laptops',
  'Processors',
  'Graphics Cards',
  'Monitors',
  'Peripherals',
  'Networking',
  'Storage',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  category: ProductCategory;
  sku: string;
  price: number;
  compareAtPrice: number;
  stock: number;
  soldCount: number;
  imageUrl: string;
  summary: string;
  specs: ProductSpec[];
  featured: boolean;
  status: ProductStatus;
  lastOrderId: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  isPreviewOnly?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phone: string;
  defaultAddress: string;
  city: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserAccess {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  loginCount: number;
  canAddPost: boolean;
  canEditPost: boolean;
  lastLoginAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StaffPermissions {
  canAddProduct: boolean;
  canEditProduct: boolean;
  canDeleteProduct: boolean;
  canManageOrders: boolean;
  canViewAnalytics: boolean;
  canErpStock?: boolean;
  canErpPurchase?: boolean;
  canErpPurchaseReturn?: boolean;
  canErpSale?: boolean;
  canErpSalesReturn?: boolean;
  canErpProfit?: boolean;
  canErpSerialSearch?: boolean;
  canErpSetup?: boolean;
  canErpEdit?: boolean;
}

export interface StaffAccount extends StaffPermissions {
  staffId: string;
  username: string;
  displayName: string;
  active: boolean;
  status: 'active' | 'suspended' | 'deleted';
  loginCount: number;
  lastLoginAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type AdminRole = 'super_admin' | 'manager';

export type PaymentMethod = 'cod' | 'card_on_delivery' | 'bank_transfer';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  title: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  status: OrderStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type AppView = 'store' | 'orders' | 'admin';
export type ErpTabId =
  | 'erp-stock'
  | 'erp-purchase'
  | 'erp-purchase-return'
  | 'erp-sales'
  | 'erp-sales-return'
  | 'erp-profit'
  | 'erp-serial-search'
  | 'erp-setup';

export type AdminTab =
  | 'post'
  | 'products'
  | 'orders'
  | ErpTabId
  | 'users'
  | 'analytics'
  | 'security';

export const ERP_CATEGORIES = [
  'Laptops',
  'Processors',
  'Graphics Cards',
  'Monitors',
  'Peripherals',
  'Networking',
  'Storage',
  'Power Supply',
  'RAM & Memory',
  'Cooling',
  'Casing',
  'Accessories',
  'Other',
] as const;

export interface ErpBranch {
  branchId: string;
  name: string;
  location: string;
  phone: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpVendor {
  vendorId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpCustomer {
  customerId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpModel {
  modelId: string;
  brand: string;
  modelName: string;
  productName: string;
  category: string;
  defaultBuyPrice: number;
  defaultSellPrice: number;
  warranty: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ErpSerialHistoryEventType =
  | 'PURCHASE'
  | 'SALE'
  | 'PURCHASE_RETURN'
  | 'SALES_RETURN';

export interface ErpSerialHistoryEvent {
  type: ErpSerialHistoryEventType;
  timestampIso: string;
  timestampMs: number;
  refId: string;
  invoiceNumber: string;
  partyName: string;
  branchName: string;
  salespersonName: string;
  amount: number;
  profit: number;
  notes: string;
}

export type ErpSerialStatus = 'in_stock' | 'sold' | 'purchase_returned';

export interface ErpSerial {
  serialId: string;
  serialNumber: string;
  modelId: string;
  productName: string;
  brand: string;
  modelName: string;
  branchId: string;
  branchName: string;
  vendorId: string;
  vendorName: string;
  purchaseId: string;
  purchaseInvoice: string;
  purchaseCost: number;
  salePrice: number;
  status: ErpSerialStatus;
  lastSaleId: string;
  lastSaleInvoice: string;
  lastCustomerId: string;
  lastCustomerName: string;
  salespersonId: string;
  salespersonName: string;
  history: ErpSerialHistoryEvent[];
  purchasedAtIso: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpPurchaseItem {
  modelId: string;
  productName: string;
  brand: string;
  modelName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  serialNumbers: string[];
}

export interface ErpPurchase {
  purchaseId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  branchId: string;
  branchName: string;
  items: ErpPurchaseItem[];
  totalAmount: number;
  totalUnits: number;
  notes: string;
  status: 'completed' | 'partial_return' | 'returned';
  createdByName: string;
  purchaseDateIso: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpSaleItem {
  serialId: string;
  serialNumber: string;
  modelId: string;
  productName: string;
  brand: string;
  modelName: string;
  unitCost: number;
  unitPrice: number;
  profit: number;
  returned: boolean;
}

export interface ErpSale {
  saleId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchName: string;
  salespersonId: string;
  salespersonUsername: string;
  salespersonName: string;
  items: ErpSaleItem[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalUnits: number;
  returnedUnits: number;
  returnedRevenue: number;
  returnedProfit: number;
  saleMonth: string;
  saleDateIso: string;
  notes: string;
  status: 'completed' | 'partial_return' | 'returned';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ErpReturn {
  returnId: string;
  returnNumber: string;
  returnType: 'purchase_return' | 'sales_return';
  serialId: string;
  serialNumber: string;
  modelId: string;
  productName: string;
  branchId: string;
  branchName: string;
  partyId: string;
  partyName: string;
  refInvoiceNumber: string;
  amount: number;
  profitAdjustment: number;
  salespersonId: string;
  salespersonName: string;
  reason: string;
  returnMonth: string;
  returnDateIso: string;
  status: 'completed';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

