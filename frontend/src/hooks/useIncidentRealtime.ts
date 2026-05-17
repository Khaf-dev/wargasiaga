import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseIncidentRealtimeOptions {
  incidentId: string | undefined;
  onResponseAdded: (newResponse: unknown) => void;
  onIncidentUpdated: (newRecord: unknown, oldRecord: unknown | undefined) => void;
}

interface UseIncidentRealtimeReturn {
  connectionStatus: 'idle' | 'subscribing' | 'connected' | 'disconnected' | 'error';
  reconnect: () => void;
}

export const useIncidentRealtime = ({
  incidentId,
  onResponseAdded,
  onIncidentUpdated,
}: UseIncidentRealtimeOptions): UseIncidentRealtimeReturn => {
  const [connectionStatus, setConnectionStatus] = useState<UseIncidentRealtimeReturn['connectionStatus']>('idle');
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Gunakan ref untuk menyimpan callback terbaru tanpa memicu re-subscribe useEffect utama.
  // Ini adalah pattern penting untuk mencegah koneksi ulang setiap kali parent component re-render.
  const onResponseAddedRef = useRef(onResponseAdded);
  const onIncidentUpdatedRef = useRef(onIncidentUpdated);
  useEffect(() => {
    onResponseAddedRef.current = onResponseAdded;
    onIncidentUpdatedRef.current = onIncidentUpdated;
  }, [onResponseAdded, onIncidentUpdated]);

  // Gunakan counter untuk memicu re-subscribe secara manual saat reconnect.
  const [reconnectCounter, setReconnectCounter] = useState(0);
  const reconnect = useCallback(() => setReconnectCounter(c => c + 1), []);

  useEffect(() => {
    // Jangan lakukan apa-apa jika incidentId belum siap.
    if (!incidentId) {
      setConnectionStatus('idle');
      return;
    }

    setConnectionStatus('subscribing');

    // Nama channel harus unik per insiden untuk isolasi data.
    const channel = supabase.channel(`incident:${incidentId}`);
    channelRef.current = channel;

    channel
      .on<RealtimePostgresChangesPayload<any>>(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'incident_responses',
          filter: `incident_id=eq.${incidentId}` 
        },
        (payload) => {
          console.log('[Realtime] Responder baru bergabung:', payload.new);
          onResponseAddedRef.current(payload.new);
        }
      )
      .on<RealtimePostgresChangesPayload<any>>(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'incidents',
          filter: `id=eq.${incidentId}` 
        },
        (payload) => {
          console.log('[Realtime] Status insiden berubah:', payload);
          onIncidentUpdatedRef.current(payload.new, payload.old);
        }
      )
      .subscribe((status, err) => {
        // Update status koneksi berdasarkan feedback dari Supabase.
        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus('connected');
            break;
          case 'CLOSED':
            setConnectionStatus('disconnected');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            setConnectionStatus('error');
            console.error('[Realtime] Channel error:', err);
            break;
        }
      });

    // Cleanup function yang akan dijalankan saat komponen unmount atau incidentId berubah.
    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Unsubscribing from channel: incident:${incidentId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [incidentId, reconnectCounter]); // Re-run effect jika ID insiden berubah atau reconnect dipicu.

  return { connectionStatus, reconnect };
};