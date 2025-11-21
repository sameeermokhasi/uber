import { useState, useEffect } from 'react'
import { Car, LogOut, MapPin, Clock, DollarSign, CheckCircle, XCircle, Navigation, AlertCircle } from 'lucide-react'
import { rideService, userService } from '../services/api'
import { useAuthStore } from '../store/authStore'
import DriverVacationManagement from './DriverVacationManagement'

export default function DriverDashboard() {
  const [availableRides, setAvailableRides] = useState([])
  const [myRides, setMyRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const { user, logout } = useAuthStore()

  useEffect(() => {
    loadRides()
    // Auto-refresh every 5 seconds for real-time updates (only when online)
    const interval = setInterval(() => {
      if (isOnline) {
        loadRides()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Watch for location changes when online
  useEffect(() => {
    let locationWatchId = null
    
    if (isOnline && navigator.geolocation) {
      // Update location every 10 seconds when online
      locationWatchId = setInterval(async () => {
        try {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords
              await userService.updateDriverLocation(latitude, longitude)
            },
            (error) => {
              console.warn('Failed to get location:', error)
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            }
          )
        } catch (error) {
          console.error('Failed to update driver location:', error)
        }
      }, 10000) // Update every 10 seconds
    }
    
    return () => {
      if (locationWatchId) {
        clearInterval(locationWatchId)
      }
    }
  }, [isOnline])

  // WebSocket connection for real-time ride requests
  useEffect(() => {
    // Create WebSocket connection using the correct endpoint
    const token = localStorage.getItem(`auth-storage-driver-token`);
    if (!token) {
      console.error('No auth token found for WebSocket connection');
      return;
    }
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws/${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to WebSocket')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_ride_request') {
          // Add new ride to available rides
          setAvailableRides(prev => {
            // Check if ride already exists
            const exists = prev.some(ride => ride.id === data.ride_id);
            if (!exists) {
              return [
                {
                  id: data.ride_id,
                  pickup_address: data.pickup_address,
                  destination_address: data.destination_address,
                  distance_km: data.distance_km,
                  estimated_fare: data.estimated_fare,
                  vehicle_type: data.vehicle_type
                },
                ...prev
              ];
            }
            return prev;
          });
          
          // Show notification
          if (Notification.permission === 'granted') {
            new Notification('New Ride Request', {
              body: `New ride request from ${data.pickup_address} to ${data.destination_address}`,
              icon: '/favicon.ico'
            });
          }
        } else if (data.type === 'ride_status_update') {
          // Refresh rides when status updates
          loadRides();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      ws.close();
    };
  }, [user?.id])

  const loadRides = async () => {
    if (!isOnline) {
      setAvailableRides([])
      return
    }
    
    try {
      const [available, my] = await Promise.all([
        rideService.getAvailableRides(),
        rideService.getRides()
      ])
      setAvailableRides(available)
      setMyRides(my)
    } catch (error) {
      console.error('Failed to load rides:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleOnlineStatus = async () => {
    console.log('=== TOGGLE ONLINE STATUS START ===')
    const newStatus = !isOnline
    console.log('New status:', newStatus)
    setIsOnline(newStatus)
    
    try {
      // Update driver availability in backend
      console.log('Toggling driver availability...')
      
      // Log the current user info
      console.log('Current user:', user)
      
      // Log the API call details
      const token = localStorage.getItem(`auth-storage-driver-token`)
      console.log('Auth token:', token ? 'Token exists' : 'No token found')
      console.log('All localStorage keys:', Object.keys(localStorage))
      
      const response = await userService.toggleDriverAvailability()
      console.log('Toggle response:', response)
      
      if (newStatus) {
        alert('You are now ONLINE! You will receive ride requests.')
        loadRides()
        
        // Request location permission
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords
              await userService.updateDriverLocation(latitude, longitude)
            },
            (error) => {
              console.warn('Failed to get initial location:', error)
            }
          )
        }
      } else {
        alert('You are now OFFLINE. You will not receive ride requests.')
        setAvailableRides([])
      }
    } catch (error) {
      console.error('Failed to toggle availability:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      })
      
      // Show more detailed error message
      let errorMessage = 'Failed to update availability status. Please try again.'
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.'
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. Only drivers can update availability.'
      } else if (error.response?.status === 404) {
        errorMessage = 'Driver profile not found.'
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.'
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      alert(errorMessage)
      setIsOnline(!newStatus) // Revert status on error
    }
    console.log('=== TOGGLE ONLINE STATUS END ===')
  }

  const handleAcceptRide = async (rideId) => {
    try {
      await rideService.updateRide(rideId, { status: 'accepted' })
      alert('Ride accepted! You can now start the ride.')
      loadRides()
    } catch (error) {
      console.error('Failed to accept ride:', error)
      alert('Failed to accept ride. Please try again.')
    }
  }

  const handleRejectRide = async (rideId) => {
    try {
      await rideService.updateRide(rideId, { status: 'cancelled' })
      alert('Ride rejected.')
      loadRides()
    } catch (error) {
      console.error('Failed to reject ride:', error)
      alert('Failed to reject ride. Please try again.')
    }
  }

  const handleStartRide = async (rideId) => {
    try {
      await rideService.updateRide(rideId, { status: 'in_progress' })
      alert('Ride started!')
      loadRides()
    } catch (error) {
      console.error('Failed to start ride:', error)
      alert('Failed to start ride. Please try again.')
    }
  }

  const handleCompleteRide = async (rideId) => {
    try {
      await rideService.updateRide(rideId, { status: 'completed' })
      loadRides()
    } catch (error) {
      console.error('Failed to complete ride:', error)
      alert('Failed to complete ride. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Driver Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Online/Offline Toggle */}
              <div className="flex items-center space-x-3 bg-gray-100 rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <button
                  onClick={toggleOnlineStatus}
                  className={`relative inline-flex items-center h-8 w-16 rounded-full transition-colors duration-300 focus:outline-none ${
                    isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                >
                  <span
                    className={`inline-block w-6 h-6 transform rounded-full bg-white transition-transform duration-300 ${
                      isOnline ? 'translate-x-9' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm font-bold ${
                  isOnline ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}
                </span>
              </div>
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
        {/* Online Status Alert */}
        {!isOnline && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 mr-3" />
              <div>
                <p className="font-bold">You are currently OFFLINE</p>
                <p className="text-sm">Toggle the switch above to go online and start receiving ride requests.</p>
              </div>
            </div>
          </div>
        )}

        {isOnline && availableRides.length === 0 && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 mr-3" />
              <div>
                <p className="font-bold">You are ONLINE and ready for rides!</p>
                <p className="text-sm">New ride requests will appear automatically every 5 seconds.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Available Rides */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">🔔 New Ride Requests</h2>
              {isOnline && (
                <span className="text-sm text-green-600 font-medium animate-pulse">● Auto-refreshing every 5s</span>
              )}
            </div>
            
            {!isOnline ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">You are offline</p>
                <p className="text-sm text-gray-400 mt-2">Go online to receive ride requests</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : availableRides.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No available rides</p>
                <p className="text-sm text-gray-400 mt-2">New requests will appear here automatically</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableRides.map((ride) => (
                  <div key={ride.id} className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge badge-warning">⚡ NEW REQUEST</span>
                      <span className="text-sm text-gray-600">#{ride.id}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-start space-x-2 mb-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Pickup</p>
                          <p className="text-sm">{ride.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Drop-off</p>
                          <p className="text-sm">{ride.destination_address}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-4 pb-3 border-b">
                      <div className="text-sm text-gray-600">
                        <Navigation className="w-4 h-4 inline mr-1" />
                        {ride.distance_km?.toFixed(1) || 'N/A'} km
                      </div>
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-primary-600 mr-1">₹</span>
                        <span className="text-2xl font-bold text-primary-600">
                          {ride.estimated_fare?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAcceptRide(ride.id)}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Accept Ride
                      </button>
                      <button
                        onClick={() => handleRejectRide(ride.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Rides */}
          <div>
            <div className="card">
              <h2 className="text-2xl font-bold mb-6">🚗 My Active Rides</h2>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : myRides.length === 0 ? (
                <div className="text-center py-12">
                  <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active rides</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myRides.filter(r => r.status !== 'completed' && r.status !== 'cancelled').map((ride) => (
                    <div key={ride.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                      <div className="mb-3">
                        <div className="flex items-start space-x-2 mb-2">
                          <MapPin className="w-4 h-4 text-green-600 mt-1" />
                          <div>
                            <p className="font-medium text-sm">Pickup</p>
                            <p className="text-sm">{ride.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-1" />
                          <div>
                            <p className="font-medium text-sm">Drop-off</p>
                            <p className="text-sm">{ride.destination_address}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`badge ${
                          ride.status === 'accepted' ? 'badge-info' : 
                          ride.status === 'in_progress' ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          {ride.status === 'accepted' ? '✅ Accepted' :
                           ride.status === 'in_progress' ? '🚗 In Progress' :
                           ride.status}
                        </span>
                        <span className="font-bold text-primary-600">
                          ₹{ride.estimated_fare?.toFixed(2)}
                        </span>
                      </div>
                      {ride.status === 'accepted' && (
                        <button
                          onClick={() => handleStartRide(ride.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
                        >
                          🚀 Start Ride
                        </button>
                      )}
                      {ride.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteRide(ride.id)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors"
                        >
                          ✅ Complete Ride
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Vacation Management */}
            <DriverVacationManagement />
          </div>
        </div>
      </div>
    </div>
  )
}