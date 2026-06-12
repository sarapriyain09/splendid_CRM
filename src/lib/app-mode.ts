export function isDemoMode(): boolean {
  const value = process.env.DEMO_MODE;
  return value === '1' || value === 'true';
}
