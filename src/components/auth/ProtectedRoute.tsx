import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[]; // Allowed roles
  redirectTo?: string; // Optional custom redirect path for unauthorized access
}

const ProtectedRoute = ({ children, roles, redirectTo }: ProtectedRouteProps) => {
  const { user, loading, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login with the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !hasRole(...roles)) {
    return <Navigate to={redirectTo || '/app'} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;