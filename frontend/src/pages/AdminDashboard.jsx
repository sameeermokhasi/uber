import { useState, useEffect } from 'react'
import { Users, Car, MapPin, Plane, Calendar, DollarSign, LogOut, CheckCircle, XCircle, Activity, Bell, Clock } from 'lucide-react'
import { adminService, vacationService, rideService } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRides: 0,
    totalDrivers: 0,
    totalRevenue: 0
  })
  const [users, setUsers] = useState([])
  const [vacations, setVacations] = useState([])
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const { logout } = useAuthStore()

  useEffect(() => {
    loadData()
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(() => {
      loadData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsData, usersData, vacationsData, ridesData] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers(),
        vacationService.getVacations(),
        rideService.getRides()
      ])
      setStats(statsData)
      setUsers(usersData)
      setVacations(vacationsData)
      setRides(ridesData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUserActive = async (userId) => {
    try {
      await adminService.toggleUserActive(userId)
      loadData()
    } catch (error) {
      console.error('Failed to toggle user status:', error)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await adminService.deleteUser(userId)
        loadData()
      } catch (error) {
        console.error('Failed to delete user:', error)
      }
    }
  }

  const handleConfirmVacation = async (id) => {
    try {
      await vacationService.confirmVacation(id)
      alert('Vacation booking confirmed successfully!')
      loadData()
    } catch (error) {
      console.error('Failed to confirm vacation:', error)
      alert('Failed to confirm vacation. Please try again.')
    }
  }

  const handleCancelVacation = async (id) => {
    if (window.confirm('Are you sure you want to cancel this vacation booking?')) {
      try {
        await vacationService.cancelVacation(id)
        alert('Vacation booking cancelled successfully!')
        loadData()
      } catch (error) {
        console.error('Failed to cancel vacation:', error)
        alert('Failed to cancel vacation. Please try again.')
      }
    }
  }

  // Get recent activity for the dashboard
  const getRecentActivity = () => {
    const activity = []
    
    // Add ride activities
    rides.slice(0, 10).forEach(ride => {
      activity.push({
        id: `ride-${ride.id}`,
        type: 'ride',
        action: ride.status,
        user: ride.rider?.name || 'Unknown Rider',
        timestamp: ride.created_at,
        details: `${ride.pickup_address} to ${ride.destination_address}`
      })
    })
    
    // Add vacation activities
    vacations.slice(0, 10).forEach(vacation => {
      activity.push({
        id: `vacation-${vacation.id}`,
        type: 'vacation',
        action: vacation.status,
        user: vacation.user?.name || 'Unknown User',
        timestamp: vacation.created_at,
        details: `Trip to ${vacation.destination}`
      })
    })
    
    // Sort by timestamp
    return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 15)
  }

  const getActivityIcon = (type, action) => {
    if (type === 'ride') {
      if (action === 'accepted') return <CheckCircle className="w-5 h-5 text-green-500" />
      if (action === 'in_progress') return <Activity className="w-5 h-5 text-blue-500" />
      if (action === 'completed') return <CheckCircle className="w-5 h-5 text-purple-500" />
      if (action === 'cancelled') return <XCircle className="w-5 h-5 text-red-500" />
      return <Car className="w-5 h-5 text-gray-500" />
    } else {
      if (action === 'confirmed') return <CheckCircle className="w-5 h-5 text-green-500" />
      if (action === 'pending') return <Clock className="w-5 h-5 text-yellow-500" />
      if (action === 'cancelled') return <XCircle className="w-5 h-5 text-red-500" />
      return <Plane className="w-5 h-5 text-gray-500" />
    }
  }

  const getActivityColor = (type, action) => {
    if (type === 'ride') {
      if (action === 'accepted') return 'bg-green-100 text-green-800'
      if (action === 'in_progress') return 'bg-blue-100 text-blue-800'
      if (action === 'completed') return 'bg-purple-100 text-purple-800'
      if (action === 'cancelled') return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
    } else {
      if (action === 'confirmed') return 'bg-green-100 text-green-800'
      if (action === 'pending') return 'bg-yellow-100 text-yellow-800'
      if (action === 'cancelled') return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
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
              <span className="text-2xl font-bold text-gray-900">Admin Dashboard</span>
            </div>
            <button onClick={logout} className="btn-outline text-sm">
              <LogOut className="w-4 h-4 inline mr-1" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium ${
              activeTab === 'overview'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-1 font-medium ${
              activeTab === 'users'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('vacations')}
            className={`pb-3 px-1 font-medium ${
              activeTab === 'vacations'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Vacation Bookings
          </button>
          <button
            onClick={() => setActiveTab('rides')}
            className={`pb-3 px-1 font-medium ${
              activeTab === 'rides'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Ride Management
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 px-1 font-medium ${
              activeTab === 'activity'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent Activity
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="card">
                  <div className="flex items-center">
                    <Users className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold">{stats.totalUsers}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="flex items-center">
                    <Car className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-gray-600">Total Rides</p>
                      <p className="text-2xl font-bold">{stats.totalRides}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="flex items-center">
                    <MapPin className="w-8 h-8 text-yellow-600 mr-3" />
                    <div>
                      <p className="text-gray-600">Total Drivers</p>
                      <p className="text-2xl font-bold">{stats.totalDrivers}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="flex items-center">
                    <DollarSign className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Recent Activity Preview */}
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <Activity className="w-6 h-6 mr-2" />
                Recent Activity
              </h2>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {getRecentActivity().slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center p-4 bg-gray-50 rounded-lg">
                      <div className="mr-4">
                        {getActivityIcon(activity.type, activity.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <p className="font-medium">{activity.user}</p>
                          <span className="text-sm text-gray-500">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{activity.details}</p>
                        <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${getActivityColor(activity.type, activity.action)}`}>
                          {activity.type === 'ride' ? 'Ride' : 'Vacation'}: {activity.action}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h1 className="text-3xl font-bold mb-8">User Management</h1>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-600 font-bold">{user.name.charAt(0)}</span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.is_active ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleToggleUserActive(user.id)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Vacations Tab */}
        {activeTab === 'vacations' && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Vacation Bookings</h1>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {vacations.map((vacation) => (
                  <div key={vacation.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{vacation.destination}</h3>
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
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(vacation.start_date).toLocaleDateString()} - {new Date(vacation.end_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {vacation.passengers} travelers
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="w-4 h-4 mr-2" />
                        ₹{vacation.total_price?.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {vacation.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirmVacation(vacation.id)}
                            className="btn-sm btn-success"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleCancelVacation(vacation.id)}
                            className="btn-sm btn-danger"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {vacation.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancelVacation(vacation.id)}
                          className="btn-sm btn-danger"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rides Tab */}
        {activeTab === 'rides' && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Ride Management</h1>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ride ID</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rider</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fare</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rides.map((ride) => (
                      <tr key={ride.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{ride.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ride.rider?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ride.driver?.name || 'Unassigned'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-xs truncate">
                            {ride.pickup_address} → {ride.destination_address}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            ride.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            ride.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                            ride.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                            ride.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {ride.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{ride.estimated_fare?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Recent Activity</h1>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {getRecentActivity().map((activity) => (
                  <div key={activity.id} className="card">
                    <div className="flex items-start">
                      <div className="mr-4 mt-1">
                        {getActivityIcon(activity.type, activity.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h3 className="font-bold text-lg">{activity.user}</h3>
                          <span className="text-sm text-gray-500">
                            {new Date(activity.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">{activity.details}</p>
                        <div className="flex items-center mt-2">
                          <span className={`inline-block px-3 py-1 text-sm rounded-full ${getActivityColor(activity.type, activity.action)}`}>
                            {activity.type === 'ride' ? 'Ride' : 'Vacation'}: {activity.action}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {getRecentActivity().length === 0 && (
                  <div className="text-center py-12">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No recent activity</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}