import { Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoadingSpinner from './components/ui/LoadingSpinner'

// Pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import BookingsPage from './pages/bookings/BookingsPage'
import BookingDetailsPage from './pages/bookings/BookingDetailsPage'
import FieldAvailabilityPage from './pages/fields/FieldAvailabilityPage'
import PaymentStatusPage from './pages/payments/PaymentStatusPage'
import { 
  RegisterPage, 
  CreateBookingPage, 
  ProfilePage, 
  NotFoundPage 
} from './pages/PlaceholderPages'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import UsersManagementPage from './pages/admin/UsersManagementPage'
import FieldsManagementPage from './pages/admin/FieldsManagementPage'
import BookingsManagementPage from './pages/admin/BookingsManagementPage'
import ReportsRevenuePage from './pages/admin/ReportsRevenuePage'
import ReportsAnalyticsPage from './pages/admin/ReportsAnalyticsPage'

function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      {/* Protected Routes */}
      <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/:id" element={<BookingDetailsPage />} />
        <Route path="bookings/new" element={<CreateBookingPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="availability" element={<FieldAvailabilityPage />} />
        <Route path="payments/status" element={<PaymentStatusPage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Layout /></ProtectedRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="bookings" element={<BookingsManagementPage />} />
        <Route path="fields" element={<FieldsManagementPage />} />
        <Route path="users" element={<UsersManagementPage />} />
        <Route path="reports/revenue" element={<ReportsRevenuePage />} />
        <Route path="reports/analytics" element={<ReportsAnalyticsPage />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App