import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AdminConsole } from './components/AdminConsole';
import { CartDrawer } from './components/CartDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { OrdersView } from './components/OrdersView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SeoManager } from './components/SeoManager';
import { Storefront } from './components/Storefront';
import { StoreProvider, useStore } from './context/StoreContext';
import type { AppView, Product, ProductCategory } from './types';

function AppShell() {
  const { products, toast, clearToast } = useStore();
  const [activeView, setActiveView] = useState<AppView>('store');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-slate-900 flex flex-col">
      <SeoManager
        selectedProduct={selectedProduct}
        activeView={activeView}
        products={products}
      />

      <Header
        activeView={activeView}
        onNavigateView={setActiveView}
        onSelectCategory={setSelectedCategory}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="flex-1">
        {activeView === 'store' && (
          <Storefront
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSelectProduct={setSelectedProduct}
            onNavigateOrders={() => setActiveView('orders')}
            onNavigateAdmin={() => setActiveView('admin')}
          />
        )}

        {activeView === 'orders' && (
          <OrdersView onBackToStore={() => setActiveView('store')} />
        )}

        {activeView === 'admin' && (
          <AdminConsole onBackToStore={() => setActiveView('store')} />
        )}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onViewOrders={() => setActiveView('orders')}
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
