import { useState, useEffect } from 'react'
import { Users, Car, MapPin, Plane, Calendar, DollarSign, LogOut, CheckCircle, XCircle } from 'lucide-react'
import { adminService, vacationService } from '../services/api'
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
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const { logout } = useAuthStore()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsData, usersData, vacationsData] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers(),
        vacationService.getVacations()
      ])
      setStats(statsData)
      setUsers(usersData)
      setVacations(vacationsData)
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
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                  <span className="text-primary-600 font-bold">
                                    {user.name.charAt(0)}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`badge ${
                              user.role === 'admin' ? 'badge-primary' :
                              user.role === 'driver' ? 'badge-warning' :
                              'badge-secondary'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`badge ${
                              user.is_active ? 'badge-success' : 'badge-danger'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
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
              <div className="space-y-4">
                {vacations.length === 0 ? (
                  <div className="text-center py-12">
                    <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No vacation bookings found</p>
                  </div>
                ) : (
                  vacations.map((vacation) => (
                    <div key={vacation.id} className={`border rounded-lg p-4 ${
                      vacation.status === 'pending' ? 'border-yellow-300 bg-yellow-50' :
                      vacation.status === 'confirmed' ? 'border-green-300 bg-green-50' :
                      'border-gray-300 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-5 h-5 text-primary-600" />
                          <h3 className="text-lg font-bold">{vacation.destination}</h3>
                        </div>
                        <span className={`badge ${
                          vacation.status === 'pending' ? 'badge-warning' :
                          vacation.status === 'confirmed' ? 'badge-success' :
                          'badge-secondary'
                        }`}>
                          {vacation.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Booking Ref</p>
                          <p className="font-medium">#{vacation.booking_reference}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Dates</p>
                          <p className="font-medium">
                            {new Date(vacation.start_date).toLocaleDateString()} - {new Date(vacation.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Travelers</p>
                          <p className="font-medium">{vacation.passengers}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Price</p>
                          <p className="font-bold text-primary-600">₹{vacation.total_price.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm mb-4">
                        {vacation.ride_included && (
                          <span className="flex items-center text-green-600">
                            <Car className="w-4 h-4 mr-1" />
                            Transport
                          </span>
                        )}
                        {vacation.hotel_included && (
                          <span className="flex items-center text-green-600">
                            <Plane className="w-4 h-4 mr-1" />
                            Hotel
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        {vacation.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmVacation(vacation.id)}
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Confirm
                            </button>
                            <button
                              onClick={() => handleCancelVacation(vacation.id)}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel
                            </button>
                          </>
                        )}
                        {vacation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelVacation(vacation.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}