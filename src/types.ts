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
export type AdminTab = 'post' | 'products' | 'orders' | 'users' | 'analytics' | 'security';
