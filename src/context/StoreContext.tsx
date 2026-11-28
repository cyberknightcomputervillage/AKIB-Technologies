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
  ErpBranch,
  ErpCustomer,
  ErpModel,
  ErpPurchase,
  ErpPurchaseItem,
  ErpReturn,
  ErpSale,
  ErpSaleItem,
  ErpSerial,
  ErpVendor,
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
  erpBranches: ErpBranch[];
  erpVendors: ErpVendor[];
  erpCustomers: ErpCustomer[];
  erpModels: ErpModel[];
  erpSerials: ErpSerial[];
  erpPurchases: ErpPurchase[];
  erpSales: ErpSale[];
  erpReturns: ErpReturn[];
  saveErpBranch: (
    input: { name: string; location: string; phone: string; status?: 'active' | 'archived' },
    existingId: string | undefined,
    adminPassword: string
  ) => Promise<void>;
  saveErpVendor: (
    input: {
      name: string;
      company: string;
      phone: string;
      email: string;
      address: string;
      notes: string;
      status?: 'active' | 'archived';
    },
    existingId: string | undefined,
    adminPassword: string
  ) => Promise<void>;
  saveErpCustomer: (
    input: {
      name: string;
      company: string;
      phone: string;
      email: string;
      address: string;
      city: string;
      notes: string;
      status?: 'active' | 'archived';
    },
    existingId: string | undefined,
    adminPassword: string
  ) => Promise<void>;
  saveErpModel: (
    input: {
      brand: string;
      modelName: string;
      productName: string;
      category: string;
      defaultBuyPrice: number;
      defaultSellPrice: number;
      warranty: string;
      status?: 'active' | 'archived';
    },
    existingId: string | undefined,
    adminPassword: string
  ) => Promise<void>;
  createErpPurchase: (
    input: {
      invoiceNumber: string;
      vendorId: string;
      branchId: string;
      notes: string;
      items: { modelId: string; unitCost: number; serialNumbers: string[] }[];
    },
    adminPassword: string
  ) => Promise<void>;
  createErpPurchaseReturn: (
    input: { serialId: string; reason: string },
    adminPassword: string
  ) => Promise<void>;
  createErpSale: (
    input: {
      invoiceNumber: string;
      customerId: string;
      branchId: string;
      salespersonId: string;
      notes: string;
      items: { serialId: string; unitPrice: number }[];
    },
    adminPassword: string
  ) => Promise<void>;
  createErpSalesReturn: (
    input: { serialId: string; reason: string },
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

  const [erpBranches, setErpBranches] = useState<ErpBranch[]>([]);
  const [erpVendors, setErpVendors] = useState<ErpVendor[]>([]);
  const [erpCustomers, setErpCustomers] = useState<ErpCustomer[]>([]);
  const [erpModels, setErpModels] = useState<ErpModel[]>([]);
  const [erpSerials, setErpSerials] = useState<ErpSerial[]>([]);
  const [erpPurchases, setErpPurchases] = useState<ErpPurchase[]>([]);
  const [erpSales, setErpSales] = useState<ErpSale[]>([]);
  const [erpReturns, setErpReturns] = useState<ErpReturn[]>([]);

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

  // 5. Manager Accounts list (Super Admin sees active/suspended; Managers see active staff for ERP salesperson dropdown)
  useEffect(() => {
    if (!authReady || !adminUnlocked) {
      setStaffAccounts([]);
      return;
    }
    const staffQuery =
      adminRole === 'super_admin'
        ? query(collection(db, 'staffAccounts'), where('status', 'in', ['active', 'suspended']))
        : query(collection(db, 'staffAccounts'), where('status', '==', 'active'));
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

  // 5b. ERP Real-Time Listeners (when /admin is unlocked)
  useEffect(() => {
    if (!authReady || !adminUnlocked) {
      setErpBranches([]);
      setErpVendors([]);
      setErpCustomers([]);
      setErpModels([]);
      setErpSerials([]);
      setErpPurchases([]);
      setErpSales([]);
      setErpReturns([]);
      return;
    }

    const unsubs = [
      onSnapshot(
        query(collection(db, 'erpBranches'), where('status', 'in', ['active', 'archived'])),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpBranch);
          list.sort((a, b) => a.name.localeCompare(b.name));
          setErpBranches(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpBranches')
      ),
      onSnapshot(
        query(collection(db, 'erpVendors'), where('status', 'in', ['active', 'archived'])),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpVendor);
          list.sort((a, b) => a.name.localeCompare(b.name));
          setErpVendors(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpVendors')
      ),
      onSnapshot(
        query(collection(db, 'erpCustomers'), where('status', 'in', ['active', 'archived'])),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpCustomer);
          list.sort((a, b) => a.name.localeCompare(b.name));
          setErpCustomers(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpCustomers')
      ),
      onSnapshot(
        query(collection(db, 'erpModels'), where('status', 'in', ['active', 'archived'])),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpModel);
          list.sort((a, b) => a.productName.localeCompare(b.productName));
          setErpModels(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpModels')
      ),
      onSnapshot(
        query(
          collection(db, 'erpSerials'),
          where('status', 'in', ['in_stock', 'sold', 'purchase_returned'])
        ),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpSerial);
          list.sort((a, b) => {
            const tA = a.updatedAt?.toMillis?.() ?? 0;
            const tB = b.updatedAt?.toMillis?.() ?? 0;
            return tB - tA;
          });
          setErpSerials(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpSerials')
      ),
      onSnapshot(
        query(
          collection(db, 'erpPurchases'),
          where('status', 'in', ['completed', 'partial_return', 'returned'])
        ),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpPurchase);
          list.sort((a, b) => b.purchaseDateIso.localeCompare(a.purchaseDateIso));
          setErpPurchases(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpPurchases')
      ),
      onSnapshot(
        query(
          collection(db, 'erpSales'),
          where('status', 'in', ['completed', 'partial_return', 'returned'])
        ),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpSale);
          list.sort((a, b) => b.saleDateIso.localeCompare(a.saleDateIso));
          setErpSales(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpSales')
      ),
      onSnapshot(
        query(collection(db, 'erpReturns'), where('status', '==', 'completed')),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ErpReturn);
          list.sort((a, b) => b.returnDateIso.localeCompare(a.returnDateIso));
          setErpReturns(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'erpReturns')
      ),
    ];

    return () => {
      for (const u of unsubs) u();
    };
  }, [authReady, adminUnlocked]);

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

  // ---------------------------------------------------------
  // ERP System Mutations
  // ---------------------------------------------------------
  const buildErpProof = useCallback(
    (batch: ReturnType<typeof writeBatch>, proofToken: string): { auditId: string; staffId?: string } => {
      const auditId = generateProofNonceId();
      if (adminRole === 'manager' && activeStaffAccount) {
        batch.set(doc(db, 'staffProofs', auditId), {
          staffId: activeStaffAccount.staffId,
          proof: proofToken,
          createdAt: serverTimestamp(),
        });
        return { auditId, staffId: activeStaffAccount.staffId };
      }
      batch.set(doc(db, 'adminProofs', auditId), {
        proof: proofToken,
        createdAt: serverTimestamp(),
      });
      return { auditId };
    },
    [adminRole, activeStaffAccount]
  );

  const assertErpSetupPermission = useCallback(() => {
    if (adminRole === 'manager') {
      if (!activeStaffAccount || (!activeStaffAccount.canAddProduct && !activeStaffAccount.canEditProduct)) {
        throw new Error('Manager permission "Add Products" or "Edit Products & Stock" is required.');
      }
    }
  }, [adminRole, activeStaffAccount]);

  const assertErpOrderPermission = useCallback(() => {
    if (adminRole === 'manager') {
      if (!activeStaffAccount || !activeStaffAccount.canManageOrders) {
        throw new Error('Manager permission "Manage Orders" is required.');
      }
    }
  }, [adminRole, activeStaffAccount]);

  const assertErpAnyPermission = useCallback(() => {
    if (adminRole === 'manager') {
      if (
        !activeStaffAccount ||
        (!activeStaffAccount.canAddProduct &&
          !activeStaffAccount.canEditProduct &&
          !activeStaffAccount.canManageOrders)
      ) {
        throw new Error('Insufficient manager permissions for this ERP action.');
      }
    }
  }, [adminRole, activeStaffAccount]);

  const makeErpId = (prefix: string, label: string) => {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28);
    return `${prefix}_${slug || 'item'}_${Date.now().toString(36).slice(-5)}`.slice(0, 58);
  };

  const getLocalMonth = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  };

  const saveErpBranch = useCallback(
    async (
      input: { name: string; location: string; phone: string; status?: 'active' | 'archived' },
      existingId: string | undefined,
      adminPassword: string
    ) => {
      assertErpSetupPermission();
      const name = sanitizeText(input.name, 80);
      const location = sanitizeText(input.location, 120);
      const phone = sanitizeText(input.phone, 40);
      if (name.length < 2) throw new Error('Branch name must be at least 2 characters.');
      if (location.length < 2) throw new Error('Branch location must be at least 2 characters.');

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);
      const branchId = existingId || makeErpId('br', name);
      const ref = doc(db, 'erpBranches', branchId);

      if (existingId) {
        batch.update(ref, {
          name,
          location,
          phone,
          status: input.status || 'active',
          ...meta,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          branchId,
          name,
          location,
          phone,
          status: input.status || 'active',
          ...meta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        showToast(existingId ? `Updated branch "${name}".` : `Added branch "${name}".`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpBranches/${branchId}`);
      }
    },
    [assertErpSetupPermission, verifyAdminActionPassword, buildErpProof, showToast]
  );

  const saveErpVendor = useCallback(
    async (
      input: {
        name: string;
        company: string;
        phone: string;
        email: string;
        address: string;
        notes: string;
        status?: 'active' | 'archived';
      },
      existingId: string | undefined,
      adminPassword: string
    ) => {
      assertErpSetupPermission();
      const name = sanitizeText(input.name, 100);
      if (name.length < 2) throw new Error('Vendor name must be at least 2 characters.');

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);
      const vendorId = existingId || makeErpId('vnd', name);
      const ref = doc(db, 'erpVendors', vendorId);

      const fields = {
        name,
        company: sanitizeText(input.company, 100),
        phone: sanitizeText(input.phone, 40),
        email: sanitizeText(input.email, 160),
        address: sanitizeText(input.address, 240),
        notes: sanitizeText(input.notes, 300),
        status: input.status || 'active',
      };

      if (existingId) {
        batch.update(ref, {
          ...fields,
          ...meta,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          vendorId,
          ...fields,
          ...meta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        showToast(existingId ? `Updated vendor "${name}".` : `Added vendor "${name}".`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpVendors/${vendorId}`);
      }
    },
    [assertErpSetupPermission, verifyAdminActionPassword, buildErpProof, showToast]
  );

  const saveErpCustomer = useCallback(
    async (
      input: {
        name: string;
        company: string;
        phone: string;
        email: string;
        address: string;
        city: string;
        notes: string;
        status?: 'active' | 'archived';
      },
      existingId: string | undefined,
      adminPassword: string
    ) => {
      assertErpAnyPermission();
      const name = sanitizeText(input.name, 100);
      if (name.length < 2) throw new Error('Customer name must be at least 2 characters.');

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);
      const customerId = existingId || makeErpId('cus', name);
      const ref = doc(db, 'erpCustomers', customerId);

      const fields = {
        name,
        company: sanitizeText(input.company, 100),
        phone: sanitizeText(input.phone, 40),
        email: sanitizeText(input.email, 160),
        address: sanitizeText(input.address, 240),
        city: sanitizeText(input.city, 80),
        notes: sanitizeText(input.notes, 300),
        status: input.status || 'active',
      };

      if (existingId) {
        batch.update(ref, {
          ...fields,
          ...meta,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          customerId,
          ...fields,
          ...meta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        showToast(
          existingId ? `Updated customer "${name}".` : `Added customer "${name}".`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpCustomers/${customerId}`);
      }
    },
    [assertErpAnyPermission, verifyAdminActionPassword, buildErpProof, showToast]
  );

  const saveErpModel = useCallback(
    async (
      input: {
        brand: string;
        modelName: string;
        productName: string;
        category: string;
        defaultBuyPrice: number;
        defaultSellPrice: number;
        warranty: string;
        status?: 'active' | 'archived';
      },
      existingId: string | undefined,
      adminPassword: string
    ) => {
      assertErpSetupPermission();
      const brand = sanitizeText(input.brand, 60);
      const modelName = sanitizeText(input.modelName, 80);
      const productName = sanitizeText(input.productName, 160);
      const category = sanitizeText(input.category, 40) || 'Laptops';
      const defaultBuyPrice = Math.max(0, Number(input.defaultBuyPrice || 0));
      const defaultSellPrice = Math.max(0, Number(input.defaultSellPrice || 0));
      const warranty = sanitizeText(input.warranty, 80);

      if (brand.length < 1) throw new Error('Brand is required.');
      if (modelName.length < 1) throw new Error('Model code/name is required.');
      if (productName.length < 2) throw new Error('Product name must be at least 2 characters.');

      if (!existingId) {
        const dup = erpModels.find(
          (m) =>
            m.status === 'active' &&
            m.brand.toLowerCase() === brand.toLowerCase() &&
            m.modelName.toLowerCase() === modelName.toLowerCase()
        );
        if (dup) {
          throw new Error(
            `Model "${brand} ${modelName}" already exists under "${dup.productName}". Purchase into that model so stock consolidates under one name.`
          );
        }
      }

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);
      const modelId = existingId || makeErpId('mod', `${brand}-${modelName}`);
      const ref = doc(db, 'erpModels', modelId);

      const fields = {
        brand,
        modelName,
        productName,
        category,
        defaultBuyPrice,
        defaultSellPrice,
        warranty,
        status: input.status || 'active',
      };

      if (existingId) {
        batch.update(ref, {
          ...fields,
          ...meta,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          modelId,
          ...fields,
          ...meta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        showToast(
          existingId
            ? `Updated setup model "${productName}".`
            : `Added setup model "${productName}".`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpModels/${modelId}`);
      }
    },
    [assertErpSetupPermission, erpModels, verifyAdminActionPassword, buildErpProof, showToast]
  );

  const createErpPurchase = useCallback(
    async (
      input: {
        invoiceNumber: string;
        vendorId: string;
        branchId: string;
        notes: string;
        items: { modelId: string; unitCost: number; serialNumbers: string[] }[];
      },
      adminPassword: string
    ) => {
      assertErpSetupPermission();
      const invoiceNumber = sanitizeText(input.invoiceNumber, 60);
      if (invoiceNumber.length < 2) throw new Error('Purchase invoice number is required.');

      const vendor = erpVendors.find((v) => v.vendorId === input.vendorId && v.status === 'active');
      if (!vendor) throw new Error('Select a valid active Vendor from Setup.');
      const branch = erpBranches.find((b) => b.branchId === input.branchId && b.status === 'active');
      if (!branch) throw new Error('Select a valid active Branch from Setup.');
      if (!input.items || input.items.length === 0) {
        throw new Error('Add at least one model and serial number to purchase.');
      }

      const existingSerialSet = new Set(erpSerials.map((s) => s.serialNumber.trim().toLowerCase()));
      const existingSerialIdSet = new Set(erpSerials.map((s) => s.serialId));
      const seenInBatch = new Set<string>();

      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const purchaseId = `pur_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const operatorName =
        adminRole === 'manager' && activeStaffAccount
          ? activeStaffAccount.displayName
          : adminCredentialUsername || 'Admin';
      const notes = sanitizeText(input.notes, 300);

      const purchaseItems: ErpPurchaseItem[] = [];
      const serialDocs: Omit<ErpSerial, 'createdAt' | 'updatedAt'>[] = [];
      let totalAmount = 0;
      let totalUnits = 0;

      for (const line of input.items) {
        const model = erpModels.find((m) => m.modelId === line.modelId && m.status === 'active');
        if (!model) throw new Error('One of the selected models is invalid or archived.');
        const unitCost = Math.max(0, Number(line.unitCost || 0));
        const cleanSerials = line.serialNumbers
          .map((s) => sanitizeText(s, 80))
          .filter((s) => s.length > 0);
        if (cleanSerials.length === 0) {
          throw new Error(`Enter at least one serial number for "${model.productName}".`);
        }

        for (const sn of cleanSerials) {
          if (sn.length < 2) {
            throw new Error(`Serial "${sn}" must be at least 2 characters.`);
          }
          const lower = sn.toLowerCase();
          if (seenInBatch.has(lower)) {
            throw new Error(`Duplicate serial number "${sn}" inside this purchase.`);
          }
          if (existingSerialSet.has(lower)) {
            throw new Error(`Serial number "${sn}" already exists in ERP records.`);
          }
          const serialIdSlug = sn
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 68);
          const serialId =
            serialIdSlug.length >= 2 && !existingSerialIdSet.has(serialIdSlug)
              ? serialIdSlug
              : `sn_${serialIdSlug || 'unit'}_${Math.random().toString(36).slice(2, 6)}`;
          if (existingSerialIdSet.has(serialId)) {
            throw new Error(`Serial ID collision for "${sn}". Please use a distinct serial.`);
          }
          seenInBatch.add(lower);
          existingSerialIdSet.add(serialId);

          serialDocs.push({
            serialId,
            serialNumber: sn,
            modelId: model.modelId,
            productName: model.productName,
            brand: model.brand,
            modelName: model.modelName,
            branchId: branch.branchId,
            branchName: branch.name,
            vendorId: vendor.vendorId,
            vendorName: vendor.name,
            purchaseId,
            purchaseInvoice: invoiceNumber,
            purchaseCost: unitCost,
            salePrice: model.defaultSellPrice,
            status: 'in_stock',
            lastSaleId: 'none',
            lastSaleInvoice: 'none',
            lastCustomerId: 'none',
            lastCustomerName: 'none',
            salespersonId: 'none',
            salespersonName: 'none',
            purchasedAtIso: nowIso,
            history: [
              {
                type: 'PURCHASE',
                timestampIso: nowIso,
                timestampMs: nowMs,
                refId: purchaseId,
                invoiceNumber,
                partyName: vendor.name,
                branchName: branch.name,
                salespersonName: operatorName,
                amount: unitCost,
                profit: 0,
                notes: notes || `Purchased from ${vendor.name} into ${branch.name}`,
              },
            ],
          });
        }

        const lineTotal = unitCost * cleanSerials.length;
        totalAmount += lineTotal;
        totalUnits += cleanSerials.length;
        purchaseItems.push({
          modelId: model.modelId,
          productName: model.productName,
          brand: model.brand,
          modelName: model.modelName,
          quantity: cleanSerials.length,
          unitCost,
          lineTotal,
          serialNumbers: cleanSerials,
        });
      }

      const proofToken = await verifyAdminActionPassword(adminPassword);

      // Chunk writes so each batch stays well below Firestore's 20-lookup per-batch rules cap
      try {
        const firstBatch = writeBatch(db);
        const firstMeta = buildErpProof(firstBatch, proofToken);
        firstBatch.set(doc(db, 'erpPurchases', purchaseId), {
          purchaseId,
          invoiceNumber,
          vendorId: vendor.vendorId,
          vendorName: vendor.name,
          branchId: branch.branchId,
          branchName: branch.name,
          items: purchaseItems,
          totalAmount,
          totalUnits,
          notes,
          status: 'completed',
          createdByName: sanitizeText(operatorName, 80) || 'Admin',
          purchaseDateIso: nowIso,
          ...firstMeta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const firstChunk = serialDocs.slice(0, 2);
        for (const sDoc of firstChunk) {
          firstBatch.set(doc(db, 'erpSerials', sDoc.serialId), {
            ...sDoc,
            ...firstMeta,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await firstBatch.commit();

        for (let idx = 2; idx < serialDocs.length; idx += 3) {
          const chunk = serialDocs.slice(idx, idx + 3);
          const chunkBatch = writeBatch(db);
          const chunkMeta = buildErpProof(chunkBatch, proofToken);
          for (const sDoc of chunk) {
            chunkBatch.set(doc(db, 'erpSerials', sDoc.serialId), {
              ...sDoc,
              ...chunkMeta,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await chunkBatch.commit();
        }

        showToast(
          `Purchase #${invoiceNumber} recorded: +${totalUnits} unit(s) added to ${branch.name} stock.`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpPurchases/${purchaseId}`);
      }
    },
    [
      assertErpSetupPermission,
      erpVendors,
      erpBranches,
      erpModels,
      erpSerials,
      adminRole,
      activeStaffAccount,
      adminCredentialUsername,
      verifyAdminActionPassword,
      buildErpProof,
      showToast,
    ]
  );

  const createErpPurchaseReturn = useCallback(
    async (input: { serialId: string; reason: string }, adminPassword: string) => {
      assertErpAnyPermission();
      const serial = erpSerials.find((s) => s.serialId === input.serialId);
      if (!serial) throw new Error('Serial record not found.');
      if (serial.status !== 'in_stock') {
        throw new Error('Only currently In-Stock serials can be Purchase Returned to the vendor.');
      }

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const returnId = `pret_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const returnNumber = `PR-${nowMs.toString().slice(-6)}`;
      const reason = sanitizeText(input.reason, 300) || 'Returned to vendor';
      const operatorName =
        adminRole === 'manager' && activeStaffAccount
          ? activeStaffAccount.displayName
          : adminCredentialUsername || 'Admin';

      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);

      const nextHistory = [
        ...(serial.history || []).slice(0, 48),
        {
          type: 'PURCHASE_RETURN' as const,
          timestampIso: nowIso,
          timestampMs: nowMs,
          refId: returnId,
          invoiceNumber: returnNumber,
          partyName: serial.vendorName,
          branchName: serial.branchName,
          salespersonName: operatorName,
          amount: serial.purchaseCost,
          profit: 0,
          notes: reason,
        },
      ];

      batch.update(doc(db, 'erpSerials', serial.serialId), {
        status: 'purchase_returned',
        history: nextHistory,
        ...meta,
        updatedAt: serverTimestamp(),
      });

      const purchase = erpPurchases.find((p) => p.purchaseId === serial.purchaseId);
      if (purchase) {
        const siblingSerials = erpSerials.filter((s) => s.purchaseId === purchase.purchaseId);
        const remainingInBatch = siblingSerials.filter(
          (s) => s.serialId !== serial.serialId && s.status !== 'purchase_returned'
        );
        batch.update(doc(db, 'erpPurchases', purchase.purchaseId), {
          status: remainingInBatch.length === 0 ? 'returned' : 'partial_return',
          ...meta,
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(doc(db, 'erpReturns', returnId), {
        returnId,
        returnNumber,
        returnType: 'purchase_return',
        serialId: serial.serialId,
        serialNumber: serial.serialNumber,
        modelId: serial.modelId,
        productName: serial.productName,
        branchId: serial.branchId,
        branchName: serial.branchName,
        partyId: serial.vendorId,
        partyName: serial.vendorName,
        refInvoiceNumber: serial.purchaseInvoice,
        amount: serial.purchaseCost,
        profitAdjustment: 0,
        salespersonId: adminRole === 'manager' && activeStaffAccount ? activeStaffAccount.staffId : 'admin',
        salespersonName: operatorName,
        reason,
        returnMonth: getLocalMonth(now),
        returnDateIso: nowIso,
        status: 'completed',
        ...meta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast(
          `Purchase Return ${returnNumber} completed for serial ${serial.serialNumber}.`,
          'info'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpReturns/${returnId}`);
      }
    },
    [
      assertErpAnyPermission,
      erpSerials,
      erpPurchases,
      adminRole,
      activeStaffAccount,
      adminCredentialUsername,
      verifyAdminActionPassword,
      buildErpProof,
      showToast,
    ]
  );

  const createErpSale = useCallback(
    async (
      input: {
        invoiceNumber: string;
        customerId: string;
        branchId: string;
        salespersonId: string;
        notes: string;
        items: { serialId: string; unitPrice: number }[];
      },
      adminPassword: string
    ) => {
      assertErpOrderPermission();
      const invoiceNumber = sanitizeText(input.invoiceNumber, 60);
      if (invoiceNumber.length < 2) throw new Error('Sales invoice number is required.');

      const customer = erpCustomers.find(
        (c) => c.customerId === input.customerId && c.status === 'active'
      );
      if (!customer) throw new Error('Select a valid active Customer from Setup.');

      const branch = erpBranches.find((b) => b.branchId === input.branchId && b.status === 'active');
      if (!branch) throw new Error('Select a valid active Branch from Setup.');

      const salesperson = staffAccounts.find(
        (s) => s.staffId === input.salespersonId && s.status === 'active'
      );
      if (!salesperson) {
        throw new Error(
          'Select a valid active Manager as Sales Person (must come from stored Manager accounts).'
        );
      }

      if (!input.items || input.items.length === 0) {
        throw new Error('Select at least one in-stock serial to sell.');
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const saleId = `sal_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const notes = sanitizeText(input.notes, 300);

      const seenSerials = new Set<string>();
      const saleItems: ErpSaleItem[] = [];
      const serialUpdates: { serial: ErpSerial; unitPrice: number; profit: number }[] = [];
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;

      for (const line of input.items) {
        if (seenSerials.has(line.serialId)) {
          throw new Error('Duplicate serial selected on the same sales invoice.');
        }
        seenSerials.add(line.serialId);

        const serial = erpSerials.find((s) => s.serialId === line.serialId);
        if (!serial) throw new Error('Selected serial number was not found.');
        if (serial.status !== 'in_stock') {
          throw new Error(`Serial "${serial.serialNumber}" is not in stock.`);
        }
        if (serial.branchId !== branch.branchId) {
          throw new Error(
            `Serial "${serial.serialNumber}" is in branch "${serial.branchName}", not "${branch.name}".`
          );
        }

        const unitPrice = Math.max(0, Number(line.unitPrice || 0));
        const unitCost = serial.purchaseCost;
        const profit = unitPrice - unitCost;
        totalRevenue += unitPrice;
        totalCost += unitCost;
        totalProfit += profit;

        saleItems.push({
          serialId: serial.serialId,
          serialNumber: serial.serialNumber,
          modelId: serial.modelId,
          productName: serial.productName,
          brand: serial.brand,
          modelName: serial.modelName,
          unitCost,
          unitPrice,
          profit,
          returned: false,
        });
        serialUpdates.push({ serial, unitPrice, profit });
      }

      const proofToken = await verifyAdminActionPassword(adminPassword);

      try {
        const firstBatch = writeBatch(db);
        const firstMeta = buildErpProof(firstBatch, proofToken);

        firstBatch.set(doc(db, 'erpSales', saleId), {
          saleId,
          invoiceNumber,
          customerId: customer.customerId,
          customerName: customer.name,
          branchId: branch.branchId,
          branchName: branch.name,
          salespersonId: salesperson.staffId,
          salespersonUsername: salesperson.username,
          salespersonName: salesperson.displayName,
          items: saleItems,
          totalRevenue,
          totalCost,
          totalProfit,
          totalUnits: saleItems.length,
          returnedUnits: 0,
          returnedRevenue: 0,
          returnedProfit: 0,
          saleMonth: getLocalMonth(now),
          saleDateIso: nowIso,
          notes,
          status: 'completed',
          ...firstMeta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const buildSerialSalePatch = (
          upd: { serial: ErpSerial; unitPrice: number; profit: number },
          meta: { auditId: string; staffId?: string }
        ) => ({
          salePrice: upd.unitPrice,
          status: 'sold' as const,
          lastSaleId: saleId,
          lastSaleInvoice: invoiceNumber,
          lastCustomerId: customer.customerId,
          lastCustomerName: customer.name,
          salespersonId: salesperson.staffId,
          salespersonName: salesperson.displayName,
          history: [
            ...(upd.serial.history || []).slice(0, 48),
            {
              type: 'SALE' as const,
              timestampIso: nowIso,
              timestampMs: nowMs,
              refId: saleId,
              invoiceNumber,
              partyName: customer.name,
              branchName: branch.name,
              salespersonName: salesperson.displayName,
              amount: upd.unitPrice,
              profit: upd.profit,
              notes: notes || `Sold to ${customer.name} by ${salesperson.displayName}`,
            },
          ],
          ...meta,
          updatedAt: serverTimestamp(),
        });

        for (const upd of serialUpdates.slice(0, 2)) {
          firstBatch.update(
            doc(db, 'erpSerials', upd.serial.serialId),
            buildSerialSalePatch(upd, firstMeta)
          );
        }
        await firstBatch.commit();

        for (let idx = 2; idx < serialUpdates.length; idx += 3) {
          const chunk = serialUpdates.slice(idx, idx + 3);
          const chunkBatch = writeBatch(db);
          const chunkMeta = buildErpProof(chunkBatch, proofToken);
          for (const upd of chunk) {
            chunkBatch.update(
              doc(db, 'erpSerials', upd.serial.serialId),
              buildSerialSalePatch(upd, chunkMeta)
            );
          }
          await chunkBatch.commit();
        }

        showToast(
          `Sale #${invoiceNumber} saved (${saleItems.length} unit(s), Profit ৳${Math.round(totalProfit).toLocaleString()}).`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpSales/${saleId}`);
      }
    },
    [
      assertErpOrderPermission,
      erpCustomers,
      erpBranches,
      staffAccounts,
      erpSerials,
      verifyAdminActionPassword,
      buildErpProof,
      showToast,
    ]
  );

  const createErpSalesReturn = useCallback(
    async (input: { serialId: string; reason: string }, adminPassword: string) => {
      assertErpOrderPermission();
      const serial = erpSerials.find((s) => s.serialId === input.serialId);
      if (!serial) throw new Error('Serial record not found.');
      if (serial.status !== 'sold') {
        throw new Error('Only currently Sold serials can be processed as a Sales Return.');
      }

      const sale = erpSales.find((s) => s.saleId === serial.lastSaleId);
      const saleItem = sale?.items.find((i) => i.serialId === serial.serialId && !i.returned);
      const refundAmount = saleItem ? saleItem.unitPrice : serial.salePrice;
      const reversedProfit = saleItem ? saleItem.profit : serial.salePrice - serial.purchaseCost;

      const proofToken = await verifyAdminActionPassword(adminPassword);
      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const returnId = `sret_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const returnNumber = `SR-${nowMs.toString().slice(-6)}`;
      const reason = sanitizeText(input.reason, 300) || 'Customer sales return (restocked)';
      const operatorName =
        adminRole === 'manager' && activeStaffAccount
          ? activeStaffAccount.displayName
          : adminCredentialUsername || 'Admin';

      const batch = writeBatch(db);
      const meta = buildErpProof(batch, proofToken);

      batch.update(doc(db, 'erpSerials', serial.serialId), {
        status: 'in_stock',
        history: [
          ...(serial.history || []).slice(0, 48),
          {
            type: 'SALES_RETURN' as const,
            timestampIso: nowIso,
            timestampMs: nowMs,
            refId: returnId,
            invoiceNumber: returnNumber,
            partyName: serial.lastCustomerName || 'Customer',
            branchName: serial.branchName,
            salespersonName: serial.salespersonName || operatorName,
            amount: refundAmount,
            profit: -reversedProfit,
            notes: reason,
          },
        ],
        ...meta,
        updatedAt: serverTimestamp(),
      });

      if (sale) {
        const updatedItems = sale.items.map((item) =>
          item.serialId === serial.serialId ? { ...item, returned: true } : item
        );
        const returnedUnits = updatedItems.filter((i) => i.returned).length;
        const returnedRevenue = updatedItems
          .filter((i) => i.returned)
          .reduce((sum, i) => sum + i.unitPrice, 0);
        const returnedProfit = updatedItems
          .filter((i) => i.returned)
          .reduce((sum, i) => sum + i.profit, 0);

        batch.update(doc(db, 'erpSales', sale.saleId), {
          items: updatedItems,
          returnedUnits,
          returnedRevenue,
          returnedProfit,
          status: returnedUnits >= sale.totalUnits ? 'returned' : 'partial_return',
          ...meta,
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(doc(db, 'erpReturns', returnId), {
        returnId,
        returnNumber,
        returnType: 'sales_return',
        serialId: serial.serialId,
        serialNumber: serial.serialNumber,
        modelId: serial.modelId,
        productName: serial.productName,
        branchId: serial.branchId,
        branchName: serial.branchName,
        partyId: serial.lastCustomerId || 'customer',
        partyName: serial.lastCustomerName || 'Customer',
        refInvoiceNumber: serial.lastSaleInvoice || 'N/A',
        amount: refundAmount,
        profitAdjustment: -reversedProfit,
        salespersonId: serial.salespersonId || 'none',
        salespersonName: serial.salespersonName || operatorName,
        reason,
        returnMonth: getLocalMonth(now),
        returnDateIso: nowIso,
        status: 'completed',
        ...meta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast(
          `Sales Return ${returnNumber} completed: serial ${serial.serialNumber} is back in stock.`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `erpReturns/${returnId}`);
      }
    },
    [
      assertErpOrderPermission,
      erpSerials,
      erpSales,
      adminRole,
      activeStaffAccount,
      adminCredentialUsername,
      verifyAdminActionPassword,
      buildErpProof,
      showToast,
    ]
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
    erpBranches,
    erpVendors,
    erpCustomers,
    erpModels,
    erpSerials,
    erpPurchases,
    erpSales,
    erpReturns,
    saveErpBranch,
    saveErpVendor,
    saveErpCustomer,
    saveErpModel,
    createErpPurchase,
    createErpPurchaseReturn,
    createErpSale,
    createErpSalesReturn,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
