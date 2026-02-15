import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TeamDetailPage } from '@/pages/TeamDetailPage';
import { BoardPage } from '@/pages/BoardPage';
import { InvitePage } from '@/pages/InvitePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Spinner } from '@/components/ui/Spinner';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/teams/:teamId', element: <TeamDetailPage /> },
      { path: '/teams/:teamId/sprints/:sprintId/board', element: <BoardPage /> },
    ],
  },
  { path: '/invite/:token', element: <InvitePage /> },
  { path: '/join/:token', element: <InvitePage /> },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <NotFoundPage /> },
]);
