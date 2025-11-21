import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Car, MapPin, Clock, DollarSign, LogOut, Plane, AlertCircle, CheckCircle, Navigation as NavIcon } from 'lucide-react'
import { rideService } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { websocketService } from '../services/websocket'
import DriverRouteMap from '../components/DriverRouteMap'

export default function RiderDashboard() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [driverLocations, setDriverLocations] = useState({})
  const { user, logout } = useAuthStore()

  useEffect(() => {
    loadRides()
    // Auto-refresh every 5 seconds for real-time updates
    const interval = setInterval(loadRides, 5000)
    return () => clearInterval(interval)
  }, [])

  // WebSocket listener for real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (data) => {
      if (data.type === 'driver_location_update') {
        // Update driver location for a specific ride
        setDriverLocations(prev => ({
          ...prev,
          [data.ride_id]: {
            lat: data.lat,
            lng: data.lng
          }
        }))
      } else if (data.type === 'ride_status_update') {
        // Refresh rides when status changes
        loadRides()
      }
    }

    websocketService.addListener('message', handleWebSocketMessage)
    
    return () => {
      websocketService.removeListener('message', handleWebSocketMessage)
    }
  }, [])

  const loadRides = async () => {
    try {
      const data = await rideService.getRides()
      setRides(data)
    } catch (error) {
      console.error('Failed to load rides:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      accepted: 'badge-info',
      in_progress: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    }
    return badges[status] || 'badge'
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-blue-600" />
      case 'in_progress':
        return <NavIcon className="w-5 h-5 text-purple-600" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusText = (status) => {
    switch(status) {
      case 'pending':
        return '⏳ Finding driver...'
      case 'accepted':
        return '✅ Driver accepted! Arriving soon...'
      case 'in_progress':
        return '🚗 Ride in progress'
      case 'completed':
        return '✅ Ride completed'
      case 'cancelled':
        return '❌ Ride cancelled'
      default:
        return status
    }
  }

  // Get active ride (accepted or in_progress)
  const activeRide = rides.find(ride => 
    ride.status === 'accepted' || ride.status === 'in_progress'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Uber Vacation</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
              <button onClick={logout} className="btn-outline text-sm">
                <LogOut className="w-4 h-4 inline mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Link to="/rider/book" className="card hover:shadow-xl transition-all duration-300 text-center">
            <Car className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">Book Local Ride</h3>
            <p className="text-gray-600">Quick rides within your city</p>
          </Link>

          <Link to="/intercity" className="card hover:shadow-xl transition-all duration-300 text-center">
            <MapPin className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">Intercity Travel</h3>
            <p className="text-gray-600">Book rides between cities</p>
          </Link>

          <Link to="/vacation" className="card hover:shadow-xl transition-all duration-300 text-center">
            <Plane className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">Plan Vacation</h3>
            <p className="text-gray-600">Complete travel packages</p>
          </Link>
        </div>

        {/* Active Ride with Real-time Map */}
        {activeRide && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold mb-4">📍 Active Ride</h2>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(activeRide.status)}
                  <div>
                    <p className="font-bold text-lg">{getStatusText(activeRide.status)}</p>
                    <p className="text-xs text-gray-500">Ride #{activeRide.id}</p>
                  </div>
                </div>
                <span className={`${getStatusBadge(activeRide.status)} text-xs`}>
                  {activeRide.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            {/* Real-time Map */}
            <DriverRouteMap 
              ride={activeRide} 
              driverLocation={driverLocations[activeRide.id]} 
            />
          </div>
        )}

        {/* Recent Rides */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">My Rides</h2>
            <span className="text-sm text-gray-500">Auto-updating every 5s</span>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading rides...</p>
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No rides yet</p>
              <p className="text-gray-400 mt-2">Book your first ride to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rides.slice(0, 5).map((ride) => (
                <div key={ride.id} className={`border-2 rounded-lg p-5 transition-all ${
                  ride.status === 'pending' ? 'border-yellow-300 bg-yellow-50' :
                  ride.status === 'accepted' ? 'border-blue-300 bg-blue-50' :
                  ride.status === 'in_progress' ? 'border-purple-300 bg-purple-50' :
                  ride.status === 'completed' ? 'border-green-200 bg-green-50' :
                  'border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(ride.status)}
                      <div>
                        <p className="font-bold text-lg">{getStatusText(ride.status)}</p>
                        <p className="text-xs text-gray-500">Ride #{ride.id}</p>
                      </div>
                    </div>
                    <span className={`${getStatusBadge(ride.status)} text-xs`}>
                      {ride.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Progress Bar for Active Rides */}
                  {(ride.status === 'pending' || ride.status === 'accepted' || ride.status === 'in_progress') && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-2">
                        <span>Requested</span>
                        <span>Accepted</span>
                        <span>In Progress</span>
                        <span>Completed</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-500 ${
                          ride.status === 'pending' ? 'bg-yellow-500 w-1/4' :
                          ride.status === 'accepted' ? 'bg-blue-500 w-1/2' :
                          ride.status === 'in_progress' ? 'bg-purple-500 w-3/4' :
                          'bg-green-500 w-full'
                        }`}></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 mb-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{ride.pickup_address}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-red-600" />
                      <span className="font-medium">{ride.destination_address}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600 pt-3 border-t">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {new Date(ride.created_at).toLocaleDateString()}
                      </span>
                      {ride.distance_km && (
                        <span>{ride.distance_km.toFixed(1)} km</span>
                      )}
                    </div>
                    {ride.estimated_fare && (
                      <span className="flex items-center font-semibold text-primary-600 text-lg">
                        ₹{ride.estimated_fare.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}