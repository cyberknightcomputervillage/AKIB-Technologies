import React, { useEffect, useState } from 'react';
import { CheckCircle2, Link as LinkIcon, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { isValidImageUrl, validateProductInput, type ProductInput } from '../lib/validation';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductSpec,
} from '../types';
import { ProductImage } from './ProductImage';

interface ProductEditorModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}

function buildInitialState(product: Product | null): ProductInput {
  if (product) {
    return {
      title: product.title,
      brand: product.brand,
      category: product.category,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      imageUrl: product.imageUrl,
      summary: product.summary,
      specs:
        product.specs.length > 0
          ? product.specs
          : [{ label: 'Warranty', value: '2 Years Official Warranty' }],
      featured: product.featured,
      status: product.status === 'draft' ? 'draft' : 'active',
    };
  }
  return {
    title: '',
    brand: '',
    category: 'Laptops',
    sku: `AKB-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    price: 0,
    compareAtPrice: 0,
    stock: 10,
    imageUrl: '',
    summary: '',
    specs: [{ label: 'Warranty', value: '2 Years Official Warranty' }],
    featured: true,
    status: 'active',
  };
}

export function ProductEditorModal({
  open,
  product,
  onClose,
}: ProductEditorModalProps) {
  const { saveProduct } = useStore();
  const [formState, setFormState] = useState<ProductInput>(() => buildInitialState(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormState(buildInitialState(product));
      setError(null);
      setSaving(false);
    }
  }, [open, product]);

  if (!open) return null;

  const isEditing = Boolean(product);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedSpecs = formState.specs.filter(
      (s) => s.label.trim().length > 0 && s.value.trim().length > 0
    );
    const payload: ProductInput = { ...formState, specs: cleanedSpecs };
    const validationErr = validateProductInput(payload);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setSaving(true);
    try {
      await saveProduct(payload, product?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Product Post' : 'Add Product Post'}
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full my-auto max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {isEditing ? 'Edit Product Post' : 'Add New Product Post'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Authorized editor access · Changes sync live to AKIB Technologies.'
                : 'Authorized contributor access · Publish a new listing to AKIB Technologies.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Image Link + Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white">
              <ProductImage
                src={formState.imageUrl}
                alt={formState.title || 'Product preview'}
              />
            </div>
            <div className="sm:col-span-8 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <LinkIcon className="w-3.5 h-3.5 text-[#3749BB]" />
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
                placeholder="https://example.com/images/product.jpg"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Supports any HTTPS or HTTP image URL.</span>
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
                placeholder="e.g. ASUS ROG Strix G16 Gaming Laptop"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
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
                placeholder="e.g. ASUS, MSI, Lenovo"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
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
                  setFormState((prev) => ({ ...prev, price: Number(e.target.value) }))
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
                placeholder="92000"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
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
                  setFormState((prev) => ({ ...prev, stock: Number(e.target.value) }))
                }
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
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
                placeholder="AKB-LTP-001"
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
              placeholder="Key specifications, display features, and warranty coverage..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
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
                className="text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer"
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
                    placeholder="Label"
                    className="w-1/3 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                  />
                  <input
                    type="text"
                    maxLength={120}
                    value={spec.value}
                    onChange={(e) => handleSpecChange(idx, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
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

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.featured}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, featured: e.target.checked }))
                }
                className="rounded border-slate-300 text-[#3749BB] focus:ring-[#3749BB]"
              />
              <span>Show in Featured Products</span>
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
                <option value="active">Active (Live)</option>
                <option value="draft">Draft (Hidden)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] disabled:opacity-50 transition-colors cursor-pointer min-h-[44px]"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
