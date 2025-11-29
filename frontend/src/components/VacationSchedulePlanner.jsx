import { useState } from 'react'
import { MapPin, Plane, Train, Car, Calendar, Clock, Plus, Trash2 } from 'lucide-react'
import { vacationService, vacationSchedulerService } from '../services/api'

export default function VacationSchedulePlanner() {
  const [tripDetails, setTripDetails] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    passengers: 1,
    vehicleType: 'economy',
    rideIncluded: true,
    hotelName: '', // Remove hotelIncluded since it's handled by rider
    hotelAddress: ''
  })

  const [flightDetails, setFlightDetails] = useState({
    departureCity: '',
    arrivalCity: '',
    departureTime: '',
    arrivalTime: '',
    flightNumber: ''
  })

  const [mealTimings, setMealTimings] = useState({
    breakfast: '',
    lunch: '',
    dinner: ''
  })

  const [activities, setActivities] = useState([])

  const [currentActivity, setCurrentActivity] = useState({
    time: '',
    location: '',
    description: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddActivity = () => {
    if (currentActivity.time && currentActivity.location && currentActivity.description) {
      setActivities([...activities, { ...currentActivity }]) // Create a copy of the object
      setCurrentActivity({
        time: '',
        location: '',
        description: ''
      })
    }
  }

  const handleRemoveActivity = (index) => {
    setActivities(activities.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Create schedule object
      const schedule = {
        flightDetails: flightDetails.flightNumber ? 
          `${flightDetails.departureCity} to ${flightDetails.arrivalCity} (${flightDetails.flightNumber})` : 
          '',
        mealTimings: `Breakfast: ${mealTimings.breakfast || 'N/A'}, Lunch: ${mealTimings.lunch || 'N/A'}, Dinner: ${mealTimings.dinner || 'N/A'}`,
        activities: activities.map(a => `${a.time} - ${a.location}: ${a.description}`).join('; ')
      }

      // Create vacation booking
      const vacationData = {
        ...tripDetails,
        schedule: JSON.stringify(schedule),
        flight_details: JSON.stringify(flightDetails),
        meal_preferences: JSON.stringify(mealTimings),
        activities: JSON.stringify(activities)
      }

      const response = await vacationService.createVacation(vacationData)
      alert('Vacation booking created successfully!')
      
      // Automatically schedule rides for the vacation
      if (response.id) {
        try {
          await vacationSchedulerService.scheduleVacationRides(response.id)
          alert('Automated rides scheduled successfully!')
        } catch (error) {
          console.error('Failed to schedule automated rides:', error)
          alert('Vacation created but failed to schedule automated rides. You can schedule them later.')
        }
      }
      
      // Reset form
      setTripDetails({
        destination: '',
        startDate: '',
        endDate: '',
        passengers: 1,
        vehicleType: 'economy',
        rideIncluded: true,
        hotelName: '',
        hotelAddress: ''
      })
      
      setFlightDetails({
        departureCity: '',
        arrivalCity: '',
        departureTime: '',
        arrivalTime: '',
        flightNumber: ''
      })
      
      setMealTimings({
        breakfast: '',
        lunch: '',
        dinner: ''
      })
      
      setActivities([])
    } catch (error) {
      console.error('Failed to create vacation booking:', error)
      alert('Failed to create vacation booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">✈️ Plan Your Automated Vacation</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Trip Details */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <MapPin className="w-6 h-6 mr-2" />
            Trip Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
              <input
                type="text"
                value={tripDetails.destination}
                onChange={(e) => setTripDetails({...tripDetails, destination: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Goa, India"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Name</label>
              <input
                type="text"
                value={tripDetails.hotelName}
                onChange={(e) => setTripDetails({...tripDetails, hotelName: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Taj Exotica Resort"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={tripDetails.startDate}
                onChange={(e) => setTripDetails({...tripDetails, startDate: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={tripDetails.endDate}
                onChange={(e) => setTripDetails({...tripDetails, endDate: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passengers</label>
              <select
                value={tripDetails.passengers}
                onChange={(e) => setTripDetails({...tripDetails, passengers: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'Passenger' : 'Passengers'}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              <select
                value={tripDetails.vehicleType}
                onChange={(e) => setTripDetails({...tripDetails, vehicleType: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="economy">Economy</option>
                <option value="premium">Premium</option>
                <option value="suv">SUV</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={tripDetails.rideIncluded}
                onChange={(e) => setTripDetails({...tripDetails, rideIncluded: e.target.checked})}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                <Car className="w-4 h-4 mr-1" />
                Include Transportation
              </span>
            </label>
            
            {/* Remove the INCLUDE HOTEL checkbox as it's handled by the rider */}
          </div>
        </div>
        
        {/* Flight/Train Details */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Plane className="w-6 h-6 mr-2" />
            Travel Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departure City</label>
              <input
                type="text"
                value={flightDetails.departureCity}
                onChange={(e) => setFlightDetails({...flightDetails, departureCity: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Bangalore"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arrival City</label>
              <input
                type="text"
                value={flightDetails.arrivalCity}
                onChange={(e) => setFlightDetails({...flightDetails, arrivalCity: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Goa"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departure Time</label>
              <input
                type="datetime-local"
                value={flightDetails.departureTime}
                onChange={(e) => setFlightDetails({...flightDetails, departureTime: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Time</label>
              <input
                type="datetime-local"
                value={flightDetails.arrivalTime}
                onChange={(e) => setFlightDetails({...flightDetails, arrivalTime: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Flight/Train Number</label>
              <input
                type="text"
                value={flightDetails.flightNumber}
                onChange={(e) => setFlightDetails({...flightDetails, flightNumber: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., AI-123 or 12345"
              />
            </div>
          </div>
        </div>
        
        {/* Meal Timings */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Meal Preferences
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Breakfast Time</label>
              <input
                type="time"
                value={mealTimings.breakfast}
                onChange={(e) => setMealTimings({...mealTimings, breakfast: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lunch Time</label>
              <input
                type="time"
                value={mealTimings.lunch}
                onChange={(e) => setMealTimings({...mealTimings, lunch: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dinner Time</label>
              <input
                type="time"
                value={mealTimings.dinner}
                onChange={(e) => setMealTimings({...mealTimings, dinner: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        
        {/* Activities Schedule */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Activities Schedule
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
              <input
                type="time"
                value={currentActivity.time}
                onChange={(e) => setCurrentActivity({...currentActivity, time: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={currentActivity.location}
                onChange={(e) => setCurrentActivity({...currentActivity, location: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Beach, Museum"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={currentActivity.description}
                onChange={(e) => setCurrentActivity({...currentActivity, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Activity details"
              />
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleAddActivity}
            className="btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </button>
          
          {activities.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-medium">Scheduled Activities</h3>
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{activity.time} - {activity.location}</p>
                    <p className="text-sm text-gray-600">{activity.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveActivity(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="text-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary btn-lg w-full md:w-auto"
          >
            {isSubmitting ? 'Creating Vacation...' : 'Create Automated Vacation Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}