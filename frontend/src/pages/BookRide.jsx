import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, DollarSign, Car, Clock, ArrowLeft } from 'lucide-react'
import { rideService } from '../services/api'
import MapWithRoute from '../components/MapWithRoute'

export default function BookRide() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    pickup_address: '',
    pickup_lat: 0,
    pickup_lng: 0,
    destination_address: '',
    destination_lng: 0,
    vehicle_type: 'economy',
    scheduled_time: ''
  })
  const [estimatedFare, setEstimatedFare] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mapRouteInfo, setMapRouteInfo] = useState(null)
  const [popularLocations, setPopularLocations] = useState([])

  // Sample locations for demo (Indian cities and local areas)
  const sampleLocations = [
    // Major Metro Cities
    { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
    
    // Popular Local Areas
    { name: 'Indiranagar, Bangalore', lat: 12.9719, lng: 77.6412 },
    { name: 'Koramangala, Bangalore', lat: 12.9352, lng: 77.6245 },
    { name: 'Connaught Place, Delhi', lat: 28.6333, lng: 77.2250 },
    { name: 'Gurgaon, Delhi NCR', lat: 28.4595, lng: 77.0266 },
    { name: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8381 },
    { name: 'Andheri, Mumbai', lat: 19.1136, lng: 72.8697 },
    { name: 'Park Street, Kolkata', lat: 22.5489, lng: 88.3500 },
    { name: 'T Nagar, Chennai', lat: 13.0390, lng: 80.2340 },
    { name: 'HITEC City, Hyderabad', lat: 17.4448, lng: 78.3852 },
    { name: 'Jubilee Hills, Hyderabad', lat: 17.4250, lng: 78.4000 }
  ]

  const handleLocationSelect = (field, location) => {
    if (field === 'pickup') {
      setFormData({
        ...formData,
        pickup_address: location.name,
        pickup_lat: location.lat,
        pickup_lng: location.lng
      })
    } else {
      setFormData({
        ...formData,
        destination_address: location.name,
        destination_lat: location.lat,
        destination_lng: location.lng
      })
    }
  }

  const calculateEstimate = () => {
    if (formData.pickup_lat && formData.destination_lat) {
      // Haversine formula
      const R = 6371
      const dLat = (formData.destination_lat - formData.pickup_lat) * Math.PI / 180
      const dLon = (formData.destination_lng - formData.pickup_lng) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(formData.pickup_lat * Math.PI / 180) * Math.cos(formData.destination_lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      const distance = R * c

      const baseFare = { economy: 50, premium: 100, suv: 120, luxury: 200 }
      const perKmRate = { economy: 10, premium: 15, suv: 18, luxury: 25 }
      
      const fare = baseFare[formData.vehicle_type] + (distance * perKmRate[formData.vehicle_type])
      const duration = Math.round((distance / 40) * 60)

      setEstimatedFare({
        distance: distance.toFixed(1),
        duration,
        fare: fare.toFixed(2)
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Calculate estimate if not already calculated
    if (!estimatedFare) {
      calculateEstimate()
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (!estimatedFare || !estimatedFare.fare) {
      alert('Please select pickup and destination locations first!')
      return
    }
    
    setLoading(true)

    try {
      // Only send the required fields to the backend
      const rideData = {
        pickup_address: formData.pickup_address,
        pickup_lat: formData.pickup_lat,
        pickup_lng: formData.pickup_lng,
        destination_address: formData.destination_address,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        vehicle_type: formData.vehicle_type,
        scheduled_time: formData.scheduled_time || null
      }
      
      const response = await rideService.createRide(rideData)
      alert('Ride request sent successfully! Waiting for driver acceptance...')
      navigate('/rider')
    } catch (error) {
      console.error('Failed to book ride:', error)
      alert('Failed to book ride. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/rider')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Book a Ride</h1>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Map View */}
            <div className="md:col-span-3 mb-6">
              <div className="card">
                <h3 className="text-lg font-bold mb-4">🗺️ Route Map</h3>
                <MapWithRoute
                  pickup={formData.pickup_lat ? {
                    lat: formData.pickup_lat,
                    lng: formData.pickup_lng,
                    address: formData.pickup_address
                  } : null}
                  destination={formData.destination_lat ? {
                    lat: formData.destination_lat,
                    lng: formData.destination_lng,
                    address: formData.destination_address
                  } : null}
                  onRouteCalculated={(info) => {
                    setMapRouteInfo(info)
                    // Auto-update fare based on actual route distance
                    const baseFare = { economy: 50, premium: 100, suv: 120, luxury: 200 }
                    const perKmRate = { economy: 10, premium: 15, suv: 18, luxury: 25 }
                    const fare = baseFare[formData.vehicle_type] + (parseFloat(info.distance) * perKmRate[formData.vehicle_type])
                    setEstimatedFare({
                      distance: info.distance,
                      duration: info.duration,
                      fare: fare.toFixed(2),
                      pickupETA: info.pickupETA,
                      dropoffETA: info.dropoffETA
                    })
                  }}
                />
              </div>
            </div>

            {/* Booking Form */}
            <div className="md:col-span-2">
              <form onSubmit={handleSubmit} className="card space-y-6">
                {/* Pickup Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline text-green-600 mr-1" />
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={formData.pickup_address}
                    onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                    className="input-field"
                    placeholder="Enter pickup location"
                    required
                  />
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Popular locations:</p>
                    <div className="flex flex-wrap gap-2">
                      {sampleLocations.map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLocationSelect('pickup', loc)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline text-red-600 mr-1" />
                    Destination
                  </label>
                  <input
                    type="text"
                    value={formData.destination_address}
                    onChange={(e) => setFormData({ ...formData, destination_address: e.target.value })}
                    className="input-field"
                    placeholder="Where to?"
                    required
                  />
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Popular locations:</p>
                    <div className="flex flex-wrap gap-2">
                      {sampleLocations.map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLocationSelect('destination', loc)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Vehicle Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'economy', label: 'Economy', icon: '🚗', price: '₹50 + ₹10/km' },
                      { value: 'premium', label: 'Premium', icon: '🚙', price: '₹100 + ₹15/km' },
                      { value: 'suv', label: 'SUV', icon: '🚐', price: '₹120 + ₹18/km' },
                      { value: 'luxury', label: 'Luxury', icon: '🚘', price: '₹200 + ₹25/km' }
                    ].map((vehicle) => (
                      <button
                        key={vehicle.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicle_type: vehicle.value })}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          formData.vehicle_type === vehicle.value
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{vehicle.icon}</div>
                        <div className="font-semibold">{vehicle.label}</div>
                        <div className="text-xs text-gray-600">{vehicle.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Schedule for Later (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="input-field"
                  />
                </div>

                {/* Calculate Estimate */}
                <button
                  type="button"
                  onClick={calculateEstimate}
                  className="btn-secondary w-full"
                  disabled={!formData.pickup_lat || !formData.destination_lat}
                >
                  Calculate Estimate
                </button>

                {/* Submit */}
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading || !formData.pickup_lat || !formData.destination_lat}
                >
                  {loading ? 'Booking...' : 'Confirm Booking'}
                </button>
              </form>
            </div>

            {/* Fare Estimate */}
            <div className="md:col-span-1">
              <div className="card sticky top-6">
                <h3 className="text-lg font-bold mb-4">Fare Estimate</h3>
                
                {estimatedFare ? (
                  <div className="space-y-4">
                    <div className="bg-primary-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Estimated Fare</p>
                      <p className="text-3xl font-bold text-primary-600">
                        ₹{estimatedFare.fare}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Distance</span>
                        <span className="font-semibold">{estimatedFare.distance} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Est. Duration</span>
                        <span className="font-semibold">{estimatedFare.duration} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vehicle</span>
                        <span className="font-semibold capitalize">{formData.vehicle_type}</span>
                      </div>
                      {estimatedFare.pickupETA && (
                        <>
                          <div className="border-t pt-2 mt-2"></div>
                          <div className="flex justify-between text-green-600">
                            <span>🕒 Pickup ETA</span>
                            <span className="font-semibold">{estimatedFare.pickupETA}</span>
                          </div>
                          <div className="flex justify-between text-blue-600">
                            <span>🏁 Drop-off ETA</span>
                            <span className="font-semibold">{estimatedFare.dropoffETA}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="text-xs text-gray-500">
                        * Actual fare may vary based on traffic and route
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      Select pickup and destination to see fare estimate
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}