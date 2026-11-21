import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Package, Shield, Truck, XCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BD_DISTRICTS, formatCurrency } from '../lib/validation';
import type { OrderStatus } from '../types';
import { ProductImage } from './ProductImage';

interface OrdersViewProps {
  onBackToStore: () => void;
}

const STATUS_DISPLAY: Record<
  OrderStatus,
  { label: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'Pending Confirmation', colorClass: 'text-amber-700', icon: Clock },
  processing: { label: 'Processing', colorClass: 'text-[#3749BB]', icon: Package },
  shipped: { label: 'Shipped via Courier', colorClass: 'text-indigo-700', icon: Truck },
  delivered: { label: 'Delivered', colorClass: 'text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', colorClass: 'text-red-700', icon: XCircle },
};

export function OrdersView({ onBackToStore }: OrdersViewProps) {
  const {
    user,
    userProfile,
    orders,
    ordersLoading,
    signInWithGoogle,
    cancelCustomerOrder,
    updateUserProfile,
  } = useStore();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [city, setCity] = useState('Dhaka Metro');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhone(userProfile.phone || '');
      setDefaultAddress(userProfile.defaultAddress || '');
      if (userProfile.city) setCity(userProfile.city);
    } else if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user, userProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfile({ displayName, phone, defaultAddress, city });
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Sign in to view your orders
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Access real-time Bangladesh courier tracking, invoices, and saved delivery details securely with Google Sign-In.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="px-6 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[44px]"
            >
              Sign In with Google
            </button>
            <button
              type="button"
              onClick={onBackToStore}
              className="px-5 py-2.5 rounded border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer min-h-[44px]"
            >
              Back to Store
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Hardware Storefront
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            My Orders & Delivery Profile
          </h1>
        </div>
        <div className="text-xs text-slate-500">
          Signed in as <span className="font-medium text-slate-800">{user.email}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Order History */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Order History ({orders.length})
          </h2>

          {ordersLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
              Loading your orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <p className="font-display font-semibold text-slate-900">No orders placed yet</p>
              <p className="text-sm text-slate-500">
                Your confirmed purchases and live fulfillment updates will appear here.
              </p>
              <button
                type="button"
                onClick={onBackToStore}
                className="px-5 py-2.5 rounded bg-[#3749BB] text-white text-sm font-semibold hover:bg-[#2A3998] cursor-pointer min-h-[44px]"
              >
                Explore Hardware Catalog
              </button>
            </div>
          ) : (
            orders.map((order) => {
              const statusInfo = STATUS_DISPLAY[order.status];
              const StatusIcon = statusInfo.icon;
              const dateLabel = order.createdAt?.toDate
                ? order.createdAt.toDate().toLocaleDateString('en-BD', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Just now';

              return (
                <article
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                      <div>
                        <span className="text-slate-500">Order </span>
                        <span className="font-mono font-semibold text-slate-900">
                          #{order.orderNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Placed </span>
                        <span className="font-medium text-slate-800">{dateLabel}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Total </span>
                        <span className="font-mono font-semibold text-[#EF4A23] tabular-nums">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusInfo.colorClass}`}
                    >
                      <StatusIcon className="w-4 h-4" />
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>

                  <div className="p-5 divide-y divide-slate-100">
                    {order.items.map((item) => (
                      <div
                        key={item.productId}
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-12 rounded-md overflow-hidden border border-slate-200 shrink-0">
                            <ProductImage src={item.imageUrl} alt={item.title} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-500 font-mono tabular-nums">
                              SKU: {item.sku} · Qty {item.quantity} x {formatCurrency(item.price)}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                      Deliver to:{' '}
                      <span className="font-medium text-slate-800">
                        {order.shippingAddress}, {order.city}
                      </span>{' '}
                      · {order.customerPhone}
                    </div>
                    {order.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => void cancelCustomerOrder(order.id)}
                        className="text-red-700 font-medium hover:underline cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Right: Saved Delivery Profile */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900 mb-1">
            Default Delivery Profile
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            Pre-fills your Bangladeshi delivery details during checkout.
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mobile Number (BD)
              </label>
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XX-XXXXXX"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Street Address
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                placeholder="House, road, block/sector, thana..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                District / City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              >
                {BD_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full px-4 py-2.5 rounded bg-[#081621] text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer min-h-[44px]"
            >
              {savingProfile ? 'Saving...' : 'Save Delivery Profile'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
