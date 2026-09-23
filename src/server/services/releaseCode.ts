import * as crypto from 'crypto';
import { Claim } from '../../lib/db/serverTypes';
import {
  RELEASE_CODE_ALPHABET,
  RELEASE_CODE_VALIDITY_DAYS,
} from '../constants';

export function generateReleaseCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += RELEASE_CODE_ALPHABET[bytes[i] % RELEASE_CODE_ALPHABET.length];
  }
  return code;
}

export function releaseCodeExpiryFrom(date: Date): string {
  return new Date(date.getTime() + RELEASE_CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Resets a claim's release-code security state whenever a code is (re)issued. */
export function resetReleaseCodeSecurity(claim: Claim, issuedAt: Date = new Date()) {
  claim.release_code_expires_at = releaseCodeExpiryFrom(issuedAt);
  claim.release_code_attempts = 0;
  claim.release_code_locked_until = undefined;
}

/** Constant-time equality so a wrong guess can't be timed to leak how many characters matched. */
export function timingSafeCodeEquals(input: string, actual: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(actual);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
