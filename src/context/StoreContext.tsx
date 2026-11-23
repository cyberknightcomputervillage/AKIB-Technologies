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
  createCredentialUpdatePayload,
  createStaffCredentialPayload,
  deriveAdminProofToken,
  deriveStaffProofToken,
  generateProofNonceId,
  timingSafeEqual,
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
  AdminRole,
  CartItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  StaffAccount,
  StaffPermissions,
  UserAccess,
  UserProfile,
} from '../types';

interface StoreContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  userAccess: UserAccess | null;
  userAccessList: UserAccess[];
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
  seedStarterCatalog: (adminPassword: string) => Promise<void>;
  saveProduct: (
    input: ProductInput,
    existingId?: string,
    adminPassword?: string
  ) => Promise<void>;
  adjustProductStock: (
    productId: string,
    newStock: number,
    adminPassword: string
  ) => Promise<void>;
  deleteProduct: (productId: string, adminPassword: string) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    adminPassword: string,
    notes?: string
  ) => Promise<void>;
  updateUserPostPermission: (
    targetUser: {
      uid: string;
      email: string;
      displayName: string;
      photoURL?: string;
    },
    patch: { canAddPost: boolean; canEditPost: boolean },
    adminPassword: string
  ) => Promise<void>;
  verifyAdminActionPassword: (adminPassword: string) => Promise<string>;
  adminUnlocked: boolean;
  adminRole: AdminRole;
  activeStaffAccount: StaffAccount | null;
  staffAccounts: StaffAccount[];
  adminCredentialUsername: string;
  unlockAdminPortal: (username: string, password: string) => Promise<void>;
  lockAdminPortal: () => void;
  updateAdminCredentials: (
    currentPassword: string,
    newUsername: string,
    newPassword: string
  ) => Promise<void>;
  createStaffAccount: (
    input: {
      displayName: string;
      username: string;
      password: string;
    } & StaffPermissions,
    adminPassword: string
  ) => Promise<void>;
  updateStaffPermissions: (
    staffId: string,
    permissions: StaffPermissions,
    adminPassword: string
  ) => Promise<void>;
  updateStaffPassword: (
    staffId: string,
    newPassword: string,
    adminPassword: string
  ) => Promise<void>;
  setStaffStatus: (
    staffId: string,
    status: 'active' | 'suspended' | 'deleted',
    adminPassword: string
  ) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'akib_tech_cart_v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [userAccessList, setUserAccessList] = useState<UserAccess[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [adminProofToken, setAdminProofToken] = useState<string | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('super_admin');
  const [activeStaffAccount, setActiveStaffAccount] = useState<StaffAccount | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
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
  const recordedLoginUidRef = useRef<string | null>(null);

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
      setUserAccess(null);

      if (!firebaseUser) {
        recordedLoginUidRef.current = null;
      } else {
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

          if (recordedLoginUidRef.current !== firebaseUser.uid) {
            recordedLoginUidRef.current = firebaseUser.uid;
            const accessRef = doc(db, 'userAccess', firebaseUser.uid);
            const safeName =
              sanitizeText(firebaseUser.displayName || 'Customer', 120) || 'Customer';
            const safeEmail = sanitizeText(firebaseUser.email || '', 160);
            const safePhoto = sanitizeText(firebaseUser.photoURL || '', 1000);
            try {
              const accessSnap = await getDoc(accessRef);
              if (!accessSnap.exists()) {
                await setDoc(accessRef, {
                  uid: firebaseUser.uid,
                  email: safeEmail,
                  displayName: safeName,
                  photoURL: safePhoto,
                  loginCount: 1,
                  canAddPost: false,
                  canEditPost: false,
                  lastLoginAt: serverTimestamp(),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                const prevCount = Number(accessSnap.data()?.loginCount || 0);
                await updateDoc(accessRef, {
                  displayName: safeName,
                  photoURL: safePhoto,
                  loginCount: Math.max(1, prevCount + 1),
                  lastLoginAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (err) {
              handleFirestoreError(
                err,
                OperationType.WRITE,
                `userAccess/${firebaseUser.uid}`
              );
            }
          }
        }
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, [showToast]);

  // Live user profile & post-permission listeners
  useEffect(() => {
    if (!authReady || !user) return;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );

    const unsubAccess = onSnapshot(
      doc(db, 'userAccess', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserAccess(snap.data() as UserAccess);
        } else {
          setUserAccess(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `userAccess/${user.uid}`)
    );

    return () => {
      unsubProfile();
      unsubAccess();
    };
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
        const items: Product[] = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Product, 'id'>),
          }))
          .filter((item) => item.status !== 'archived');
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

  const verifyAdminActionPassword = useCallback(
    async (adminPassword: string): Promise<string> => {
      if (!adminUnlocked || !adminProofToken || !adminCredentialUsername) {
        throw new Error('Admin session is locked. Unlock /admin first.');
      }
      if (!adminPassword || adminPassword.length < 4) {
        throw new Error('Enter your password to confirm this change.');
      }
      const derived =
        adminRole === 'manager' && activeStaffAccount
          ? await deriveStaffProofToken(activeStaffAccount.staffId, adminPassword)
          : await deriveAdminProofToken(adminCredentialUsername, adminPassword);
      if (!timingSafeEqual(derived, adminProofToken)) {
        throw new Error('Incorrect password.');
      }
      return derived;
    },
    [
      adminUnlocked,
      adminProofToken,
      adminCredentialUsername,
      adminRole,
      activeStaffAccount,
    ]
  );

  const seedStarterCatalogInternal = useCallback(
    async (proofTokenOverride?: string) => {
      if (!isAdmin && !proofTokenOverride) {
        throw new Error('Only administrators can seed the catalog.');
      }
      const batch = writeBatch(db);
      const auditId = proofTokenOverride ? generateProofNonceId() : undefined;
      if (proofTokenOverride && auditId) {
        batch.set(doc(db, 'adminProofs', auditId), {
          proof: proofTokenOverride,
          createdAt: serverTimestamp(),
        });
      }
      const creatorId =
        proofTokenOverride || !isAdmin || !user ? 'admin_portal' : user.uid;
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
          ...(auditId ? { auditId } : {}),
          createdBy: creatorId,
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
    },
    [user, isAdmin, showToast]
  );

  // Seed Starter Catalog (admin password confirmed)
  const seedStarterCatalog = useCallback(
    async (adminPassword: string) => {
      const proofToken = await verifyAdminActionPassword(adminPassword);
      await seedStarterCatalogInternal(proofToken);
    },
    [verifyAdminActionPassword, seedStarterCatalogInternal]
  );

  // Auto-seed once when Google Admin signs in and Firestore products collection is empty
  useEffect(() => {
    if (
      authReady &&
      isAdmin &&
      !productsLoading &&
      firestoreProducts.length === 0 &&
      !autoSeededRef.current
    ) {
      autoSeededRef.current = true;
      void seedStarterCatalogInternal();
    }
  }, [
    authReady,
    isAdmin,
    productsLoading,
    firestoreProducts.length,
    seedStarterCatalogInternal,
  ]);

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

  // 4. Admin-only real-time Customers & UserAccess listeners
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setCustomers([]);
      setUserAccessList([]);
      return;
    }
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as UserProfile);
        setCustomers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    const unsubAccessList = onSnapshot(
      collection(db, 'userAccess'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as UserAccess);
        list.sort((a, b) => {
          const tA = a.lastLoginAt?.toMillis?.() ?? 0;
          const tB = b.lastLoginAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setUserAccessList(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'userAccess')
    );
    return () => {
      unsubUsers();
      unsubAccessList();
    };
  }, [authReady, isAdmin]);

  // 5. Super Admin Manager Accounts list + Live Active Manager Permission Sync
  useEffect(() => {
    if (!authReady || !adminUnlocked || adminRole !== 'super_admin') {
      setStaffAccounts([]);
      return;
    }
    const staffQuery = query(
      collection(db, 'staffAccounts'),
      where('status', 'in', ['active', 'suspended'])
    );
    const unsub = onSnapshot(
      staffQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as StaffAccount);
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setStaffAccounts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staffAccounts')
    );
    return () => unsub();
  }, [authReady, adminUnlocked, adminRole]);

  const activeStaffId = activeStaffAccount?.staffId;
  useEffect(() => {
    if (!authReady || !adminUnlocked || adminRole !== 'manager' || !activeStaffId) {
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'staffAccounts', activeStaffId),
      (snap) => {
        if (!snap.exists()) {
          setAdminProofToken(null);
          setAdminUnlocked(false);
          setAdminRole('super_admin');
          setActiveStaffAccount(null);
          setAdminCredentialUsername('');
          showToast('Manager account is no longer active.', 'error');
          return;
        }
        const data = snap.data() as StaffAccount;
        if (!data.active || data.status !== 'active') {
          setAdminProofToken(null);
          setAdminUnlocked(false);
          setAdminRole('super_admin');
          setActiveStaffAccount(null);
          setAdminCredentialUsername('');
          showToast('Your manager access was suspended or revoked.', 'error');
          return;
        }
        setActiveStaffAccount(data);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `staffAccounts/${activeStaffId}`)
    );
    return () => unsub();
  }, [authReady, adminUnlocked, adminRole, activeStaffId, showToast]);

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

  // Product CRUD (Super Admin, Permitted Manager, or Permitted Storefront Editor)
  const saveProduct = useCallback(
    async (input: ProductInput, existingId?: string, adminPassword?: string) => {
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

      const isPermittedUserAction =
        adminPassword === undefined &&
        Boolean(user && user.emailVerified) &&
        (existingId ? Boolean(userAccess?.canEditPost) : Boolean(userAccess?.canAddPost));

      let proofToken: string | null = null;
      const isManagerAction = !isPermittedUserAction && adminRole === 'manager';
      if (!isPermittedUserAction) {
        if (isManagerAction) {
          if (!activeStaffAccount) {
            throw new Error('Manager session expired. Please sign in again.');
          }
          if (existingId && !activeStaffAccount.canEditProduct) {
            throw new Error('You do not have permission to edit products.');
          }
          if (!existingId && !activeStaffAccount.canAddProduct) {
            throw new Error('You do not have permission to add products.');
          }
        }
        proofToken = await verifyAdminActionPassword(adminPassword || '');
      }

      const batch = writeBatch(db);
      const auditId = proofToken ? generateProofNonceId() : undefined;
      if (proofToken && auditId) {
        if (isManagerAction && activeStaffAccount) {
          batch.set(doc(db, 'staffProofs', auditId), {
            staffId: activeStaffAccount.staffId,
            proof: proofToken,
            createdAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(db, 'adminProofs', auditId), {
            proof: proofToken,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (existingId) {
        const prodRef = doc(db, 'products', existingId);
        batch.update(prodRef, {
          ...baseData,
          ...(isManagerAction && activeStaffAccount
            ? { staffId: activeStaffAccount.staffId }
            : {}),
          ...(auditId ? { auditId } : {}),
          updatedAt: serverTimestamp(),
        });
        try {
          await batch.commit();
          showToast(`Updated "${baseData.title}" in Firestore.`, 'success');
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
        const createdBy =
          isPermittedUserAction && user
            ? user.uid
            : isManagerAction && activeStaffAccount
              ? activeStaffAccount.staffId
              : 'admin_portal';
        batch.set(prodRef, {
          ...baseData,
          ...(isManagerAction && activeStaffAccount
            ? { staffId: activeStaffAccount.staffId }
            : {}),
          ...(auditId ? { auditId } : {}),
          soldCount: 0,
          lastOrderId: 'none',
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        try {
          await batch.commit();
          showToast(`Published "${baseData.title}" to Firestore.`, 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `products/${newId}`);
        }
      }
    },
    [
      user,
      userAccess,
      adminRole,
      activeStaffAccount,
      verifyAdminActionPassword,
      showToast,
    ]
  );

  const adjustProductStock = useCallback(
    async (productId: string, newStock: number, adminPassword: string) => {
      const isManagerAction = adminRole === 'manager';
      if (isManagerAction && !activeStaffAccount?.canEditProduct) {
        throw new Error('You do not have permission to edit product stock.');
      }
      const proofToken = await verifyAdminActionPassword(adminPassword);
      const clamped = Math.max(0, Math.min(100000, Math.trunc(newStock)));
      const batch = writeBatch(db);
      const auditId = generateProofNonceId();
      if (isManagerAction && activeStaffAccount) {
        batch.set(doc(db, 'staffProofs', auditId), {
          staffId: activeStaffAccount.staffId,
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'products', productId), {
          stock: clamped,
          staffId: activeStaffAccount.staffId,
          auditId,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'adminProofs', auditId), {
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'products', productId), {
          stock: clamped,
          auditId,
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        showToast(`Stock updated to ${clamped} units.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
      }
    },
    [adminRole, activeStaffAccount, verifyAdminActionPassword, showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string, adminPassword: string) => {
      const isManagerAction = adminRole === 'manager';
      if (isManagerAction && !activeStaffAccount?.canDeleteProduct) {
        throw new Error('You do not have permission to delete products.');
      }
      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const auditId = generateProofNonceId();
      if (isManagerAction && activeStaffAccount) {
        batch.set(doc(db, 'staffProofs', auditId), {
          staffId: activeStaffAccount.staffId,
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'products', productId), {
          status: 'archived',
          staffId: activeStaffAccount.staffId,
          auditId,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'adminProofs', auditId), {
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'products', productId), {
          status: 'archived',
          auditId,
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        showToast('Product deleted from catalog.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    },
    [adminRole, activeStaffAccount, verifyAdminActionPassword, showToast]
  );

  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      adminPassword: string,
      notes?: string
    ) => {
      const isManagerAction = adminRole === 'manager';
      if (isManagerAction && !activeStaffAccount?.canManageOrders) {
        throw new Error('You do not have permission to manage orders.');
      }
      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const auditId = generateProofNonceId();
      const patch: Record<string, unknown> = {
        status,
        auditId,
        updatedAt: serverTimestamp(),
      };
      if (typeof notes === 'string') {
        patch.notes = sanitizeText(notes, 500);
      }
      if (isManagerAction && activeStaffAccount) {
        batch.set(doc(db, 'staffProofs', auditId), {
          staffId: activeStaffAccount.staffId,
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        patch.staffId = activeStaffAccount.staffId;
      } else {
        batch.set(doc(db, 'adminProofs', auditId), {
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, 'orders', orderId), patch);
      try {
        await batch.commit();
        showToast(`Order status changed to ${status}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [adminRole, activeStaffAccount, verifyAdminActionPassword, showToast]
  );

  const updateUserPostPermission = useCallback(
    async (
      targetUser: {
        uid: string;
        email: string;
        displayName: string;
        photoURL?: string;
      },
      patch: { canAddPost: boolean; canEditPost: boolean },
      adminPassword: string
    ) => {
      if (adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can manage user permissions.');
      }
      if (!isValidDocumentId(targetUser.uid)) {
        throw new Error('Invalid user record identifier.');
      }
      const proofToken = await verifyAdminActionPassword(adminPassword);
      const accessRef = doc(db, 'userAccess', targetUser.uid);
      const batch = writeBatch(db);
      const auditId = generateProofNonceId();
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: proofToken,
        createdAt: serverTimestamp(),
      });

      const alreadyTracked = userAccessList.some((u) => u.uid === targetUser.uid);
      if (alreadyTracked) {
        batch.update(accessRef, {
          canAddPost: Boolean(patch.canAddPost),
          canEditPost: Boolean(patch.canEditPost),
          auditId,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(accessRef, {
          uid: targetUser.uid,
          email: sanitizeText(targetUser.email, 160),
          displayName: sanitizeText(targetUser.displayName || 'Customer', 120) || 'Customer',
          photoURL: sanitizeText(targetUser.photoURL || '', 1000),
          loginCount: 1,
          canAddPost: Boolean(patch.canAddPost),
          canEditPost: Boolean(patch.canEditPost),
          auditId,
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        showToast(`Updated permissions for ${targetUser.displayName || targetUser.email}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `userAccess/${targetUser.uid}`);
      }
    },
    [adminRole, userAccessList, verifyAdminActionPassword, showToast]
  );

  const createStaffAccount = useCallback(
    async (
      input: { displayName: string; username: string; password: string } & StaffPermissions,
      adminPassword: string
    ) => {
      if (adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can add managers.');
      }
      const cleanName = sanitizeText(input.displayName, 80);
      const cleanUsername = input.username.trim();
      const staffId = cleanUsername.toLowerCase();
      if (cleanName.length < 2) {
        throw new Error('Manager display name must be at least 2 characters.');
      }
      if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 60 ||
        !/^[a-zA-Z0-9_-]+$/.test(cleanUsername)
      ) {
        throw new Error(
          'Username must be 3–60 characters using only letters, numbers, hyphens (-), or underscores (_).'
        );
      }
      if (input.password.length < 4 || input.password.length > 100) {
        throw new Error('Manager password must be between 4 and 100 characters.');
      }
      if (staffAccounts.some((s) => s.staffId === staffId)) {
        throw new Error(`Manager username "@${cleanUsername}" already exists.`);
      }

      const adminProof = await verifyAdminActionPassword(adminPassword);
      const cred = await createStaffCredentialPayload(cleanUsername, input.password);
      const auditId = generateProofNonceId();
      const permissions: StaffPermissions = {
        canAddProduct: Boolean(input.canAddProduct),
        canEditProduct: Boolean(input.canEditProduct),
        canDeleteProduct: Boolean(input.canDeleteProduct),
        canManageOrders: Boolean(input.canManageOrders),
        canViewAnalytics: Boolean(input.canViewAnalytics),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: adminProof,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'staffSecrets', cred.staffId), {
        staffId: cred.staffId,
        proofHash: cred.proofHash,
        active: true,
        ...permissions,
        auditId,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'staffAccounts', cred.staffId), {
        staffId: cred.staffId,
        username: cred.username,
        displayName: cleanName,
        active: true,
        status: 'active',
        ...permissions,
        loginCount: 0,
        auditId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast(`Created manager "@${cred.username}".`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `staffAccounts/${cred.staffId}`);
      }
    },
    [adminRole, staffAccounts, verifyAdminActionPassword, showToast]
  );

  const updateStaffPermissions = useCallback(
    async (
      staffId: string,
      permissions: StaffPermissions,
      adminPassword: string
    ) => {
      if (adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can edit manager permissions.');
      }
      if (!isValidDocumentId(staffId)) {
        throw new Error('Invalid manager ID.');
      }
      const adminProof = await verifyAdminActionPassword(adminPassword);
      const auditId = generateProofNonceId();
      const nextPerms: StaffPermissions = {
        canAddProduct: Boolean(permissions.canAddProduct),
        canEditProduct: Boolean(permissions.canEditProduct),
        canDeleteProduct: Boolean(permissions.canDeleteProduct),
        canManageOrders: Boolean(permissions.canManageOrders),
        canViewAnalytics: Boolean(permissions.canViewAnalytics),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: adminProof,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffSecrets', staffId), {
        ...nextPerms,
        auditId,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffAccounts', staffId), {
        ...nextPerms,
        auditId,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast('Saved manager permissions.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffAccounts/${staffId}`);
      }
    },
    [adminRole, verifyAdminActionPassword, showToast]
  );

  const updateStaffPassword = useCallback(
    async (staffId: string, newPassword: string, adminPassword: string) => {
      if (adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can reset manager passwords.');
      }
      if (!isValidDocumentId(staffId)) {
        throw new Error('Invalid manager ID.');
      }
      if (newPassword.length < 4 || newPassword.length > 100) {
        throw new Error('Password must be between 4 and 100 characters.');
      }
      const adminProof = await verifyAdminActionPassword(adminPassword);
      const cred = await createStaffCredentialPayload(staffId, newPassword);
      const auditId = generateProofNonceId();

      const batch = writeBatch(db);
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: adminProof,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffSecrets', staffId), {
        proofHash: cred.proofHash,
        auditId,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast(`Updated password for @${staffId}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffSecrets/${staffId}`);
      }
    },
    [adminRole, verifyAdminActionPassword, showToast]
  );

  const setStaffStatus = useCallback(
    async (
      staffId: string,
      status: 'active' | 'suspended' | 'deleted',
      adminPassword: string
    ) => {
      if (adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can update manager status.');
      }
      if (!isValidDocumentId(staffId)) {
        throw new Error('Invalid manager ID.');
      }
      const adminProof = await verifyAdminActionPassword(adminPassword);
      const auditId = generateProofNonceId();
      const active = status === 'active';

      const batch = writeBatch(db);
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: adminProof,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffSecrets', staffId), {
        active,
        auditId,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffAccounts', staffId), {
        active,
        status,
        auditId,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        const label =
          status === 'deleted'
            ? 'Manager account deleted.'
            : status === 'suspended'
              ? 'Manager account suspended.'
              : 'Manager account activated.';
        showToast(label, 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffAccounts/${staffId}`);
      }
    },
    [adminRole, verifyAdminActionPassword, showToast]
  );

  const unlockAdminPortal = useCallback(
    async (username: string, password: string) => {
      const cleanUser = username.trim();
      if (cleanUser.length < 3 || password.length < 4) {
        throw new Error('Invalid username or password.');
      }

      // 1. Try Super Admin credentials first
      const adminToken = await deriveAdminProofToken(cleanUser, password);
      const adminNonceId = generateProofNonceId();
      let adminAccepted = false;
      try {
        await setDoc(doc(db, 'adminProofs', adminNonceId), {
          proof: adminToken,
          createdAt: serverTimestamp(),
        });
        adminAccepted = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          !msg.toLowerCase().includes('permission') &&
          !msg.toLowerCase().includes('insufficient')
        ) {
          throw new Error('Unable to verify login. Please check your connection.');
        }
      }

      if (adminAccepted) {
        setAdminRole('super_admin');
        setActiveStaffAccount(null);
        setAdminProofToken(adminToken);
        setAdminCredentialUsername(cleanUser);
        setAdminUnlocked(true);
        showToast('Admin panel unlocked.', 'success');
        return;
      }

      // 2. Fallback to Manager / Staff credentials
      const staffId = cleanUser.toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(staffId) || !isValidDocumentId(staffId)) {
        throw new Error('Invalid username or password.');
      }
      const staffToken = await deriveStaffProofToken(staffId, password);
      const staffNonceId = generateProofNonceId();
      try {
        await setDoc(doc(db, 'staffProofs', staffNonceId), {
          staffId,
          proof: staffToken,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('insufficient')
        ) {
          throw new Error('Invalid username or password, or account is suspended.');
        }
        throw new Error('Unable to verify manager login. Please check your connection.');
      }

      const staffRef = doc(db, 'staffAccounts', staffId);
      const staffSnap = await getDoc(staffRef);
      if (!staffSnap.exists()) {
        throw new Error('Manager account record not found.');
      }
      const staffData = staffSnap.data() as StaffAccount;
      if (!staffData.active || staffData.status !== 'active') {
        throw new Error('This manager account is currently suspended.');
      }

      const loginNonceId = generateProofNonceId();
      const nextLoginCount = (staffData.loginCount || 0) + 1;
      const loginBatch = writeBatch(db);
      loginBatch.set(doc(db, 'staffProofs', loginNonceId), {
        staffId,
        proof: staffToken,
        createdAt: serverTimestamp(),
      });
      loginBatch.update(staffRef, {
        loginCount: nextLoginCount,
        lastLoginAt: serverTimestamp(),
        auditId: loginNonceId,
        updatedAt: serverTimestamp(),
      });
      await loginBatch.commit();

      setAdminRole('manager');
      setActiveStaffAccount({ ...staffData, loginCount: nextLoginCount });
      setAdminProofToken(staffToken);
      setAdminCredentialUsername(staffData.username);
      setAdminUnlocked(true);
      showToast(`Signed in as Manager (${staffData.displayName}).`, 'success');
    },
    [showToast]
  );

  const lockAdminPortal = useCallback(() => {
    setAdminProofToken(null);
    setAdminUnlocked(false);
    setAdminRole('super_admin');
    setActiveStaffAccount(null);
    setStaffAccounts([]);
    setAdminCredentialUsername('');
    showToast('Admin panel locked.', 'info');
  }, [showToast]);

  const updateAdminCredentials = useCallback(
    async (currentPassword: string, newUsername: string, newPassword: string) => {
      if (!adminUnlocked || !adminProofToken || adminRole !== 'super_admin') {
        throw new Error('Only the main administrator can update admin credentials.');
      }
      const cleanUser = newUsername.trim();
      if (cleanUser.length < 3 || cleanUser.length > 60) {
        throw new Error('Username must be between 3 and 60 characters.');
      }
      if (newPassword.length < 4 || newPassword.length > 100) {
        throw new Error('Password must be between 4 and 100 characters.');
      }

      const activeUsername = adminCredentialUsername || cleanUser;
      const currentToken = await deriveAdminProofToken(activeUsername, currentPassword);
      if (!timingSafeEqual(currentToken, adminProofToken)) {
        throw new Error('Current password is incorrect.');
      }

      const nonceId = generateProofNonceId();
      const payload = await createCredentialUpdatePayload(cleanUser, newPassword, nonceId);
      const batch = writeBatch(db);
      batch.set(doc(db, 'adminProofs', nonceId), {
        proof: currentToken,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'adminConfig', 'credentials'), {
        username: payload.username,
        proofHash: payload.proofHash,
        auditId: payload.auditId,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        setAdminProofToken(payload.token);
        setAdminCredentialUsername(payload.username);
        showToast('Admin username and password saved to Firestore.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'adminConfig/credentials');
      }
    },
    [adminUnlocked, adminProofToken, adminRole, adminCredentialUsername, showToast]
  );

  const value: StoreContextValue = {
    user,
    userProfile,
    userAccess,
    userAccessList,
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
    updateUserPostPermission,
    verifyAdminActionPassword,
    adminUnlocked,
    adminRole,
    activeStaffAccount,
    staffAccounts,
    adminCredentialUsername,
    unlockAdminPortal,
    lockAdminPortal,
    updateAdminCredentials,
    createStaffAccount,
    updateStaffPermissions,
    updateStaffPassword,
    setStaffStatus,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
