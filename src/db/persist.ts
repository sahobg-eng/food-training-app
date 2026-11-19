export type PersistState = 'persistent' | 'best-effort' | 'unsupported';

/**
 * Ask the browser not to evict our data under storage pressure.
 * Chrome on Android usually grants this to installed PWAs without a prompt.
 */
export async function requestPersistence(): Promise<PersistState> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  if (await storage.persisted()) return 'persistent';
  return (await storage.persist()) ? 'persistent' : 'best-effort';
}
