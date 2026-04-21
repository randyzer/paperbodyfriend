import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function parseStoredHash(storedHash: string) {
  const [algorithm, salt, derivedKey] = storedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    typeof salt !== 'string' ||
    salt.length === 0 ||
    typeof derivedKey !== 'string' ||
    derivedKey.length === 0
  ) {
    return null;
  }

  return { salt, derivedKey };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS,
  );

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);

  if (!parsed) {
    return false;
  }

  const storedDerivedKey = Buffer.from(parsed.derivedKey, 'hex');
  const candidateDerivedKey = scryptSync(
    password,
    parsed.salt,
    storedDerivedKey.length,
    SCRYPT_OPTIONS,
  );

  if (storedDerivedKey.length !== candidateDerivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedDerivedKey, candidateDerivedKey);
}
