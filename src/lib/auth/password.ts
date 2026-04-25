import "server-only";

import { compare, hash } from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HASH_ROUNDS = 12;

export async function hashPassword(password: string) {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
