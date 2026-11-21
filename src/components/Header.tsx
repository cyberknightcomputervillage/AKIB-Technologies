import React, { useState } from 'react';
import { LogOut, Menu, ShoppingBag, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { AppView, ProductCategory } from '../types';

interface HeaderProps {
  activeView: AppView;
  onNavigateView: (view: AppView) => void;
  onSelectCategory: (category: ProductCategory | 'All') => void;
  onOpenCart: () => void;
}

export function Header({
  activeView,
  onNavigateView,
  onSelectCategory,
  onOpenCart,
}: HeaderProps) {
  const { user, isAdmin, cartCount, signInWithGoogle, logout } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCategoryClick = (category: ProductCategory | 'All') => {
    onSelectCategory(category);
    onNavigateView('store');
    setMobileMenuOpen(false);
    const catalogEl = document.getElementById('catalog-section');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleViewClick = (view: AppView) => {
    onNavigateView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#081621] text-white border-b border-slate-800">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectCategory('All');
            handleViewClick('store');
          }}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          AKIB Technologies
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => handleCategoryClick('All')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer ${
              activeView === 'store'
                ? 'text-white underline underline-offset-8 decoration-[#EF4A23] decoration-2'
                : ''
            }`}
          >
            Catalog
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('Laptops')}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer"
          >
            Laptop
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('Graphics Cards')}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer"
          >
            Components
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('Monitors')}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer"
          >
            Monitor
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => handleViewClick('admin')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer ${
                activeView === 'admin'
                  ? 'text-[#EF4A23] underline underline-offset-8 decoration-[#EF4A23] decoration-2'
                  : 'text-slate-200'
              }`}
            >
              Admin
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleViewClick('orders')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white cursor-pointer ${
                activeView === 'orders'
                  ? 'text-white underline underline-offset-8 decoration-[#EF4A23] decoration-2'
                  : ''
              }`}
            >
              My Orders
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action Cluster (Cart + Account) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Shopping cart with ${cartCount} items`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <ShoppingBag className="w-4 h-4 text-[#EF4A23]" />
            <span className="hidden sm:inline">Cart</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#EF4A23]">
              {cartCount}
            </span>
          </button>

          {user ? (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleViewClick('orders')}
                title={user.email || 'Account'}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3749BB] text-white text-sm font-medium hover:bg-[#2D3D9E] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
              >
                {isAdmin ? (
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-200" />
                )}
                <span className="max-w-[110px] truncate">
                  {user.displayName?.split(' ')[0] || 'Account'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              Account
            </button>
          )}

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#081621] px-4 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCategoryClick('All')}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              All Catalog
            </button>
            <button
              type="button"
              onClick={() => handleCategoryClick('Laptops')}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              Laptop
            </button>
            <button
              type="button"
              onClick={() => handleCategoryClick('Graphics Cards')}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              Components
            </button>
            <button
              type="button"
              onClick={() => handleCategoryClick('Monitors')}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              Monitor
            </button>
          </div>
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleViewClick('orders')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              My Orders & Delivery Profile
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleViewClick('admin')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#3749BB] hover:bg-[#2D3D9E] cursor-pointer min-h-[44px]"
              >
                Admin Console
              </button>
            )}
            {user ? (
              <button
                type="button"
                onClick={() => {
                  void logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-slate-800 cursor-pointer min-h-[44px]"
              >
                Sign Out ({user.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void signInWithGoogle();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] cursor-pointer min-h-[44px]"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
