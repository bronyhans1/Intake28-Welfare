/**
 * Tracks which UI action is currently in flight so only that control spins.
 */
export type PendingAction =
  | { type: string; id?: string }
  | null;

export function isPendingAction(
  pending: PendingAction,
  type: string,
  id?: string,
): boolean {
  if (!pending || pending.type !== type) return false;
  if (id === undefined) return true;
  return pending.id === id;
}

export function isAnyPending(pending: PendingAction): boolean {
  return pending != null;
}
