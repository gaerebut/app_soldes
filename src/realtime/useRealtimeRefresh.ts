import { useEffect } from 'react';
import SocketManager from './SocketManager';

/**
 * Subscribes the current screen to one or more socket events and
 * calls `refresh` whenever any of them fires.
 */
export function useRealtimeRefresh(events: string[], refresh: () => void): void {
  useEffect(() => {
    const off = SocketManager.onAny(events, () => {
      refresh();
    });
    return off;
  }, [events.join('|'), refresh]);
}

export default useRealtimeRefresh;
