import { io, Socket } from 'socket.io-client';
import { getServerUrl } from '../api/client';

type Listener = (payload: any) => void;

class SocketManagerClass {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private currentUrl: string | null = null;

  async connect(): Promise<void> {
    const url = await getServerUrl();
    if (this.socket && this.currentUrl === url && this.socket.connected) return;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.currentUrl = url;
    this.socket = io(url, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
      timeout: 5000,
    });

    this.socket.on('connect', () => console.log('🔌 Socket connected'));
    this.socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
    this.socket.on('connect_error', (err) => console.warn('🔌 Socket error:', err.message));

    // Forward server events to subscribers
    ['products:changed', 'checks:changed', 'aisles:changed'].forEach((event) => {
      this.socket!.on(event, (payload) => {
        const subs = this.listeners.get(event);
        if (subs) subs.forEach((l) => l(payload));
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentUrl = null;
    }
  }

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Subscribe to multiple events with the same handler.
   * Returns an unsubscribe function.
   */
  onAny(events: string[], listener: Listener): () => void {
    const offFns = events.map((e) => this.on(e, listener));
    return () => offFns.forEach((off) => off());
  }
}

export const SocketManager = new SocketManagerClass();
export default SocketManager;
