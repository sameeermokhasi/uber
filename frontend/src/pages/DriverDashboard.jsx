import { useState, useEffect } from 'react'
import { Car, LogOut, MapPin, Clock, DollarSign, CheckCircle, XCircle, Navigation, AlertCircle } from 'lucide-react'
import { rideService, userService, vacationService } from '../services/api'
import { useAuthStore } from '../store/authStore'
// Add map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icons
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function DriverDashboard() {
  const [localRides, setLocalRides] = useState([])
  const [vacationRides, setVacationRides] = useState([])
  const [myRides, setMyRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [driverLocation, setDriverLocation] = useState(null) // Add driver location state
  const [selectedRide, setSelectedRide] = useState(null) // Add selected ride state
  const { user, logout } = useAuthStore()

  // Set driver as available when component mounts and ensure location is set
  useEffect(() => {
    const initializeDriver = async () => {
      try {
        console.log("Initializing driver...");
        
        // First, make sure driver is available
        const updatedUser = await userService.toggleDriverAvailability();
        console.log("Driver availability updated:", updatedUser);
        setIsOnline(updatedUser.driver_profile?.is_available || false);
        
        // Then set driver location if geolocation is available
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              try {
                await userService.updateDriverLocation(latitude, longitude);
                console.log("Driver location updated:", latitude, longitude);
                // Store driver location in state
                setDriverLocation({ lat: latitude, lng: longitude });
              } catch (error) {
                console.error("Failed to update driver location:", error);
              }
            },
            (error) => {
              console.warn('Failed to get location:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            }
          );
        }
      } catch (error) {
        console.error("Failed to initialize driver:", error);
        // Even if we can't set availability, we'll still try to load rides
        setIsOnline(false);
      }
    };

    if (user) {
      initializeDriver();
    }
  }, [user]);

  // Function to calculate route between driver and rider
  const calculateRouteToRider = async (ride) => {
    if (!driverLocation || !ride) return [];
    
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${ride.pickup_lng},${ride.pickup_lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        return coordinates;
      }
    } catch (error) {
      console.error('Failed to calculate route to rider:', error);
    }
    return [];
  };

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

  // Watch for location changes when online and set initial location
  useEffect(() => {
    let locationWatchId = null
    
    const updateLocation = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords
              await userService.updateDriverLocation(latitude, longitude)
              console.log("Driver location updated:", latitude, longitude)
              // Store driver location in state
              setDriverLocation({ lat: latitude, lng: longitude })
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
        }
      } catch (error) {
        console.error('Failed to update driver location:', error)
      }
    }
    
    if (isOnline && navigator.geolocation) {
      // Set initial location immediately
      updateLocation()
      
      // Update location every 10 seconds when online
      locationWatchId = setInterval(updateLocation, 10000)
    }
    
    return () => {
      if (locationWatchId) {
        clearInterval(locationWatchId)
      }
    }
  }, [isOnline])

  // WebSocket connection for real-time ride requests
  useEffect(() => {
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10; // Increase max attempts
    const reconnectInterval = 3000;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      // Clear any existing reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Create WebSocket connection using the correct endpoint
      // Try multiple possible token storage keys
      const possibleKeys = [
        `auth-storage-driver-token`,
        `auth-storage-driver`,
        `auth-storage`,
        `auth-storage-${user?.id}`
      ];
      
      let token = null;
      for (const key of possibleKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            token = parsed.state?.token || parsed.token || null;
            if (token) break;
          } catch (e) {
            // If it's not JSON, treat it as raw token
            token = stored;
            break;
          }
        }
      }
      
      if (!token) {
        console.error('No auth token found for WebSocket connection');
        // Try to reconnect after a delay
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimeout = setTimeout(() => {
            console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            connectWebSocket();
          }, reconnectInterval);
        }
        return;
      }
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws/${token}`;
      console.log('Connecting to WebSocket:', wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to WebSocket');
        reconnectAttempts = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("=== WEBSOCKET MESSAGE RECEIVED ===", data);
          if (data.type === 'new_ride_request') {
            console.log("Processing new ride request:", data);
            // Add new ride to available rides
            setLocalRides(prev => {
              // Check if ride already exists
              const exists = prev.some(ride => ride.id === data.ride_id);
              if (!exists) {
                console.log("Adding new ride to local rides list");
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
              console.log("Ride already exists in local rides list");
              return prev;
            });
            
            // Show notification
            if (Notification.permission === 'granted') {
              new Notification('New Ride Request', {
                body: `New ride request from ${data.pickup_address} to ${data.destination_address}`,
                icon: '/favicon.ico'
              });
            }
          } else if (data.type === 'new_vacation_request') {
            console.log("Processing new vacation request:", data);
            // Add new vacation to available rides
            setVacationRides(prev => {
              // Check if vacation already exists
              const exists = prev.some(vacation => vacation.id === data.vacation_id);
              if (!exists) {
                console.log("Adding new vacation to vacation rides list");
                return [
                  {
                    id: data.vacation_id,
                    destination: data.destination,
                    hotel_name: data.hotel_name,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    total_price: data.total_price,
                    passengers: data.passengers
                  },
                  ...prev
                ];
              }
              console.log("Vacation already exists in vacation rides list");
              return prev;
            });
            
            // Show notification
            if (Notification.permission === 'granted') {
              new Notification('New Vacation Request', {
                body: `New vacation request to ${data.destination}`,
                icon: '/favicon.ico'
              });
            }
          } else if (data.type === 'ride_status_update') {
            console.log("Processing ride status update");
            // Refresh rides when status updates
            loadRides();
          } else if (data.type === 'vacation_status_update') {
            console.log("Processing vacation status update");
            // Refresh vacations when status updates
            loadRides();
          } else {
            // Handle any other message types by refreshing rides
            console.log("Unknown message type, refreshing rides");
            loadRides();
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          // Even if we can't parse the message, try to refresh rides
          loadRides();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        ws = null;
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimeout = setTimeout(() => {
            console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            connectWebSocket();
          }, reconnectInterval);
        } else {
          console.error('Max reconnect attempts reached');
        }
      };
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Only connect WebSocket when user is logged in and online
    if (user && isOnline) {
      // Connect to WebSocket
      connectWebSocket();
    }

    return () => {
      // Cleanup function
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [user?.id, isOnline]);

  // Add this useEffect to periodically fetch available rides as a fallback
  useEffect(() => {
    if (isOnline) {
      console.log("Setting up periodic ride refresh...");
      const interval = setInterval(() => {
        console.log("Periodically refreshing rides...");
        loadRides();
      }, 10000); // Fetch every 10 seconds as a fallback
    
      return () => {
        console.log("Clearing periodic ride refresh interval");
        clearInterval(interval);
      };
    }
  }, [isOnline]);

  const loadRides = async () => {
    try {
      console.log("=== LOADING RIDES ===");
      console.log("Fetching available rides, vacations, and my active rides");
      
      // Add retry mechanism for robustness
      let localAvailable = [];
      let vacationAvailable = [];
      let myActive = [];
      
      try {
        const results = await Promise.all([
          rideService.getAvailableRides(),
          vacationService.getAvailableVacations(),
          rideService.getRides()
        ]);
        [localAvailable, vacationAvailable, myActive] = results;
      } catch (error) {
        console.error("Error fetching rides, retrying...", error);
        // Retry once
        const results = await Promise.all([
          rideService.getAvailableRides(),
          vacationService.getAvailableVacations(),
          rideService.getRides()
        ]);
        [localAvailable, vacationAvailable, myActive] = results;
      }
      
      console.log("Local available rides:", localAvailable);
      console.log("Vacation available rides:", vacationAvailable);
      console.log("My active rides:", myActive);
      console.log("Number of local rides:", localAvailable.length);
      console.log("Number of vacation rides:", vacationAvailable.length);
      console.log("Number of my active rides:", myActive.length);
      
      // Filter myActive rides to only include assigned rides
      const assignedRides = myActive.filter(ride => ride.driver_id === user?.id);
      console.log("Assigned rides:", assignedRides);
      
      setLocalRides(localAvailable);
      setVacationRides(vacationAvailable);
      setMyRides(assignedRides);
      
      setLoading(false);
    } catch (error) {
      console.error("Failed to load rides:", error);
      // Set empty arrays on error to avoid showing stale data
      setLocalRides([]);
      setVacationRides([]);
      setMyRides([]);
      setLoading(false);
    }
  }

  // Map component to show rider location and route
  const RiderLocationMap = ({ ride, driverLoc }) => {
    const [route, setRoute] = useState([]);
    
    useEffect(() => {
      const fetchRoute = async () => {
        if (ride && driverLoc) {
          const routeCoords = await calculateRouteToRider(ride);
          setRoute(routeCoords);
        }
      };
      
      fetchRoute();
    }, [ride, driverLoc]);
    
    if (!ride || !driverLoc) return null;
    
    // Center the map between driver and rider
    const center = [
      (parseFloat(ride.pickup_lat) + parseFloat(driverLoc.lat)) / 2,
      (parseFloat(ride.pickup_lng) + parseFloat(driverLoc.lng)) / 2
    ];
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Rider Location Map</h3>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '400px', width: '100%', borderRadius: '12px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Rider pickup location */}
          <Marker position={[parseFloat(ride.pickup_lat), parseFloat(ride.pickup_lng)]} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-green-600">📍 Rider Pickup</p>
                <p className="text-gray-600">{ride.pickup_address}</p>
              </div>
            </Popup>
          </Marker>
          
          {/* Driver location */}
          <Marker position={[parseFloat(driverLoc.lat), parseFloat(driverLoc.lng)]} icon={driverIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-blue-600">🚗 Your Location</p>
              </div>
            </Popup>
          </Marker>
          
          {/* Route between driver and rider */}
          {route.length > 0 && (
            <Polyline
              positions={route}
              color="#3b82f6"
              weight={4}
              opacity={0.7}
            />
          )}
        </MapContainer>
        
        <div className="mt-3 text-sm text-gray-600">
          <p>Click on markers to see details. Blue marker is your location, green marker is rider's pickup location.</p>
        </div>
      </div>
    );
  };

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
        // Load rides immediately when going online
        setTimeout(() => {
          loadRides()
        }, 1000) // Small delay to ensure the backend status update has propagated
        
        // Request location permission and update location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords
              try {
                await userService.updateDriverLocation(latitude, longitude)
                console.log("Driver location updated:", latitude, longitude)
                // Store driver location in state
                setDriverLocation({ lat: latitude, lng: longitude })
              } catch (error) {
                console.error("Failed to update driver location:", error)
              }
            },
            (error) => {
              console.warn('Failed to get initial location:', error)
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            }
          )
        }
      } else {
        alert('You are now OFFLINE. You will not receive ride requests.')
        setLocalRides([])
        setVacationRides([])
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

  const acceptRide = async (rideId) => {
    try {
      console.log("Accepting ride:", rideId);
      const updatedRide = await rideService.updateRide(rideId, { status: 'accepted' });
      console.log("Ride accepted:", updatedRide);
      
      // Remove the ride from available rides
      setLocalRides(prev => prev.filter(ride => ride.id !== rideId));
      
      // Add to my rides
      setMyRides(prev => [...prev, updatedRide]);
      
      // Set the accepted ride as selected
      setSelectedRide(updatedRide);
      
      // Show success notification
      if (Notification.permission === 'granted') {
        new Notification('Ride Accepted', {
          body: `You have accepted the ride to ${updatedRide.destination_address}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error("Failed to accept ride:", error);
      // Show error notification
      if (Notification.permission === 'granted') {
        new Notification('Error Accepting Ride', {
          body: 'Failed to accept ride. Please try again.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  const startRide = async (rideId) => {
    try {
      console.log("Starting ride:", rideId);
      const updatedRide = await rideService.updateRide(rideId, { status: 'in_progress' });
      console.log("Ride started:", updatedRide);
      
      // Update the ride in my rides
      setMyRides(prev => prev.map(ride => 
        ride.id === rideId ? updatedRide : ride
      ));
      
      // Show success notification
      if (Notification.permission === 'granted') {
        new Notification('Ride Started', {
          body: `You have started the ride to ${updatedRide.destination_address}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error("Failed to start ride:", error);
      // Show error notification
      if (Notification.permission === 'granted') {
        new Notification('Error Starting Ride', {
          body: 'Failed to start ride. Please try again.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  const completeRide = async (rideId) => {
    try {
      console.log("Completing ride:", rideId);
      const updatedRide = await rideService.updateRide(rideId, { status: 'completed' });
      console.log("Ride completed:", updatedRide);
      
      // Remove the ride from my rides
      setMyRides(prev => prev.filter(ride => ride.id !== rideId));
      
      // Clear selected ride if it was the completed ride
      if (selectedRide && selectedRide.id === rideId) {
        setSelectedRide(null);
      }
      
      // Show success notification
      if (Notification.permission === 'granted') {
        new Notification('Ride Completed', {
          body: `You have completed the ride to ${updatedRide.destination_address}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error("Failed to complete ride:", error);
      // Show error notification
      if (Notification.permission === 'granted') {
        new Notification('Error Completing Ride', {
          body: 'Failed to complete ride. Please try again.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  // Add the missing handler functions
  const handleAcceptRide = async (id, type) => {
    try {
      console.log(`Accepting ${type} ride:`, id);
      
      if (type === 'vacation') {
        // For vacation rides, we need to use vacationService
        const updatedVacation = await vacationService.confirmVacation(id);
        console.log("Vacation accepted:", updatedVacation);
        
        // Remove from available vacation rides
        setVacationRides(prev => prev.filter(vacation => vacation.id !== id));
        
        // Add to my rides (we might need to adjust this based on how vacations are handled)
        // For now, we'll just refresh the data
        loadRides();
        
        // Show success notification
        if (Notification.permission === 'granted') {
          new Notification('Vacation Accepted', {
            body: `You have accepted the vacation to ${updatedVacation.destination}`,
            icon: '/favicon.ico'
          });
        }
      } else {
        // For local rides, use the existing acceptRide function
        await acceptRide(id);
        
        // Find the accepted ride and set it as selected
        const acceptedRide = localRides.find(ride => ride.id === id);
        if (acceptedRide) {
          setSelectedRide(acceptedRide);
        }
      }
    } catch (error) {
      console.error(`Failed to accept ${type} ride:`, error);
      // Show error notification
      if (Notification.permission === 'granted') {
        new Notification(`Error Accepting ${type === 'vacation' ? 'Vacation' : 'Ride'}`, {
          body: `Failed to accept ${type}. Please try again.`,
          icon: '/favicon.ico'
        });
      }
    }
  };

  const handleRejectRide = async (id, type) => {
    try {
      console.log(`Rejecting ${type} ride:`, id);
      
      if (type === 'vacation') {
        // For vacation rides, we need to cancel the vacation
        const updatedVacation = await vacationService.cancelVacation(id);
        console.log("Vacation rejected:", updatedVacation);
        
        // Remove from available vacation rides
        setVacationRides(prev => prev.filter(vacation => vacation.id !== id));
        
        // Show success notification
        if (Notification.permission === 'granted') {
          new Notification('Vacation Rejected', {
            body: `You have rejected the vacation to ${updatedVacation.destination}`,
            icon: '/favicon.ico'
          });
        }
      } else {
        // For local rides, we need to cancel the ride
        await rideService.cancelRide(id);
        console.log("Ride rejected:", id);
        
        // Remove from available local rides
        setLocalRides(prev => prev.filter(ride => ride.id !== id));
        
        // Clear selected ride if it was the rejected ride
        if (selectedRide && selectedRide.id === id) {
          setSelectedRide(null);
        }
        
        // Show success notification
        if (Notification.permission === 'granted') {
          new Notification('Ride Rejected', {
            body: 'You have rejected the ride request',
            icon: '/favicon.ico'
          });
        }
      }
    } catch (error) {
      console.error(`Failed to reject ${type} ride:`, error);
      // Show error notification
      if (Notification.permission === 'granted') {
        new Notification(`Error Rejecting ${type === 'vacation' ? 'Vacation' : 'Ride'}`, {
          body: `Failed to reject ${type}. Please try again.`,
          icon: '/favicon.ico'
        });
      }
    }
  };

  // Add useEffect to handle document visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isOnline) {
        // When tab becomes visible and driver is online, refresh rides
        loadRides();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline]);

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

        {isOnline && localRides.length === 0 && vacationRides.length === 0 && (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Local Ride Requests */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">🔔 New Local Ride Requests</h2>
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
            ) : localRides.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No available local rides</p>
                <p className="text-sm text-gray-400 mt-2">New requests will appear here automatically</p>
              </div>
            ) : (
              <div className="space-y-4">
                {localRides.map((ride) => (
                  <div key={ride.id} className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge badge-warning font-bold">⚡ NEW RIDE REQUEST</span>
                      <span className="text-sm text-gray-600 font-semibold">#{ride.id}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-start space-x-2 mb-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Pickup Location</p>
                          <p className="text-sm font-semibold">{ride.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Destination</p>
                          <p className="text-sm font-semibold">{ride.destination_address}</p>
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
                        onClick={() => acceptRide(ride.id)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        ACCEPT RIDE
                      </button>
                      <button
                        onClick={() => handleRejectRide(ride.id, 'local')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Vacation Travel Requests */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">🏖️ New Vacation Travel Requests</h2>
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
            ) : vacationRides.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No available vacation travel requests</p>
                <p className="text-sm text-gray-400 mt-2">New requests will appear here automatically</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vacationRides.map((vacation) => (
                  <div key={vacation.id} className="border-2 border-purple-400 bg-purple-50 rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge badge-purple font-bold">🌴 VACATION REQUEST</span>
                      <span className="text-sm text-gray-600 font-semibold">#{vacation.id}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-start space-x-2 mb-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Destination</p>
                          <p className="text-sm font-semibold">{vacation.destination}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-gray-700">Hotel</p>
                          <p className="text-sm font-semibold">{vacation.hotel_name || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-4 pb-3 border-b">
                      <div className="text-sm text-gray-600">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {new Date(vacation.start_date).toLocaleDateString()} - {new Date(vacation.end_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-primary-600 mr-1">₹</span>
                        <span className="text-2xl font-bold text-primary-600">
                          {vacation.total_price?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAcceptRide(vacation.id, 'vacation')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        ACCEPT TRAVEL
                      </button>
                      <button
                        onClick={() => handleRejectRide(vacation.id, 'vacation')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* My Active Rides */}
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
                    <div key={ride.id} className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 shadow-md">
                      <div className="mb-3">
                        <div className="flex items-start space-x-2 mb-2">
                          <MapPin className="w-4 h-4 text-green-600 mt-1" />
                          <div>
                            <p className="font-medium text-sm">Pickup</p>
                            <p className="text-sm font-semibold">{ride.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-1" />
                          <div>
                            <p className="font-medium text-sm">Drop-off</p>
                            <p className="text-sm font-semibold">{ride.destination_address}</p>
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
                        <span className="font-bold text-primary-600 text-lg">
                          ₹{ride.estimated_fare?.toFixed(2)}
                        </span>
                      </div>
                      {/* Progress indicator for active rides */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Accepted</span>
                          <span>In Progress</span>
                          <span>Completed</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className={`h-3 rounded-full transition-all duration-1000 ${
                            ride.status === 'accepted' ? 'bg-blue-500 w-1/2' :
                            ride.status === 'in_progress' ? 'bg-purple-500 w-3/4' :
                            'bg-green-500 w-full'
                          }`}></div>
                        </div>
                      </div>
                      {/* Stage-specific buttons with enhanced visibility */}
                      <div className="grid grid-cols-1 gap-3">
                        {ride.status === 'accepted' && (
                          <>
                            <button
                              onClick={() => startRide(ride.id)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-md"
                            >
                              <Navigation className="w-5 h-5 mr-2" />
                              START RIDE
                            </button>
                            <button
                              onClick={() => handleRejectRide(ride.id, 'local')}
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors shadow-md"
                            >
                              Cancel Ride
                            </button>
                          </>
                        )}
                        {ride.status === 'in_progress' && (
                          <button
                            onClick={() => completeRide(ride.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-md"
                          >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            COMPLETE RIDE
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rider Location Map - only show when a ride is selected */}
            {selectedRide && driverLocation && (
              <div className="card mt-8">
                <RiderLocationMap ride={selectedRide} driverLoc={driverLocation} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}