export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function deriveAdminProofToken(
  username: string,
  password: string
): Promise<string> {
  const normalizedUser = username.trim().toLowerCase();
  return sha256Hex(`${normalizedUser}:${password}:akib_admin_proof_v1`);
}

export function generateProofNonceId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return `prf_${Date.now().toString(36)}_${bytesToHex(buf)}`;
}

export async function createCredentialUpdatePayload(
  newUsername: string,
  newPassword: string,
  auditId: string
): Promise<{
  username: string;
  token: string;
  proofHash: string;
  auditId: string;
}> {
  const cleanUser = newUsername.trim();
  const token = await deriveAdminProofToken(cleanUser, newPassword);
  const proofHash = await sha256Hex(token);
  return {
    username: cleanUser,
    token,
    proofHash,
    auditId,
  };
}

export async function deriveStaffProofToken(
  staffId: string,
  password: string
): Promise<string> {
  const normalized = staffId.trim().toLowerCase();
  return sha256Hex(`${normalized}:${password}:akib_staff_proof_v1`);
}

export async function createStaffCredentialPayload(
  username: string,
  password: string
): Promise<{
  staffId: string;
  username: string;
  token: string;
  proofHash: string;
}> {
  const cleanUsername = username.trim();
  const staffId = cleanUsername.toLowerCase();
  const token = await deriveStaffProofToken(staffId, password);
  const proofHash = await sha256Hex(token);
  return {
    staffId,
    username: cleanUsername,
    token,
    proofHash,
  };
}
