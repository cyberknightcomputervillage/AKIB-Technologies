import { useEffect } from 'react';
import type { Product } from '../types';

interface SeoManagerProps {
  selectedProduct: Product | null;
  activeView: string;
  products: Product[];
}

function resolveAbsoluteUrl(pathOrUrl: string, origin: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${cleanPath}`;
}

export function SeoManager({ selectedProduct, activeView, products }: SeoManagerProps) {
  useEffect(() => {
    const baseTitle =
      'AKIB Technologies — Leading Computer, Laptop & PC Hardware Store in Bangladesh';
    const baseDesc =
      'Shop authentic laptops, desktop GPUs, processors, monitors, and custom PC hardware in Bangladesh at AKIB Technologies with live stock and official warranty.';

    let title = baseTitle;
    let description = baseDesc;

    if (selectedProduct) {
      title = `${selectedProduct.title} Price in Bangladesh | AKIB Technologies`;
      description = selectedProduct.summary.slice(0, 155);
    } else if (activeView === 'orders') {
      title = 'Track Orders & Delivery | AKIB Technologies Bangladesh';
      description =
        'Track real-time order fulfillment, courier status, and purchase receipts at AKIB Technologies Bangladesh.';
    } else if (activeView === 'admin') {
      title = 'Admin Operations Console | AKIB Technologies';
      description =
        'Manage product listings, live BDT inventory, orders, and customer analytics for AKIB Technologies.';
    }

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', title);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', description);

    const origin = window.location.origin;
    const canonicalUrl = `${origin}${window.location.pathname}`;
    const resolvedImage = resolveAbsoluteUrl(
      selectedProduct?.imageUrl || '/src/assets/images/hero_tech_workstation_1795177064541.jpg',
      origin
    );

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', resolvedImage);

    const twImage = document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.setAttribute('content', resolvedImage);

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalUrl;

    // Dynamic Schema.org Product or ItemList JSON-LD (BDT)
    const existingDynamic = document.getElementById('schema-org-dynamic');
    if (existingDynamic) existingDynamic.remove();

    const script = document.createElement('script');
    script.id = 'schema-org-dynamic';
    script.type = 'application/ld+json';

    if (selectedProduct) {
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: selectedProduct.title,
        sku: selectedProduct.sku,
        image: resolvedImage,
        description: selectedProduct.summary,
        category: selectedProduct.category,
        brand: {
          '@type': 'Brand',
          name: selectedProduct.brand,
        },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'BDT',
          price: selectedProduct.price.toFixed(0),
          availability:
            selectedProduct.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'AKIB Technologies',
          },
        },
      });
    } else {
      const activeItems = products.filter((p) => p.status === 'active').slice(0, 12);
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'AKIB Technologies Featured Hardware Catalog Bangladesh',
        numberOfItems: activeItems.length,
        itemListElement: activeItems.map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'Product',
            name: item.title,
            sku: item.sku,
            image: resolveAbsoluteUrl(item.imageUrl, origin),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'BDT',
              price: item.price.toFixed(0),
              availability:
                item.stock > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
          },
        })),
      });
    }

    document.head.appendChild(script);
  }, [selectedProduct, activeView, products]);

  return null;
}
