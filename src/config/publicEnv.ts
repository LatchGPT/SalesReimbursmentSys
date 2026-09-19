function publicBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

export const publicEnv = Object.freeze({
  enableDemoLogin: publicBoolean(
    'NEXT_PUBLIC_ENABLE_DEMO_LOGIN',
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN,
    false,
  ),
  enableAllClaimTypes: publicBoolean(
    'NEXT_PUBLIC_ENABLE_ALL_CLAIM_TYPES',
    process.env.NEXT_PUBLIC_ENABLE_ALL_CLAIM_TYPES,
    false,
  ),
});
