import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AwaitingAccessPage from '@/pages/AwaitingAccessPage';
import CalculatorPage from '@/pages/CalculatorPage';
import AdminAccessPage from '@/pages/AdminAccessPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { ready, session, canCalculate } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Cargando…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!canCalculate) return <AwaitingAccessPage />;
  return children;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { ready, session, admin, canCalculate } = useAuth();
  if (!ready) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!canCalculate) return <AwaitingAccessPage />;
  if (!admin) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<Protected><CalculatorPage /></Protected>} />
        <Route path="/admin" element={<AdminOnly><AdminAccessPage /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
