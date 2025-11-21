import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Hotel, Car, Calendar, Users, MapPin, DollarSign, Award, LogOut, Check } from 'lucide-react'
import { vacationService } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function VacationBooking() {
  const [vacations, setVacations] = useState([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  // Popular hotels in India
  const popularHotels = [
    { name: 'Taj Hotel', location: 'Mumbai', rating: 5 },
    { name: 'The Oberoi', location: 'Delhi', rating: 5 },
    { name: 'ITC Grand Chola', location: 'Chennai', rating: 5 },
    { name: 'The Leela Palace', location: 'Bangalore', rating: 5 },
    { name: 'Marriott Hotel', location: 'Goa', rating: 4 },
    { name: 'Hyatt Regency', location: 'Pune', rating: 4 },
    { name: 'Radisson Blu', location: 'Hyderabad', rating: 4 },
    { name: 'JW Marriott', location: 'Kolkata', rating: 5 },
    { name: 'The Lalit', location: 'Jaipur', rating: 4 },
    { name: 'Hilton', location: 'Mumbai', rating: 4 }
  ]

  const [formData, setFormData] = useState({
    destination: '',
    hotel_name: '',
    hotel_address: '',
    start_date: '',
    end_date: '',
    vehicle_type: 'economy',
    passengers: 2,
    ride_included: true,
    hotel_included: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [vacationsData, loyaltyData] = await Promise.all([
        vacationService.getVacations(),
        vacationService.getLoyaltyPoints()
      ])
      setVacations(vacationsData)
      setLoyaltyPoints(loyaltyData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Don't send status field - it should be set by the backend
      const vacationData = {
        destination: formData.destination,
        hotel_name: formData.hotel_name,
        hotel_address: formData.hotel_address,
        start_date: formData.start_date,
        end_date: formData.end_date,
        vehicle_type: formData.vehicle_type,
        passengers: formData.passengers,
        ride_included: formData.ride_included,
        hotel_included: formData.hotel_included
      }
      
      await vacationService.createVacation(vacationData)
      alert('Vacation package booked successfully! Status is now pending. A driver will confirm your booking shortly.')
      setShowBookingForm(false)
      loadData()
      setFormData({
        destination: '',
        hotel_name: '',
        hotel_address: '',
        start_date: '',
        end_date: '',
        vehicle_type: 'economy',
        passengers: 2,
        ride_included: true,
        hotel_included: true
      })
    } catch (error) {
      console.error('Failed to book vacation:', error)
      alert('Failed to book vacation. Please try again.')
    }
  }

  const handleCancel = async (id) => {
    if (window.confirm('Are you sure you want to cancel this vacation?')) {
      try {
        await vacationService.cancelVacation(id)
        alert('Vacation cancelled successfully')
        loadData()
      } catch (error) {
        console.error('Failed to cancel vacation:', error)
        alert('Failed to cancel vacation. Please try again.')
      }
    }
  }

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'bg-orange-100 text-orange-800',
      silver: 'bg-gray-200 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800'
    }
    return colors[tier] || colors.bronze
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Plane className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Vacation Packages</span>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/rider')} className="text-gray-600 hover:text-gray-900">
                ← Back to Dashboard
              </button>
              <button onClick={logout} className="btn-outline text-sm">
                <LogOut className="w-4 h-4 inline mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-2xl p-8 text-white mb-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">Your Dream Vacation Awaits</h1>
              <p className="text-lg text-purple-100 mb-6">
                Complete travel packages with transportation, accommodation, and exclusive perks.
              </p>
              <button
                onClick={() => setShowBookingForm(true)}
                className="bg-white text-purple-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Book Vacation Package
              </button>
            </div>

            {/* Loyalty Card */}
            {loyaltyPoints && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-6 ml-8">
                <div className="flex items-center space-x-2 mb-2">
                  <Award className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Loyalty Status</h3>
                </div>
                <p className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getTierColor(loyaltyPoints.tier)} mb-2`}>
                  {loyaltyPoints.tier.toUpperCase()} TIER
                </p>
                <p className="text-2xl font-bold">{loyaltyPoints.total_points} Points</p>
                <p className="text-sm text-purple-100 mt-2">{loyaltyPoints.benefits}</p>
              </div>
            )}
          </div>
        </div>

        {/* Booking Form Modal */}
        {showBookingForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-screen overflow-y-auto p-8">
              <h2 className="text-2xl font-bold mb-6">Create Your Vacation Package</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Destination */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Goa, Mumbai, Dubai"
                    required
                  />
                </div>

                {/* Dates */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                {/* Package Options */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold mb-3">Package Includes</h3>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.ride_included}
                      onChange={(e) => setFormData({ ...formData, ride_included: e.target.checked })}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="flex items-center space-x-2">
                      <Car className="w-5 h-5 text-primary-600" />
                      <span>Transportation (Airport transfers & local rides)</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hotel_included}
                      onChange={(e) => setFormData({ ...formData, hotel_included: e.target.checked })}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="flex items-center space-x-2">
                      <Hotel className="w-5 h-5 text-primary-600" />
                      <span>Hotel Accommodation</span>
                    </span>
                  </label>
                </div>

                {/* Hotel Details (if included) */}
                {formData.hotel_included && (
                  <div className="space-y-4 bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold">Hotel Information</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Name</label>
                      <select
                        value={formData.hotel_name}
                        onChange={(e) => setFormData({ ...formData, hotel_name: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select a hotel or type your own</option>
                        {popularHotels.map((hotel, idx) => (
                          <option key={idx} value={hotel.name}>
                            {hotel.name} - {hotel.location} ({'⭐'.repeat(hotel.rating)})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Or type custom hotel name below</p>
                      <input
                        type="text"
                        value={formData.hotel_name}
                        onChange={(e) => setFormData({ ...formData, hotel_name: e.target.value })}
                        className="input-field mt-2"
                        placeholder="Or enter custom hotel name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Address/Area</label>
                      <input
                        type="text"
                        value={formData.hotel_address}
                        onChange={(e) => setFormData({ ...formData, hotel_address: e.target.value })}
                        className="input-field"
                        placeholder="Preferred location or area"
                      />
                    </div>
                  </div>
                )}

                {/* Vehicle & Passengers */}
                {formData.ride_included && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                      <select
                        value={formData.vehicle_type}
                        onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                        className="input-field"
                      >
                        <option value="economy">Economy</option>
                        <option value="premium">Premium</option>
                        <option value="suv">SUV</option>
                        <option value="luxury">Luxury</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Number of Travelers</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.passengers}
                        onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) })}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    Book Vacation Package
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* My Vacations */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">My Vacation Bookings</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : vacations.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No vacation bookings yet</p>
              <p className="text-gray-400 mt-2">Start planning your dream vacation!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {vacations.map((vacation) => (
                <div key={vacation.id} className="border border-gray-200 rounded-xl p-6 hover:border-primary-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPin className="w-5 h-5 text-primary-600" />
                        <h3 className="text-xl font-bold">{vacation.destination}</h3>
                      </div>
                      <p className="text-sm text-gray-600">Booking #{vacation.booking_reference}</p>
                    </div>
                    <span className={`badge ${
                      vacation.status === 'confirmed' ? 'badge-success' : 
                      vacation.status === 'pending' ? 'badge-warning' :
                      vacation.status === 'cancelled' ? 'badge-danger' : 'badge'
                    }`}>
                      {vacation.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(vacation.start_date).toLocaleDateString()} - {new Date(vacation.end_date).toLocaleDateString()}
                    </div>

                    {vacation.hotel_name && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Hotel className="w-4 h-4 mr-2" />
                        {vacation.hotel_name}
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {vacation.passengers} traveler(s)
                    </div>

                    {vacation.vehicle_type && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Car className="w-4 h-4 mr-2" />
                        <span className="capitalize">{vacation.vehicle_type}</span> vehicle
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex items-center space-x-4 mb-3 text-sm">
                      {vacation.ride_included && (
                        <span className="flex items-center text-green-600">
                          <Check className="w-4 h-4 mr-1" />
                          Transport
                        </span>
                      )}
                      {vacation.hotel_included && (
                        <span className="flex items-center text-green-600">
                          <Check className="w-4 h-4 mr-1" />
                          Hotel
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-primary-600">
                        ₹{vacation.total_price.toFixed(2)}
                      </span>
                      {vacation.status === 'confirmed' && new Date(vacation.start_date) > new Date() && (
                        <button
                          onClick={() => handleCancel(vacation.id)}
                          className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Cancel Booking
                        </button>
                      )}
                      {vacation.status === 'pending' && (
                        <span className="text-sm text-yellow-600 font-medium">
                          ⏳ Awaiting confirmation
                        </span>
                      )}
                    </div>
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