import blueprint from '../../firebase-blueprint.json';
import type { OrderItem, ProductCategory, ProductSpec } from '../types';
import { PRODUCT_CATEGORIES } from '../types';

// Exact schema limits synchronized with firebase-blueprint.json
const PRODUCT_PROPS = blueprint.entities.Product.properties;
const USER_PROPS = blueprint.entities.UserProfile.properties;
const ORDER_PROPS = blueprint.entities.Order.properties;

export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const VALID_IMAGE_URL_REGEX = new RegExp(PRODUCT_PROPS.imageUrl.pattern);

export const BD_DISTRICTS = [
  'Dhaka Metro',
  'Chattogram',
  'Gazipur',
  'Narayanganj',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Rangpur',
  'Barishal',
  'Mymensingh',
  'Cumilla',
  'Bogura',
  'Other District (Bangladesh)',
] as const;

export function isValidDocumentId(id: string): boolean {
  return id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

export function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.length >= (PRODUCT_PROPS.imageUrl.minLength ?? 1) &&
    trimmed.length <= (PRODUCT_PROPS.imageUrl.maxLength ?? 1000) &&
    VALID_IMAGE_URL_REGEX.test(trimmed)
  );
}

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, PRODUCT_PROPS.sku.maxLength ?? 48);
}

export interface ProductInput {
  title: string;
  brand: string;
  category: ProductCategory;
  sku: string;
  price: number;
  compareAtPrice: number;
  stock: number;
  imageUrl: string;
  summary: string;
  specs: ProductSpec[];
  featured: boolean;
  status: 'active' | 'draft';
}

export function validateProductInput(input: ProductInput): string | null {
  const title = input.title.trim();
  const brand = input.brand.trim();
  const sku = sanitizeSku(input.sku);
  const summary = input.summary.trim();
  const imageUrl = input.imageUrl.trim();

  if (
    title.length < (PRODUCT_PROPS.title.minLength ?? 2) ||
    title.length > (PRODUCT_PROPS.title.maxLength ?? 160)
  ) {
    return 'Product title must be between 2 and 160 characters.';
  }
  if (
    brand.length < (PRODUCT_PROPS.brand.minLength ?? 1) ||
    brand.length > (PRODUCT_PROPS.brand.maxLength ?? 60)
  ) {
    return 'Brand name must be between 1 and 60 characters.';
  }
  if (!PRODUCT_CATEGORIES.includes(input.category)) {
    return 'Please select a valid hardware category.';
  }
  if (sku.length < 2 || !VALID_ID_REGEX.test(sku)) {
    return 'SKU must contain 2–48 alphanumeric characters, hyphens, or underscores.';
  }
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 10000000) {
    return 'Price must be between ৳1 and ৳1,00,00,000.';
  }
  if (
    !Number.isFinite(input.compareAtPrice) ||
    input.compareAtPrice < 0 ||
    input.compareAtPrice > 10000000
  ) {
    return 'Regular price must be 0 or higher.';
  }
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 100000) {
    return 'Stock quantity must be a whole number between 0 and 100,000.';
  }
  if (!isValidImageUrl(imageUrl)) {
    return 'Image URL must start with https:// or http:// (or a local /src/assets/images/ asset).';
  }
  if (
    summary.length < (PRODUCT_PROPS.summary.minLength ?? 5) ||
    summary.length > (PRODUCT_PROPS.summary.maxLength ?? 800)
  ) {
    return 'Product description must be between 5 and 800 characters.';
  }
  if (input.specs.length > 16) {
    return 'A maximum of 16 technical specifications is allowed.';
  }
  for (const spec of input.specs) {
    if (
      spec.label.trim().length === 0 ||
      spec.label.trim().length > 60 ||
      spec.value.trim().length === 0 ||
      spec.value.trim().length > 120
    ) {
      return 'Each specification label (max 60 chars) and value (max 120 chars) must be filled in.';
    }
  }
  return null;
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  notes: string;
}

export function validateCheckoutInput(input: CheckoutInput, items: OrderItem[]): string | null {
  if (items.length === 0 || items.length > 20) {
    return 'Cart must contain between 1 and 20 distinct items.';
  }
  if (input.customerName.trim().length < (ORDER_PROPS.customerName.minLength ?? 2)) {
    return 'Please enter your full recipient name.';
  }
  if (input.customerPhone.trim().length < (ORDER_PROPS.customerPhone.minLength ?? 5)) {
    return 'Please enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX).';
  }
  if (input.shippingAddress.trim().length < (ORDER_PROPS.shippingAddress.minLength ?? 5)) {
    return 'Please enter a complete street/house delivery address.';
  }
  if (input.city.trim().length < (ORDER_PROPS.city.minLength ?? 2)) {
    return 'Please select your delivery district/city.';
  }
  return null;
}

export function sanitizeUserProfileFields(fields: {
  displayName: string;
  phone: string;
  defaultAddress: string;
  city: string;
}) {
  return {
    displayName: sanitizeText(fields.displayName || 'Customer', USER_PROPS.displayName.maxLength ?? 120),
    phone: sanitizeText(fields.phone, USER_PROPS.phone.maxLength ?? 40),
    defaultAddress: sanitizeText(fields.defaultAddress, USER_PROPS.defaultAddress.maxLength ?? 300),
    city: sanitizeText(fields.city, USER_PROPS.city.maxLength ?? 80),
  };
}

export function calculateShippingBDT(subtotal: number, city: string): number {
  if (subtotal <= 0 || subtotal >= 50000) return 0;
  const normalized = city.trim().toLowerCase();
  if (!normalized || normalized.includes('dhaka')) return 60;
  return 130;
}

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
  return `${formatted}৳`;
}
