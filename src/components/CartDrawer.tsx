import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BD_DISTRICTS, calculateShippingBDT, formatCurrency } from '../lib/validation';
import type { Order, PaymentMethod } from '../types';
import { ProductImage } from './ProductImage';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onViewOrders: () => void;
}

export function CartDrawer({ open, onClose, onViewOrders }: CartDrawerProps) {
  const {
    user,
    userProfile,
    cart,
    cartSubtotal,
    updateCartQty,
    removeFromCart,
    signInWithGoogle,
    placeOrder,
  } = useStore();

  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmed'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('Dhaka Metro');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (userProfile) {
      setCustomerName((prev) => prev || userProfile.displayName || '');
      setCustomerPhone((prev) => prev || userProfile.phone || '');
      setShippingAddress((prev) => prev || userProfile.defaultAddress || '');
      if (userProfile.city) setCity(userProfile.city);
    } else if (user) {
      setCustomerName((prev) => prev || user.displayName || '');
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (!open && step === 'confirmed') {
      setStep('cart');
      setConfirmedOrder(null);
    }
  }, [open, step]);

  if (!open) return null;

  const shippingFee = calculateShippingBDT(cartSubtotal, city);
  const totalAmount = cartSubtotal + shippingFee;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const order = await placeOrder(
        {
          customerName,
          customerPhone,
          shippingAddress,
          city,
          notes,
        },
        paymentMethod
      );
      setConfirmedOrder(order);
      setStep('confirmed');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart and checkout"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-[#081621] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#EF4A23]" />
            <h2 className="font-display text-lg font-semibold">
              {step === 'cart'
                ? 'Shopping Cart'
                : step === 'checkout'
                  ? 'Bangladesh Checkout'
                  : 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart drawer"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-6 py-4">
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-2.5 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <h3 className="font-display font-semibold text-base">
                    Order #{confirmedOrder.orderNumber} Confirmed
                  </h3>
                </div>
                <p className="text-sm text-emerald-800">
                  Thank you, {confirmedOrder.customerName}. Dispatching to {confirmedOrder.city} with real-time stock reserved.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                <div className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Order Receipt Summary
                </div>
                {confirmedOrder.items.map((item) => (
                  <div
                    key={item.productId}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-3 flex items-center justify-between text-sm font-semibold text-slate-900 bg-slate-50">
                  <span>Total Payable</span>
                  <span className="font-mono text-[#EF4A23] tabular-nums">
                    {formatCurrency(confirmedOrder.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewOrders();
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-[#081621] text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
                >
                  Track My Order
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer min-h-[44px]"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="font-display font-semibold text-slate-900 mb-1">
                Your shopping cart is empty
              </p>
              <p className="text-sm text-slate-500 max-w-xs">
                Add laptops, GPUs, monitors, or peripherals to place an order anywhere in Bangladesh.
              </p>
            </div>
          ) : step === 'cart' ? (
            <div className="space-y-4">
              {cart.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex gap-4 pb-4 border-b border-slate-200 last:border-0"
                >
                  <div className="w-20 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <ProductImage src={product.imageUrl} alt={product.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {product.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`Remove ${product.title}`}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                      {formatCurrency(product.price)} · {product.stock} left
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="inline-flex items-center border border-slate-200 rounded-md">
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, quantity - 1)}
                          aria-label="Decrease quantity"
                          className="p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-mono font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          disabled={quantity >= product.stock}
                          onClick={() => updateCartQty(product.id, quantity + 1)}
                          aria-label="Increase quantity"
                          className="p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(product.price * quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              {!user ? (
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <Lock className="w-4 h-4 text-[#3749BB]" />
                    <span>Sign in required for verified checkout</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sign in with Google to reserve live warehouse stock, track your courier delivery, and secure your invoice.
                  </p>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[44px]"
                  >
                    Sign In with Google
                  </button>
                </div>
              ) : (
                <>
                  {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter recipient full name"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mobile Number (Bangladesh)
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={40}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="017XX-XXXXXX"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Full Delivery Address
                    </label>
                    <textarea
                      required
                      rows={2}
                      maxLength={300}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="House, road, block/sector, thana..."
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        District / Delivery Zone
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      >
                        {BD_DISTRICTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                      >
                        <option value="cod">Cash on Delivery</option>
                        <option value="card_on_delivery">POS Card on Delivery</option>
                        <option value="bank_transfer">bKash / Nagad / Bank</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Delivery Note (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Call before courier arrival, branch pickup..."
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                    />
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {cart.length > 0 && step !== 'confirmed' && (
          <div className="px-6 py-4 border-t border-slate-200 bg-[#F2F4F8] space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  Delivery ({city.toLowerCase().includes('dhaka') ? 'Dhaka' : 'Courier'})
                  {cartSubtotal >= 50000 ? ' · Free over 50,000৳' : ''}
                </span>
                <span className="font-mono tabular-nums">
                  {shippingFee === 0 ? 'Free' : formatCurrency(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="font-mono text-[#EF4A23] tabular-nums">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full px-5 py-3 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[44px]"
              >
                Proceed to Checkout
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-3 rounded border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100 cursor-pointer min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={!user || submitting}
                  className="flex-1 px-5 py-3 rounded bg-[#3749BB] text-white text-sm font-semibold hover:bg-[#2A3998] disabled:bg-slate-300 disabled:text-slate-500 transition-colors cursor-pointer min-h-[44px]"
                >
                  {submitting ? 'Confirming Order...' : 'Confirm Order'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
