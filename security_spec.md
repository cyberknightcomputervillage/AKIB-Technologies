# Security Specification & Payload-First TDD — AKIB Technologies

## 1. Data Invariants

1. **Identity & Role Integrity**:
   - No client can self-assign admin privileges via `/users/{userId}` or `/admins/{adminId}`.
   - Admin checks strictly require `request.auth != null && request.auth.token.email_verified == true` and either matching the bootstrapped owner email (`saikatcomputervillage@gmail.com`) or an existing `/admins/{uid}` document.
2. **PII Isolation**:
   - Customer profiles (`/users/{userId}`) and orders (`/orders/{orderId}`) contain PII (email, phone, street address).
   - Non-admin users can only `get` or `list` their own `/users/{uid}` and `/orders` where `resource.data.userId == request.auth.uid`. Blanket `list` queries are rejected at the rule layer.
3. **Inventory & Order Atomicity**:
   - Only admins can create, edit metadata, or delete `/products/{productId}`.
   - Verified customers may only decrement `stock` (and increment `soldCount` by the exact deducted delta) on an `active` product inside an atomic Firestore transaction that simultaneously creates `/orders/{orderId}` (`existsAfter` + `getAfter` check with `userId == request.auth.uid` and `createdAt == request.time`).
   - Stock can never drop below `0` and cannot be increased by a non-admin.
4. **Order Lifecycle & Terminal State Locking**:
   - Orders must always be created with `status == 'pending'`, `userId == request.auth.uid`, and `createdAt == request.time`.
   - Customers may only transition their own `pending` order to `cancelled`. Terminal states (`delivered`, `cancelled`) cannot be modified by non-admins.
5. **Payload & URL Hardening**:
   - Every string field enforces strict `.size()` bounds.
   - Document IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars).
   - Product `imageUrl` must match `^(https?://|/src/assets/images/).+$` to block `javascript:` or `data:` XSS vectors.
   - No shadow/ghost fields allowed on create (`keys().hasOnly(...)`) or update (`affectedKeys().hasOnly(...)`).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Collection | Expected Result |
| :--- | :--- | :--- | :--- |
| 1 | **Shadow Field Injection**: Create user profile with extra `isAdmin: true` field | `/users/{uid}` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Spoofing**: Admin request with `email: 'saikatcomputervillage@gmail.com'` and `email_verified: false` | `/products/{id}` | `PERMISSION_DENIED` |
| 3 | **Cross-User PII Read**: Authenticated customer reads `/users/{otherUid}` or `/orders/{otherOrderId}` | `/users/{otherUid}` | `PERMISSION_DENIED` |
| 4 | **Blanket Order List Scraping**: Customer issues `list` on `/orders` without `userId == auth.uid` filter | `/orders` | `PERMISSION_DENIED` |
| 5 | **Self-Assigned Admin**: Non-admin attempts to create `/admins/{uid}` | `/admins/{uid}` | `PERMISSION_DENIED` |
| 6 | **Orphan Stock Tampering**: Customer decrements `stock` on `/products/{id}` without creating an order in the same transaction | `/products/{id}` | `PERMISSION_DENIED` |
| 7 | **Negative / Inflated Stock Attack**: Customer sets `stock: -5` or increases `stock: 999` during checkout | `/products/{id}` | `PERMISSION_DENIED` |
| 8 | **Order Status Bypass**: Customer creates order with `status: 'delivered'` or `totalAmount: 0` | `/orders/{id}` | `PERMISSION_DENIED` |
| 9 | **Terminal State Mutation**: Customer re-opens a `cancelled` or `delivered` order back to `pending` | `/orders/{id}` | `PERMISSION_DENIED` |
| 10 | **XSS Image URL Injection**: Admin/attacker writes `imageUrl: 'javascript:alert(1)'` | `/products/{id}` | `PERMISSION_DENIED` |
| 11 | **ID Poisoning**: Write document with 500-char or slash-injected ID | `/products/{badId}` | `PERMISSION_DENIED` |
| 12 | **Timestamp Forgery**: Create order or user with backdated client `createdAt` (`!= request.time`) | `/orders/{id}` | `PERMISSION_DENIED` |
