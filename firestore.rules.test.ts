/**
 * Security Rule Payload Validation Spec — Dirty Dozen Verification Suite
 * Mirrors the Eight Pillars constraints enforced by firestore.rules and client sanitization.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DIRTY_DOZEN_CASES = [
  {
    id: 1,
    name: 'Shadow Field Injection on /users/{uid}',
    collection: 'users',
    payload: { uid: 'u1', email: 'a@b.com', displayName: 'User', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoofing',
    collection: 'products',
    auth: { uid: 'attacker', email: 'saikatcomputervillage@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Read on /users/{otherUid}',
    collection: 'users',
    targetId: 'otherUid',
    auth: { uid: 'u1', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Blanket Order List Scraping without userId filter',
    collection: 'orders',
    operation: 'list',
    auth: { uid: 'u1', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-Assigned Admin Document Creation',
    collection: 'admins',
    payload: { uid: 'u1', email: 'u1@example.com', grantedBy: 'u1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphan Stock Tampering without Order Creation',
    collection: 'products',
    payload: { stock: 1, soldCount: 99, lastOrderId: 'fake_order' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Negative or Inflated Stock Mutation',
    collection: 'products',
    payload: { stock: -5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Order Status & Price Bypass on Create',
    collection: 'orders',
    payload: { status: 'delivered', totalAmount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal Order State Mutation by Customer',
    collection: 'orders',
    existingStatus: 'cancelled',
    payload: { status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'XSS Image URL Injection',
    collection: 'products',
    payload: { imageUrl: 'javascript:alert(1)' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Document ID Poisoning (>128 chars or invalid chars)',
    collection: 'products',
    targetId: 'bad/id/' + 'a'.repeat(200),
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Backdated Client Timestamp Forgery',
    collection: 'orders',
    payload: { createdAt: new Date('2020-01-01T00:00:00Z') },
    expected: 'PERMISSION_DENIED',
  },
];

// Verify production firestore.rules contains every required security primitive
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
if (fs.existsSync(rulesPath)) {
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const requiredAssertions = [
    "rules_version = '2';",
    'allow read, write: if false;',
    'isValidId(id)',
    'isVerifiedUser()',
    'isValidUser(data)',
    'isValidProduct(data)',
    'isValidOrder(data)',
    'isValidAdminCredential(data)',
    'existsAfter(/databases/$(database)/documents/orders/$(incoming().lastOrderId))',
    'request.auth.token.email_verified == true',
    "^(https?://|/src/assets/images/).+$",
  ];
  for (const assertion of requiredAssertions) {
    if (!rulesText.includes(assertion)) {
      throw new Error(`Security assertion missing from firestore.rules: ${assertion}`);
    }
  }
}
