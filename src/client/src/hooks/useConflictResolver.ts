import { ResolutionPayload } from '../../../core/conflict/types.js';

export interface UseConflictResolverOptions {
  setFlash: (flash: { type: 'success' | 'danger'; message: string }) => void;
  setSelectedConflict: (c: null) => void;
  fetchInventory: () => Promise<void>;
}

export function useConflictResolver({
  setFlash,
  setSelectedConflict,
  fetchInventory,
}: UseConflictResolverOptions) {
  const handleResolveConflict = async (payload: ResolutionPayload) => {
    try {
      const res = await fetch('/api/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setFlash({ type: 'success', message: data.message || 'Conflict resolved successfully' });
        setSelectedConflict(null);
        await fetchInventory();
      } else {
        setFlash({ type: 'danger', message: data.error || 'Failed to resolve conflict' });
      }
    } catch (err: any) {
      setFlash({ type: 'danger', message: err.message || 'Failed to resolve conflict' });
    }
  };

  return { handleResolveConflict };
}
