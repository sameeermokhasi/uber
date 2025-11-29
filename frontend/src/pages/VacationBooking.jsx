import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Hotel, Car, Calendar, Users, MapPin, DollarSign, Award, LogOut, Check, Clock, Utensils } from 'lucide-react'
import { vacationService } from '../services/api'
import { useAuthStore } from '../store/authStore'
import FixedVacationPackages from '../components/FixedVacationPackages';

export default function VacationBooking() {
  const [vacations, setVacations] = useState([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  // Parse schedule data if available
  const parseSchedule = (scheduleJson) => {
    try {
      return JSON.parse(scheduleJson);
    } catch (e) {
      return null;
    }
  }

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
              <span className="text-2xl font-bold text-gray-900">Automated Vacation Planner</span>
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
              <h1 className="text-4xl font-bold mb-4">Your Automated Vacation Planner</h1>
              <p className="text-lg text-purple-100 mb-6">
                Create a complete travel schedule with transportation, accommodation, and activities.
                Our system will automatically arrange all your rides based on your schedule.
              </p>
              <button
                onClick={() => navigate('/rider/vacation-planner')}
                className="bg-white text-purple-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg transition-colors duration-200 mr-4"
              >
                Create Custom Plan
              </button>
              <button
                onClick={() => navigate('/rider/fixed-packages')}
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-purple-600 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                View Fixed Packages
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

        {/* How It Works */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-6">How Our Automated Vacation Planner Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">1</div>
              <h3 className="text-lg font-bold mb-2">Create Your Schedule</h3>
              <p className="text-gray-600">Enter your flight details, meal preferences, and activities for each day</p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">2</div>
              <h3 className="text-lg font-bold mb-2">Automatic Ride Booking</h3>
              <p className="text-gray-600">Our system automatically books rides 30 minutes before each activity</p>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">3</div>
              <h3 className="text-lg font-bold mb-2">Enjoy Your Trip</h3>
              <p className="text-gray-600">Sit back and relax while we handle all your transportation needs</p>
            </div>
          </div>
        </div>

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
              {vacations.map((vacation) => {
                const schedule = vacation.schedule ? parseSchedule(vacation.schedule) : null;
                
                return (
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
                      
                      {/* Display schedule information if available */}
                      {schedule && (
                        <div className="mt-3 p-3 bg-white rounded-lg border">
                          <h4 className="font-bold text-sm mb-2">Trip Schedule</h4>
                          {schedule.flightDetails && (
                            <p className="text-xs text-gray-600 mb-1">Flight: {schedule.flightDetails}</p>
                          )}
                          {schedule.mealTimings && (
                            <p className="text-xs text-gray-600 mb-1">Meals: {schedule.mealTimings}</p>
                          )}
                          {schedule.activities && (
                            <p className="text-xs text-gray-600">Activities: {schedule.activities.substring(0, 50)}...</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-xl font-bold">{vacation.total_price?.toFixed(2)}</span>
                      </div>
                      <div className="flex space-x-2">
                        {vacation.status === 'pending' && (
                          <button className="btn-sm btn-outline">
                            <Clock className="w-4 h-4 mr-1" />
                            Pending Approval
                          </button>
                        )}
                        {vacation.status === 'confirmed' && (
                          <button className="btn-sm btn-success">
                            <Check className="w-4 h-4 mr-1" />
                            Confirmed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}