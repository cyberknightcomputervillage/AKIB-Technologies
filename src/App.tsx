import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AdminConsole } from './components/AdminConsole';
import { AdminLoginGate } from './components/AdminLoginGate';
import { CartDrawer } from './components/CartDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { OrdersView } from './components/OrdersView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SeoManager } from './components/SeoManager';
import { Storefront } from './components/Storefront';
import { StoreProvider, useStore } from './context/StoreContext';
import type { AppView, Product, ProductCategory } from './types';

function resolveViewFromPath(pathname: string): AppView {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/admin') return 'admin';
  if (clean === '/orders') return 'orders';
  return 'store';
}

function AppShell() {
  const { products, isAdmin, adminUnlocked, toast, clearToast } = useStore();
  const [activeView, setActiveView] = useState<AppView>(() =>
    resolveViewFromPath(window.location.pathname)
  );
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Synchronize SPA navigation with browser URL & history (Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      setActiveView(resolveViewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((view: AppView) => {
    // Public UI only navigates between '/' and '/orders'. '/admin' is reached via direct URL.
    const nextPath = view === 'orders' ? '/orders' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setActiveView(view === 'admin' ? 'store' : view);
  }, []);

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-slate-900 flex flex-col">
      <SeoManager
        selectedProduct={selectedProduct}
        activeView={activeView}
        products={products}
      />

      <Header
        activeView={activeView}
        onNavigateView={navigateTo}
        onSelectCategory={setSelectedCategory}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="flex-1">
        {activeView === 'store' && (
          <Storefront
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSelectProduct={setSelectedProduct}
            onNavigateOrders={() => navigateTo('orders')}
          />
        )}

        {activeView === 'orders' && (
          <OrdersView onBackToStore={() => navigateTo('store')} />
        )}

        {activeView === 'admin' &&
          (isAdmin && adminUnlocked ? (
            <AdminConsole onBackToStore={() => navigateTo('store')} />
          ) : (
            <AdminLoginGate onBackToStore={() => navigateTo('store')} />
          ))}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onViewOrders={() => navigateTo('orders')}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center justify-between gap-3 text-sm"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={clearToast}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </ErrorBoundary>
  );
}
