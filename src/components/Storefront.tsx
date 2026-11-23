import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  HardDrive,
  Headphones,
  Laptop,
  Monitor,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { HERO_WORKSTATION_IMAGE } from '../lib/starterCatalog';
import { formatCurrency } from '../lib/validation';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../types';
import { ProductImage } from './ProductImage';

interface StorefrontProps {
  selectedCategory: ProductCategory | 'All';
  onSelectCategory: (cat: ProductCategory | 'All') => void;
  onSelectProduct: (product: Product) => void;
  onNavigateOrders: () => void;
  onOpenProductEditor: (product: Product | null) => void;
}

type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'in_stock';

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  Laptops: Laptop,
  Processors: Cpu,
  'Graphics Cards': Cpu,
  Monitors: Monitor,
  Peripherals: Headphones,
  Networking: Wifi,
  Storage: HardDrive,
};

export function Storefront({
  selectedCategory,
  onSelectCategory,
  onSelectProduct,
  onNavigateOrders,
  onOpenProductEditor,
}: StorefrontProps) {
  const {
    products,
    productsLoading,
    hasFirestoreProducts,
    userAccess,
    addToCart,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch {
      return '';
    }
  });
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  const visibleProducts = useMemo(() => {
    const activeOnly = products.filter((p) => p.status === 'active');
    const q = searchQuery.trim().toLowerCase();

    const filtered = activeOnly.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'in_stock') {
      sorted.sort((a, b) => b.stock - a.stock);
    }
    return sorted;
  }, [products, selectedCategory, searchQuery, sortBy]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main id="top" className="bg-[#F2F4F8]">
      {/* StarTech-Style Category & Quick Search Strip */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat);
                    scrollToCatalog();
                  }}
                  className={`px-3 py-1.5 rounded text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#081621] text-white'
                      : 'text-slate-700 hover:text-[#EF4A23] hover:bg-slate-100'
                  }`}
                >
                  {cat === 'All' ? 'All Products' : cat}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search laptop, GPU, monitor, SKU..."
              aria-label="Search AKIB Technologies catalog"
              className="w-full pl-9 pr-3 py-1.5 rounded border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3749BB]"
            />
          </div>
        </div>
      </div>

      {/* 1. StarTech.com.bd Style Hero Showcase + Side Highlights */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Primary Banner */}
          <div className="lg:col-span-8 relative rounded-lg overflow-hidden border border-slate-200 bg-[#081621] min-h-[280px] sm:min-h-[360px] flex items-end">
            <ProductImage
              src={HERO_WORKSTATION_IMAGE}
              alt="AKIB Technologies Bangladesh workstation desk with curved monitor and performance laptop"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081621]/95 via-[#081621]/55 to-transparent" />
            <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-3">
              <p className="text-xs font-semibold text-amber-300 tracking-wide">
                AKIB Technologies Bangladesh · Authorized Hardware Store
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight text-balance">
                Build Your Flagship Rig with Live Warehouse Inventory.
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed max-w-lg">
                Authentic laptops, RTX graphics cards, creator monitors, and custom peripherals at official Bangladeshi Taka pricing with 0% EMI and nationwide courier delivery.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToCatalog}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[44px]"
                >
                  Shop Featured Deals
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onNavigateOrders}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-white/10 backdrop-blur-xs border border-white/25 text-white text-sm font-medium hover:bg-white/20 transition-colors cursor-pointer min-h-[44px]"
                >
                  Track My Order
                </button>
              </div>
            </div>
          </div>

          {/* Right Quick Services & Delivery Panel (StarTech Sidebar Style) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
                Bangladesh Delivery & Support
              </h2>
              <div className="divide-y divide-slate-100 mt-1">
                <div className="py-3 flex items-start gap-3">
                  <Truck className="w-5 h-5 text-[#EF4A23] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      60৳ Dhaka · 130৳ Outside Dhaka
                    </p>
                    <p className="text-xs text-slate-500">
                      Free express courier nationwide on orders over 50,000৳
                    </p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#3749BB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Official Brand Warranty
                    </p>
                    <p className="text-xs text-slate-500">
                      Multiplan Center & IDB Bhaban verified warranty desk
                    </p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-3">
                  <Wrench className="w-5 h-5 text-[#3749BB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      0% EMI & Cash Discount
                    </p>
                    <p className="text-xs text-slate-500">
                      Cash on Delivery, bKash, Nagad & 12-month bank EMI
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded bg-[#F2F4F8] border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-4 h-4 text-[#EF4A23] shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Sales Helpline (BD)</p>
                  <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    +880 1700-000000
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateOrders}
                className="text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer whitespace-nowrap"
              >
                Track Order
              </button>
            </div>
          </div>
        </div>

        {/* 2. StarTech Featured Category Tile Grid */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Featured Categories
            </h2>
            <span className="text-xs text-slate-500">
              Click a category to filter live hardware stock
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {PRODUCT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              const active = selectedCategory === cat;
              const count = products.filter(
                (p) => p.status === 'active' && p.category === cat
              ).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onSelectCategory(active ? 'All' : cat);
                    scrollToCatalog();
                  }}
                  className={`p-3.5 rounded-lg border text-center flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer min-h-[92px] ${
                    active
                      ? 'bg-[#081621] border-[#081621] text-white'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-[#EF4A23] hover:text-[#EF4A23]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold leading-tight">{cat}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {count} items
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Featured Products Grid (StarTech 4-Column Card Layout) */}
      <section id="catalog-section" className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        {!hasFirestoreProducts && !productsLoading && (
          <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#EF4A23] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Showcase Catalog Preview (BDT)
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Previewing flagship hardware listings. Live stock checkout activates once inventory is published.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {selectedCategory === 'All' ? 'Featured Products' : selectedCategory}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing{' '}
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {visibleProducts.length}
              </span>{' '}
              verified listings in Bangladesh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userAccess?.canAddPost && (
              <button
                type="button"
                onClick={() => onOpenProductEditor(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#EF4A23] text-white text-xs sm:text-sm font-semibold hover:bg-[#D93E18] transition-colors cursor-pointer min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                Add Product Post
              </button>
            )}
            {selectedCategory !== 'All' && (
              <button
                type="button"
                onClick={() => onSelectCategory('All')}
                className="text-xs font-semibold text-[#3749BB] hover:underline cursor-pointer"
              >
                Show All Categories
              </button>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort products"
              className="px-3 py-2 rounded border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3749BB] min-h-[40px]"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="in_stock">Availability: In Stock First</option>
            </select>
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-9 bg-slate-100 rounded w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <h3 className="font-display text-lg font-semibold text-slate-900 mb-1">
              No matching hardware found
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              Try clearing your search filter or switching to another hardware category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onSelectCategory('All');
              }}
              className="px-5 py-2.5 rounded bg-[#081621] text-white text-sm font-medium hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleProducts.map((product) => {
              const outOfStock = product.stock <= 0;
              const lowStock = !outOfStock && product.stock <= 5;
              const savings =
                product.compareAtPrice > product.price
                  ? product.compareAtPrice - product.price
                  : 0;
              const keyBullets = product.specs.slice(0, 3);

              return (
                <article
                  key={product.id}
                  className="group bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Image Box with Optional StarTech Savings Tag */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50 border-b border-slate-100">
                    {savings > 0 && (
                      <div className="absolute top-2.5 left-0 z-10 bg-[#6E2594] text-white text-[11px] font-semibold px-2.5 py-1 rounded-r font-mono tabular-nums">
                        Save: {formatCurrency(savings)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="w-full h-full block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3749BB]"
                    >
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.brand}</span>
                      </div>

                      <h3 className="font-display text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product)}
                          className="text-left hover:text-[#EF4A23] transition-colors cursor-pointer"
                        >
                          {product.title}
                        </button>
                      </h3>

                      {/* StarTech Signature 3 Spec Bullets */}
                      {keyBullets.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                          {keyBullets.map((spec, idx) => (
                            <li key={idx} className="truncate">
                              <span className="text-slate-500">{spec.label}:</span>{' '}
                              <span className="text-slate-700">{spec.value}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500 line-clamp-2">{product.summary}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-lg font-bold text-[#EF4A23] tabular-nums">
                            {formatCurrency(product.price)}
                          </span>
                          {savings > 0 && (
                            <span className="font-mono text-xs text-slate-400 line-through tabular-nums">
                              {formatCurrency(product.compareAtPrice)}
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            outOfStock
                              ? 'text-red-700'
                              : lowStock
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => addToCart(product, 1)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#3749BB] text-white text-xs sm:text-sm font-semibold hover:bg-[#2A3998] disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer min-h-[40px]"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {outOfStock ? 'Out of Stock' : 'Buy Now'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product)}
                          className="px-3 py-2 rounded border border-slate-200 bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px]"
                        >
                          Specs
                        </button>
                        {userAccess?.canEditPost && !product.isPreviewOnly && (
                          <button
                            type="button"
                            onClick={() => onOpenProductEditor(product)}
                            aria-label={`Edit ${product.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer min-h-[40px]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. StarTech.com.bd Style Deep Midnight Footer */}
      <footer className="bg-[#081621] text-slate-300 border-t border-slate-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <p className="font-display text-lg font-bold text-white">AKIB Technologies</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bangladesh&apos;s trusted destination for performance laptops, desktop components, creator displays, and custom workstation builds.
            </p>
            <p className="font-mono text-xs text-amber-300">Helpline: +880 1700-000000</p>
          </div>

          <div className="space-y-2.5 text-xs">
            <h3 className="font-display text-sm font-semibold text-white">Dhaka & Chattogram</h3>
            <p className="text-slate-400">Multiplan Center, New Elephant Road, Dhaka-1205</p>
            <p className="text-slate-400">BCS Computer City, IDB Bhaban, Agargaon, Dhaka</p>
            <p className="text-slate-400">Agrabad Commercial Area, Chattogram</p>
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-display text-sm font-semibold text-white">Hardware Categories</h3>
            <div className="flex flex-col items-start gap-1.5 text-slate-400">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('Laptops');
                  scrollToCatalog();
                }}
                className="hover:text-[#EF4A23] transition-colors cursor-pointer"
              >
                Gaming & Creator Laptops
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('Graphics Cards');
                  scrollToCatalog();
                }}
                className="hover:text-[#EF4A23] transition-colors cursor-pointer"
              >
                Desktop Graphics Cards
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('Monitors');
                  scrollToCatalog();
                }}
                className="hover:text-[#EF4A23] transition-colors cursor-pointer"
              >
                4K & UltraWide Monitors
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('Peripherals');
                  scrollToCatalog();
                }}
                className="hover:text-[#EF4A23] transition-colors cursor-pointer"
              >
                Keyboards & Accessories
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-display text-sm font-semibold text-white">Customer Service</h3>
            <div className="flex flex-col items-start gap-1.5 text-slate-400">
              <button
                type="button"
                onClick={onNavigateOrders}
                className="hover:text-[#EF4A23] transition-colors cursor-pointer"
              >
                Track My Order
              </button>
              <span className="text-slate-400">0% EMI Policy (Up to 12 Months)</span>
              <span className="text-slate-400">Official Brand Warranty Claim</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} AKIB Technologies Bangladesh. All rights reserved.</span>
            <span>Prices in Bangladeshi Taka (BDT ৳) · Secure Firebase Checkout</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
