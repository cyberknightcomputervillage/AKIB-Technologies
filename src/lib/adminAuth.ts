export const INITIAL_ADMIN_SALT = 'akib_bd_2026_salt_9f3a7c1d';
export const INITIAL_ADMIN_HASH =
  '3506d3b5444140678b9aea9e2970dfb3a806ec3566ccecbca0bd018485bc811d';
export const PBKDF2_ITERATIONS = 100000;

export interface StoredAdminCredential {
  username: string;
  passwordHash: string;
  salt: string;
  iterations: number;
  updatedBy: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function derivePasswordHash(
  secret: string,
  salt: string,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export function generateRandomSalt(byteLength = 16): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

export async function verifyInitialCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !password) return false;
  const [userHash, passHash] = await Promise.all([
    derivePasswordHash(cleanUser, INITIAL_ADMIN_SALT, PBKDF2_ITERATIONS),
    derivePasswordHash(password, INITIAL_ADMIN_SALT, PBKDF2_ITERATIONS),
  ]);
  return (
    timingSafeEqual(userHash, INITIAL_ADMIN_HASH) &&
    timingSafeEqual(passHash, INITIAL_ADMIN_HASH)
  );
}

export async function verifyStoredCredentials(
  username: string,
  password: string,
  stored: StoredAdminCredential
): Promise<boolean> {
  const cleanUser = username.trim().toLowerCase();
  const storedUser = stored.username.trim().toLowerCase();
  if (!cleanUser || !password || !timingSafeEqual(cleanUser, storedUser)) {
    return false;
  }
  const derived = await derivePasswordHash(
    password,
    stored.salt,
    stored.iterations || PBKDF2_ITERATIONS
  );
  return timingSafeEqual(derived, stored.passwordHash);
}

export async function createCredentialPayload(
  newUsername: string,
  newPassword: string
): Promise<{
  username: string;
  passwordHash: string;
  salt: string;
  iterations: number;
}> {
  const cleanUser = newUsername.trim();
  const salt = generateRandomSalt(16);
  const passwordHash = await derivePasswordHash(newPassword, salt, PBKDF2_ITERATIONS);
  return {
    username: cleanUser,
    passwordHash,
    salt,
    iterations: PBKDF2_ITERATIONS,
  };
}
