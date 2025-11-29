import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import { websocketService } from './services/websocket'

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
import VacationSchedulePlanner from './components/VacationSchedulePlanner'
import FixedPackages from './pages/FixedPackages'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, role } = useAuthStore()
  
  // Debug logging
  console.log('ProtectedRoute check:', { isAuthenticated, user, role, allowedRoles })
  
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }
  
  // Check if the current port role matches allowed roles
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.log('Port role not allowed, redirecting to home')
    return <Navigate to="/" replace />
  }
  
  // Additional check: if user exists but role doesn't match port, logout
  if (user && user.role !== role) {
    console.log('User role mismatch with port, logging out')
    const { logout } = useAuthStore.getState()
    logout()
    return <Navigate to="/login" replace />
  }
  
  console.log('Rendering protected route content')
  return children
}

function App() {
  const { isAuthenticated, user, role } = useAuthStore()
  
  // Debug logging
  console.log('App render:', { isAuthenticated, user, role })
  
  // Initialize auth from storage and connect to WebSocket on app load
  useEffect(() => {
    useAuthStore.getState().initFromStorage()
    websocketService.connect()
  }, [])
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={
          isAuthenticated ? (
            role === 'rider' ? <Navigate to="/rider" replace /> :
            role === 'driver' ? <Navigate to="/driver" replace /> :
            role === 'admin' ? <Navigate to="/admin" replace /> :
            <Landing />
          ) : <Landing />
        } />
        
        <Route path="/login" element={
          isAuthenticated ? (
            // Redirect to appropriate dashboard based on role
            role === 'rider' ? <Navigate to="/rider" replace /> :
            role === 'driver' ? <Navigate to="/driver" replace /> :
            role === 'admin' ? <Navigate to="/admin" replace /> :
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
              <Route path="vacation-booking" element={<VacationBooking />} />
              <Route path="vacation-planner" element={<VacationSchedulePlanner />} />
              <Route path="fixed-packages" element={<FixedPackages />} />
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