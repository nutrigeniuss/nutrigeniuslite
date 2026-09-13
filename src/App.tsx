import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { FichaProvider } from '@/lib/FichaContext';
import { queryClientInstance } from '@/lib/query-client';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AwaitingAccessPage from '@/pages/AwaitingAccessPage';
import { Toaster } from '@/components/ui/toaster';

const CalculatorPage = lazy(() => import('@/pages/CalculatorPage'));
const AdminAccessPage = lazy(() => import('@/pages/AdminAccessPage'));
const DietCreator = lazy(() => import('@/pages/DietCreator'));
const ExchangeDietCreator = lazy(() => import('@/pages/ExchangeDietCreator'));
const FoodsCatalogPage = lazy(() => import('@/pages/FoodsCatalogPage'));
const MyFoods = lazy(() => import('@/pages/MyFoods'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
      Cargando…
    </div>
  );
}

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

/** Ficha de sesión compartida entre calculadora y editores de dieta. */
function ProtectedFichaLayout() {
  return (
    <Protected>
      <FichaProvider>
        <Outlet />
      </FichaProvider>
    </Protected>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedFichaLayout />}>
              <Route path="/app" element={<CalculatorPage />} />
              <Route path="/DietCreator" element={<DietCreator />} />
              <Route path="/ExchangeDietCreator" element={<ExchangeDietCreator />} />
            </Route>
            <Route path="/MyFoods" element={<Protected><MyFoods /></Protected>} />
            <Route path="/alimentos" element={<Navigate to="/MyFoods" replace />} />
            <Route path="/admin" element={<AdminOnly><AdminAccessPage /></AdminOnly>} />
            <Route path="/admin/alimentos" element={<AdminOnly><FoodsCatalogPage /></AdminOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
