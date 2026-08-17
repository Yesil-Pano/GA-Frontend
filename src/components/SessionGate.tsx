// src/components/SessionGate.tsx

import { Navigate } from 'react-router-dom';
import PageLoading from './PageLoading';
import { useSessionGate } from '../hooks/useSessionGate';

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useSessionGate();

  if (!ready) {
    return <PageLoading />;
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
