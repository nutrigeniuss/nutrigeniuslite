import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AwaitingAccessPage from '@/pages/AwaitingAccessPage';
import CalculatorPage from '@/pages/CalculatorPage';
import AdminAccessPage from '@/pages/AdminAccessPage';
import DietCreator from '@/pages/DietCreator';
import ExchangeDietCreator from '@/pages/ExchangeDietCreator';
import FoodsCatalogPage from '@/pages/FoodsCatalogPage';
import MyFoods from '@/pages/MyFoods';
import { Toaster } from '@/components/ui/toaster';

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
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<Protected><CalculatorPage /></Protected>} />
          <Route path="/MyFoods" element={<Protected><MyFoods /></Protected>} />
          <Route path="/alimentos" element={<Navigate to="/MyFoods" replace />} />
          <Route path="/admin" element={<AdminOnly><AdminAccessPage /></AdminOnly>} />
          <Route path="/admin/alimentos" element={<AdminOnly><FoodsCatalogPage /></AdminOnly>} />
          <Route path="/DietCreator" element={<Protected><DietCreator /></Protected>} />
          <Route path="/ExchangeDietCreator" element={<Protected><ExchangeDietCreator /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
