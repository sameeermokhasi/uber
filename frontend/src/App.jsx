import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import RiderDashboard from './pages/RiderDashboard'
import DriverDashboard from './pages/DriverDashboard'
import AdminDashboard from './pages/AdminDashboard'
import IntercityRides from './pages/IntercityRides'
import VacationBooking from './pages/VacationBooking'
import BookRide from './pages/BookRide'
import DriverVacationManagement from './pages/DriverVacationManagement'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore()
  
  // Debug logging
  console.log('ProtectedRoute check:', { isAuthenticated, user, allowedRoles })
  
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    console.log('User role not allowed, redirecting to home')
    return <Navigate to="/" replace />
  }
  
  console.log('Rendering protected route content')
  return children
}

function App() {
  const { isAuthenticated, user } = useAuthStore()
  
  // Debug logging
  console.log('App render:', { isAuthenticated, user })
  
  // Get role from current port
  const getRoleFromPort = () => {
    if (typeof window === 'undefined') return 'rider'
    const port = window.location.port
    if (port === '6001') return 'driver' // Changed from 6000 to 6001
    if (port === '7001') return 'admin'
    return 'rider' // default to rider for 5000
  }
  
  const expectedRole = getRoleFromPort()
  
  // Debug logging
  console.log('Port-based role check:', { port: window.location.port, expectedRole })

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={
          isAuthenticated ? (
            user?.role === 'rider' ? <Navigate to="/rider" replace /> :
            user?.role === 'driver' ? <Navigate to="/driver" replace /> :
            user?.role === 'admin' ? <Navigate to="/admin" replace /> :
            <Landing />
          ) : <Landing />
        } />
        
        <Route path="/login" element={
          isAuthenticated ? (
            // Redirect to appropriate dashboard based on role
            user?.role === 'rider' ? <Navigate to="/rider" replace /> :
            user?.role === 'driver' ? <Navigate to="/driver" replace /> :
            user?.role === 'admin' ? <Navigate to="/admin" replace /> :
            <Navigate to="/" replace />
          ) : <Login />
        } />
        
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Register />
        } />
        
        <Route path="/rider/*" element={
          <ProtectedRoute allowedRoles={['rider']}>
            <Routes>
              <Route index element={<RiderDashboard />} />
              <Route path="book" element={<BookRide />} />
            </Routes>
          </ProtectedRoute>
        } />
        
        <Route path="/driver/*" element={
          <ProtectedRoute allowedRoles={['driver']}>
            <Routes>
              <Route index element={<DriverDashboard />} />
              <Route path="vacations" element={<DriverVacationManagement />} />
            </Routes>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/intercity" element={
          <ProtectedRoute>
            <IntercityRides />
          </ProtectedRoute>
        } />
        
        <Route path="/vacation" element={
          <ProtectedRoute allowedRoles={['rider']}>
            <VacationBooking />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  )
}

export default App