import { useEffect, useState } from 'react';
import { getWSClient } from '@/lib/ws-client';

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>('DISCONNECTED');

  useEffect(() => {
    const ws = getWSClient();
    const handleStateChange = (newState: ConnectionState) => {
      setState(newState);
    };

    ws.onStateChange(handleStateChange);
    setState(ws.getState());

    return () => {
      ws.offStateChange(handleStateChange);
    };
  }, []);

  const colorClass = {
    CONNECTING: 'bg-yellow-400',
    CONNECTED: 'bg-green-500',
    RECONNECTING: 'bg-yellow-500',
    DISCONNECTED: 'bg-red-500',
  }[state];

  const label = {
    CONNECTING: 'Connecting...',
    CONNECTED: 'Connected',
    RECONNECTING: 'Reconnecting...',
    DISCONNECTED: 'Disconnected',
  }[state];

  return (
    <div className="flex items-center gap-2" title={label}>
      <div className={`h-2 w-2 rounded-full ${colorClass}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
