import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { STARTER_PRODUCTS } from '../lib/starterCatalog';
import {
  createCredentialPayload,
  verifyInitialCredentials,
  verifyStoredCredentials,
  type StoredAdminCredential,
} from '../lib/adminAuth';
import {
  calculateShippingBDT,
  isValidDocumentId,
  sanitizeSku,
  sanitizeText,
  sanitizeUserProfileFields,
  validateCheckoutInput,
  validateProductInput,
  type CheckoutInput,
  type ProductInput,
} from '../lib/validation';
import type {
  CartItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  UserProfile,
} from '../types';

interface StoreContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  products: Product[];
  productsLoading: boolean;
  hasFirestoreProducts: boolean;
  orders: Order[];
  ordersLoading: boolean;
  customers: UserProfile[];
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  clearToast: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (product: Product, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  placeOrder: (
    input: CheckoutInput,
    paymentMethod: PaymentMethod
  ) => Promise<Order>;
  cancelCustomerOrder: (orderId: string) => Promise<void>;
  updateUserProfile: (fields: {
    displayName: string;
    phone: string;
    defaultAddress: string;
    city: string;
  }) => Promise<void>;
  seedStarterCatalog: () => Promise<void>;
  saveProduct: (input: ProductInput, existingId?: string) => Promise<void>;
  adjustProductStock: (productId: string, newStock: number) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<void>;
  adminUnlocked: boolean;
  adminCredentialUsername: string;
  unlockAdminPortal: (username: string, password: string) => Promise<void>;
  lockAdminPortal: () => void;
  updateAdminCredentials: (
    currentPassword: string,
    newUsername: string,
    newPassword: string
  ) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'akib_tech_cart_v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminCredentialUsername, setAdminCredentialUsername] = useState('');

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customers, setCustomers] = useState<UserProfile[]>([]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage parse error
    }
    return [];
  });

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoSeededRef = useRef(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast({ message, type });
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const clearToast = useCallback(() => setToast(null), []);

  const isAdmin = useMemo(() => {
    if (!user || !user.emailVerified) return false;
    return (
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() ||
      isAdminDoc
    );
  }, [user, isAdminDoc]);

  // 1. Auth & User Profile sync (handles both popup and redirect sign-in flows)
  useEffect(() => {
    void getRedirectResult(auth).catch((error) => {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/unauthorized-domain') {
        showToast(
          `Domain "${window.location.hostname}" must be added to Firebase Console → Authentication → Settings → Authorized domains.`,
          'error'
        );
      }
    });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAdminDoc(false);
      setUserProfile(null);
      if (!firebaseUser) {
        setAdminUnlocked(false);
        setAdminCredentialUsername('');
      }

      if (firebaseUser) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          setIsAdminDoc(adminSnap.exists());
        } catch {
          setIsAdminDoc(false);
        }

        if (firebaseUser.emailVerified && isValidDocumentId(firebaseUser.uid)) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          try {
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              const sanitized = sanitizeUserProfileFields({
                displayName: firebaseUser.displayName || 'Customer',
                phone: '',
                defaultAddress: '',
                city: '',
              });
              await setDoc(userRef, {
                uid: firebaseUser.uid,
                email: sanitizeText(firebaseUser.email || '', 160),
                displayName: sanitized.displayName,
                photoURL: sanitizeText(firebaseUser.photoURL || '', 1000),
                phone: sanitized.phone,
                defaultAddress: sanitized.defaultAddress,
                city: sanitized.city,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
          }
        }
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Live user profile listener
  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );
    return () => unsub();
  }, [authReady, user]);

  // 2. Real-time Products listener
  useEffect(() => {
    if (!authReady) return;
    setProductsLoading(true);
    const productsQuery = isAdmin
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('status', '==', 'active'));

    const unsub = onSnapshot(
      productsQuery,
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        items.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setFirestoreProducts(items);
        setProductsLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    return () => unsub();
  }, [authReady, isAdmin]);

  // Seed Starter Catalog (admin-only)
  const seedStarterCatalog = useCallback(async () => {
    if (!user || !isAdmin) {
      throw new Error('Only verified administrators can seed the catalog.');
    }
    const batch = writeBatch(db);
    for (const item of STARTER_PRODUCTS) {
      const ref = doc(db, 'products', item.id);
      batch.set(ref, {
        title: item.title,
        brand: item.brand,
        category: item.category,
        sku: item.sku,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        stock: item.stock,
        soldCount: 0,
        imageUrl: item.imageUrl,
        summary: item.summary,
        specs: item.specs,
        featured: item.featured,
        status: item.status,
        lastOrderId: 'none',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
      showToast('Starter hardware catalog published to Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  }, [user, isAdmin, showToast]);

  // Auto-seed once when Admin signs in and Firestore products collection is empty
  useEffect(() => {
    if (
      authReady &&
      isAdmin &&
      !productsLoading &&
      firestoreProducts.length === 0 &&
      !autoSeededRef.current
    ) {
      autoSeededRef.current = true;
      void seedStarterCatalog();
    }
  }, [authReady, isAdmin, productsLoading, firestoreProducts.length, seedStarterCatalog]);

  // Effective catalog: live Firestore products, or preview showcase if DB is not seeded yet
  const hasFirestoreProducts = firestoreProducts.length > 0;
  const products = useMemo<Product[]>(() => {
    if (firestoreProducts.length > 0) return firestoreProducts;
    return STARTER_PRODUCTS.map((p) => ({
      ...p,
      createdBy: 'showcase',
      isPreviewOnly: true,
    }));
  }, [firestoreProducts]);

  // 3. Real-time Orders listener (only when authenticated)
  useEffect(() => {
    if (!authReady || !user) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    const ordersQuery = isAdmin
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('userId', '==', user.uid));

    const unsub = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list: Order[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Order, 'id'>),
        }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setOrders(list);
        setOrdersLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

  // 4. Admin-only real-time Customers listener
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setCustomers([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as UserProfile);
        setCustomers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, [authReady, isAdmin]);

  // Sync cart with live product stock & prices
  useEffect(() => {
    if (products.length === 0) return;
    setCart((prev) => {
      let changed = false;
      const next = prev
        .map((item) => {
          const live = products.find((p) => p.id === item.product.id);
          if (!live || live.status !== 'active' || live.stock <= 0) {
            changed = true;
            return null;
          }
          const clampedQty = Math.min(item.quantity, live.stock);
          if (
            clampedQty !== item.quantity ||
            live.price !== item.product.price ||
            live.stock !== item.product.stock ||
            live.imageUrl !== item.product.imageUrl
          ) {
            changed = true;
            return { product: live, quantity: clampedQty };
          }
          return item;
        })
        .filter((x): x is CartItem => x !== null);
      return changed ? next : prev;
    });
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota error
    }
  }, [cart]);

  // Auth Actions
  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Signed in securely with Google.', 'success');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        showToast(
          `Domain "${window.location.hostname}" is not yet authorized in Firebase Console → Authentication → Settings → Authorized domains.`,
          'error'
        );
        return;
      }
      const msg = error instanceof Error ? error.message : 'Sign-in failed.';
      showToast(msg, 'error');
    }
  }, [showToast]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setAdminUnlocked(false);
      showToast('Signed out.', 'info');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign-out failed.';
      showToast(msg, 'error');
    }
  }, [showToast]);

  // Cart Actions
  const addToCart = useCallback(
    (product: Product, qty = 1) => {
      if (product.isPreviewOnly) {
        showToast(
          'Catalog preview mode: sign in as Admin to publish live Firestore inventory before checkout.',
          'info'
        );
        return;
      }
      if (product.stock <= 0) {
        showToast(`${product.title} is currently out of stock.`, 'error');
        return;
      }
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === product.id);
        if (existing) {
          const nextQty = Math.min(existing.quantity + qty, product.stock, 50);
          if (nextQty === existing.quantity) {
            showToast(`Maximum available stock (${product.stock}) reached in cart.`, 'info');
            return prev;
          }
          showToast(`Updated ${product.title} quantity to ${nextQty}.`, 'success');
          return prev.map((c) =>
            c.product.id === product.id ? { ...c, product, quantity: nextQty } : c
          );
        }
        const safeQty = Math.min(Math.max(1, qty), product.stock, 50);
        showToast(`Added ${product.title} to your cart.`, 'success');
        return [...prev, { product, quantity: safeQty }];
      });
    },
    [showToast]
  );

  const updateCartQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((c) => c.product.id !== productId);
      return prev.map((c) =>
        c.product.id === productId
          ? { ...c, quantity: Math.min(qty, c.product.stock, 50) }
          : c
      );
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [cart]
  );

  // Atomic Order Placement Transaction (Order + Inventory Deduction)
  const placeOrder = useCallback(
    async (input: CheckoutInput, paymentMethod: PaymentMethod): Promise<Order> => {
      if (!user || !user.emailVerified) {
        throw new Error('Please sign in with a verified Google account before placing an order.');
      }
      if (cart.some((c) => c.product.isPreviewOnly)) {
        throw new Error('Preview products must be published by the store admin first.');
      }

      const draftItems: OrderItem[] = cart.map((c) => ({
        productId: c.product.id,
        title: sanitizeText(c.product.title, 160),
        sku: sanitizeText(c.product.sku, 48),
        price: c.product.price,
        quantity: c.quantity,
        imageUrl: sanitizeText(c.product.imageUrl, 1000),
      }));

      const validationErr = validateCheckoutInput(input, draftItems);
      if (validationErr) {
        throw new Error(validationErr);
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const orderNumber = `AKB-${Date.now().toString().slice(-6)}`;
      const orderRef = doc(db, 'orders', orderId);

      let confirmedOrder: Order | null = null;

      try {
        await runTransaction(db, async (tx) => {
          // 1. Read all product docs first (Firestore transaction requirement)
          const productSnaps = await Promise.all(
            cart.map((c) => tx.get(doc(db, 'products', c.product.id)))
          );

          const authoritativeItems: OrderItem[] = [];
          let subtotal = 0;

          for (let i = 0; i < cart.length; i++) {
            const snap = productSnaps[i];
            const cartItem = cart[i];
            if (!snap.exists()) {
              throw new Error(`Product "${cartItem.product.title}" is no longer available.`);
            }
            const data = snap.data() as Omit<Product, 'id'>;
            if (data.status !== 'active') {
              throw new Error(`Product "${data.title}" is currently unavailable.`);
            }
            if (data.stock < cartItem.quantity) {
              throw new Error(
                `Insufficient stock for "${data.title}". Only ${data.stock} remaining.`
              );
            }
            const lineTotal = data.price * cartItem.quantity;
            subtotal += lineTotal;
            authoritativeItems.push({
              productId: snap.id,
              title: sanitizeText(data.title, 160),
              sku: sanitizeText(data.sku, 48),
              price: data.price,
              quantity: cartItem.quantity,
              imageUrl: sanitizeText(data.imageUrl, 1000),
            });
          }

          const shippingFee = calculateShippingBDT(subtotal, input.city);
          const totalAmount = subtotal + shippingFee;

          const orderPayload = {
            orderNumber,
            userId: user.uid,
            customerName: sanitizeText(input.customerName, 120),
            customerEmail: sanitizeText(user.email || '', 160),
            customerPhone: sanitizeText(input.customerPhone, 40),
            shippingAddress: sanitizeText(input.shippingAddress, 300),
            city: sanitizeText(input.city, 80),
            paymentMethod,
            items: authoritativeItems,
            subtotal,
            shippingFee,
            totalAmount,
            status: 'pending' as const,
            notes: sanitizeText(input.notes, 500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // 2. Write Order + Atomically Deduct Product Inventory
          tx.set(orderRef, orderPayload);

          for (let i = 0; i < productSnaps.length; i++) {
            const snap = productSnaps[i];
            const data = snap.data() as Omit<Product, 'id'>;
            const qty = cart[i].quantity;
            tx.update(snap.ref, {
              stock: data.stock - qty,
              soldCount: (data.soldCount || 0) + qty,
              lastOrderId: orderId,
              updatedAt: serverTimestamp(),
            });
          }

          confirmedOrder = {
            id: orderId,
            orderNumber,
            userId: user.uid,
            customerName: orderPayload.customerName,
            customerEmail: orderPayload.customerEmail,
            customerPhone: orderPayload.customerPhone,
            shippingAddress: orderPayload.shippingAddress,
            city: orderPayload.city,
            paymentMethod,
            items: authoritativeItems,
            subtotal,
            shippingFee,
            totalAmount,
            status: 'pending',
            notes: orderPayload.notes,
          };
        });

        // Persist default shipping address to user profile (best-effort)
        const userRef = doc(db, 'users', user.uid);
        const profilePatch = sanitizeUserProfileFields({
          displayName: input.customerName,
          phone: input.customerPhone,
          defaultAddress: input.shippingAddress,
          city: input.city,
        });
        await updateDoc(userRef, {
          ...profilePatch,
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        setCart([]);
        showToast(`Order ${orderNumber} confirmed.`, 'success');
        return confirmedOrder!;
      } catch (err) {
        if (err instanceof Error && !err.message.toLowerCase().includes('permission')) {
          throw err;
        }
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }
    },
    [user, cart, showToast]
  );

  const cancelCustomerOrder = useCallback(
    async (orderId: string) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        showToast('Order cancelled.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [user, showToast]
  );

  const updateUserProfile = useCallback(
    async (fields: {
      displayName: string;
      phone: string;
      defaultAddress: string;
      city: string;
    }) => {
      if (!user) return;
      const sanitized = sanitizeUserProfileFields(fields);
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
        showToast('Shipping profile saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user, showToast]
  );

  // Admin Product CRUD
  const saveProduct = useCallback(
    async (input: ProductInput, existingId?: string) => {
      if (!user || !isAdmin) {
        throw new Error('Administrator authorization required.');
      }
      const errMsg = validateProductInput(input);
      if (errMsg) throw new Error(errMsg);

      const cleanSpecs = input.specs.slice(0, 16).map((s) => ({
        label: sanitizeText(s.label, 60),
        value: sanitizeText(s.value, 120),
      }));

      const sku = sanitizeSku(input.sku);
      const baseData = {
        title: sanitizeText(input.title, 160),
        brand: sanitizeText(input.brand, 60),
        category: input.category,
        sku,
        price: Number(input.price),
        compareAtPrice: Number(input.compareAtPrice || 0),
        stock: Math.trunc(Number(input.stock)),
        imageUrl: sanitizeText(input.imageUrl, 1000),
        summary: sanitizeText(input.summary, 800),
        specs: cleanSpecs,
        featured: Boolean(input.featured),
        status: input.status,
      };

      if (existingId) {
        const prodRef = doc(db, 'products', existingId);
        try {
          await updateDoc(prodRef, {
            ...baseData,
            updatedAt: serverTimestamp(),
          });
          showToast(`Updated "${baseData.title}".`, 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `products/${existingId}`);
        }
      } else {
        const slug = baseData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
        const newId = `${slug || 'item'}-${Date.now().toString(36)}`;
        const prodRef = doc(db, 'products', newId);
        try {
          await setDoc(prodRef, {
            ...baseData,
            soldCount: 0,
            lastOrderId: 'none',
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          showToast(`Published "${baseData.title}" to storefront.`, 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `products/${newId}`);
        }
      }
    },
    [user, isAdmin, showToast]
  );

  const adjustProductStock = useCallback(
    async (productId: string, newStock: number) => {
      if (!user || !isAdmin) return;
      const clamped = Math.max(0, Math.min(100000, Math.trunc(newStock)));
      try {
        await updateDoc(doc(db, 'products', productId), {
          stock: clamped,
          updatedAt: serverTimestamp(),
        });
        showToast(`Stock updated to ${clamped} units.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
      }
    },
    [user, isAdmin, showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!user || !isAdmin) return;
      try {
        await deleteDoc(doc(db, 'products', productId));
        showToast('Product removed from catalog.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    },
    [user, isAdmin, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, notes?: string) => {
      if (!user || !isAdmin) return;
      try {
        const patch: Record<string, unknown> = {
          status,
          updatedAt: serverTimestamp(),
        };
        if (typeof notes === 'string') {
          patch.notes = sanitizeText(notes, 500);
        }
        await updateDoc(doc(db, 'orders', orderId), patch);
        showToast(`Order status changed to ${status}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [user, isAdmin, showToast]
  );

  const unlockAdminPortal = useCallback(
    async (username: string, password: string) => {
      if (!user || !isAdmin) {
        throw new Error('Please sign in with the authorized Google Admin account first.');
      }
      const credRef = doc(db, 'adminConfig', 'credentials');
      let snap;
      try {
        snap = await getDoc(credRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'adminConfig/credentials');
      }

      if (snap.exists()) {
        const stored = snap.data() as StoredAdminCredential;
        const ok = await verifyStoredCredentials(username, password, stored);
        if (!ok) {
          throw new Error('Invalid admin username or password.');
        }
        setAdminCredentialUsername(stored.username);
        setAdminUnlocked(true);
        showToast('Admin panel unlocked.', 'success');
      } else {
        const ok = await verifyInitialCredentials(username, password);
        if (!ok) {
          throw new Error('Invalid admin username or password.');
        }
        const payload = await createCredentialPayload(username.trim(), password);
        try {
          await setDoc(credRef, {
            ...payload,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'adminConfig/credentials');
        }
        setAdminCredentialUsername(payload.username);
        setAdminUnlocked(true);
        showToast('Admin panel unlocked.', 'success');
      }
    },
    [user, isAdmin, showToast]
  );

  const lockAdminPortal = useCallback(() => {
    setAdminUnlocked(false);
    showToast('Admin panel locked.', 'info');
  }, [showToast]);

  const updateAdminCredentials = useCallback(
    async (currentPassword: string, newUsername: string, newPassword: string) => {
      if (!user || !isAdmin || !adminUnlocked) {
        throw new Error('Admin session is locked.');
      }
      const cleanUser = newUsername.trim();
      if (cleanUser.length < 3 || cleanUser.length > 60) {
        throw new Error('Username must be between 3 and 60 characters.');
      }
      if (newPassword.length < 4 || newPassword.length > 100) {
        throw new Error('Password must be between 4 and 100 characters.');
      }

      const credRef = doc(db, 'adminConfig', 'credentials');
      let snap;
      try {
        snap = await getDoc(credRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'adminConfig/credentials');
      }

      if (snap.exists()) {
        const stored = snap.data() as StoredAdminCredential;
        const validCurrent = await verifyStoredCredentials(
          stored.username,
          currentPassword,
          stored
        );
        if (!validCurrent) {
          throw new Error('Current password is incorrect.');
        }
      }

      const payload = await createCredentialPayload(cleanUser, newPassword);
      try {
        await setDoc(credRef, {
          ...payload,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        setAdminCredentialUsername(payload.username);
        showToast('Admin username and password updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'adminConfig/credentials');
      }
    },
    [user, isAdmin, adminUnlocked, showToast]
  );

  const value: StoreContextValue = {
    user,
    userProfile,
    authReady,
    isAdmin,
    products,
    productsLoading,
    hasFirestoreProducts,
    orders,
    ordersLoading,
    customers,
    cart,
    cartCount,
    cartSubtotal,
    toast,
    clearToast,
    showToast,
    signInWithGoogle,
    logout,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    placeOrder,
    cancelCustomerOrder,
    updateUserProfile,
    seedStarterCatalog,
    saveProduct,
    adjustProductStock,
    deleteProduct,
    updateOrderStatus,
    adminUnlocked,
    adminCredentialUsername,
    unlockAdminPortal,
    lockAdminPortal,
    updateAdminCredentials,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
