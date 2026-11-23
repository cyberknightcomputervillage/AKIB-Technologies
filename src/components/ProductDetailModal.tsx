import React, { useState } from 'react';
import { Minus, Pencil, Plus, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../lib/validation';
import type { Product } from '../types';
import { ProductImage } from './ProductImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onOpenCart: () => void;
  onEditProduct?: (product: Product) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onOpenCart,
  onEditProduct,
}: ProductDetailModalProps) {
  const { addToCart, userAccess } = useStore();
  const [qty, setQty] = useState(1);
  const [paymentView, setPaymentView] = useState<'cash' | 'emi'>('cash');

  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const maxQty = Math.max(1, Math.min(product.stock, 50));
  const regularPrice =
    product.compareAtPrice > product.price ? product.compareAtPrice : product.price;
  const savings =
    product.compareAtPrice > product.price ? product.compareAtPrice - product.price : 0;
  const emiPerMonth = Math.round(regularPrice / 12);

  const handleAdd = () => {
    addToCart(product, qty);
    onClose();
    if (!product.isPreviewOnly && !outOfStock) {
      onOpenCart();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span>{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700">Product Code: {product.sku}</span>
          </div>
          <div className="flex items-center gap-2">
            {userAccess?.canEditPost && !product.isPreviewOnly && onEditProduct && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Post
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* StarTech Contiguous Purchase Module */}
        <div className="overflow-y-auto p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Image Left */}
            <div className="lg:col-span-5 space-y-4">
              <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                <ProductImage src={product.imageUrl} alt={product.title} />
              </div>

              <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F2F4F8] border border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-[#3749BB] shrink-0" />
                  <span>Official Bangladesh Brand Warranty & Serial Verification</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F2F4F8] border border-slate-200">
                  <Truck className="w-4 h-4 text-[#EF4A23] shrink-0" />
                  <span>60৳ Dhaka Home Delivery · Free over 50,000৳</span>
                </div>
              </div>
            </div>

            {/* Purchase Details Right */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <h2
                  id="pdp-title"
                  className="font-display text-xl sm:text-2xl font-bold text-[#3749BB] leading-snug text-balance"
                >
                  {product.title}
                </h2>

                {/* StarTech Meta Info Strip */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-[#F2F4F8] text-slate-700">
                    Price:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {formatCurrency(product.price)}
                    </strong>
                  </span>
                  {savings > 0 && (
                    <span className="px-2.5 py-1 rounded bg-[#F2F4F8] text-slate-700">
                      Regular Price:{' '}
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {formatCurrency(regularPrice)}
                      </strong>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded bg-[#F2F4F8] text-slate-700">
                    Status:{' '}
                    <strong
                      className={outOfStock ? 'text-red-700' : 'text-emerald-700'}
                    >
                      {outOfStock ? 'Out of Stock' : `In Stock (${product.stock})`}
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#F2F4F8] text-slate-700">
                    Brand: <strong className="text-slate-900">{product.brand}</strong>
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{product.summary}</p>

              {/* StarTech Payment Options Selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-800">Payment Options</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentView('cash')}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      paymentView === 'cash'
                        ? 'border-[#3749BB] bg-blue-50/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-mono text-lg font-bold text-[#EF4A23] tabular-nums">
                      {formatCurrency(product.price)}
                    </p>
                    <p className="text-xs font-medium text-slate-800 mt-0.5">
                      Cash Discount Price
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Cash / bKash / Card on Delivery
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentView('emi')}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      paymentView === 'emi'
                        ? 'border-[#3749BB] bg-blue-50/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(emiPerMonth)}
                      <span className="text-xs font-normal text-slate-500">/month</span>
                    </p>
                    <p className="text-xs font-medium text-slate-800 mt-0.5">
                      0% EMI Facility
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Up to 12 Months on Regular Price
                    </p>
                  </button>
                </div>
              </div>

              {/* Quantity & Buy Now CTA */}
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center border border-slate-200 rounded bg-white">
                  <button
                    type="button"
                    disabled={outOfStock || qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="p-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {outOfStock ? 0 : qty}
                  </span>
                  <button
                    type="button"
                    disabled={outOfStock || qty >= maxQty}
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    aria-label="Increase quantity"
                    className="p-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={handleAdd}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#3749BB] text-white text-sm font-semibold hover:bg-[#2A3998] disabled:bg-slate-300 disabled:text-slate-500 transition-colors cursor-pointer min-h-[44px]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {outOfStock ? 'Out of Stock' : 'Buy Now'}
                </button>
              </div>

              {/* Technical Specifications Table */}
              {product.specs.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Specification</h3>
                  <dl className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                    {product.specs.map((spec, idx) => (
                      <div
                        key={`${spec.label}-${idx}`}
                        className="grid grid-cols-3 gap-3 px-4 py-2.5 text-xs sm:text-sm bg-white"
                      >
                        <dt className="font-medium text-slate-500 col-span-1">
                          {spec.label}
                        </dt>
                        <dd className="text-slate-900 col-span-2 font-mono text-xs sm:text-[13px]">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
