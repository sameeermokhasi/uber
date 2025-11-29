import api from '../lib/axios'

export const authService = {
  async register(data) {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  async login(email, password) {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  async registerDriver(userData, driverData) {
    const response = await api.post('/auth/driver/register', {
      ...userData,
      ...driverData
    })
    return response.data
  },
}

export const rideService = {
  async createRide(data) {
    const response = await api.post('/rides/', data)
    return response.data
  },

  async getRides(status = null) {
    const url = status ? `/rides/?status=${status}` : '/rides/'
    const response = await api.get(url)
    return response.data
  },

  async getAvailableRides() {
    const response = await api.get('/rides/available')
    return response.data
  },

  async getRide(id) {
    const response = await api.get(`/rides/${id}`)
    return response.data
  },

  async updateRide(id, data) {
    const response = await api.patch(`/rides/${id}`, data)
    return response.data
  },

  async rateRide(id, rating, feedback = null) {
    const response = await api.post(`/rides/${id}/rate`, { rating, feedback })
    return response.data
  },

  async cancelRide(id) {
    const response = await api.delete(`/rides/${id}`)
    return response.data
  },
}

export const userService = {
  async getCurrentUser() {
    const response = await api.get('/users/me')
    return response.data
  },

  async getDrivers(availableOnly = false) {
    const url = availableOnly ? '/users/drivers?available_only=true' : '/users/drivers'
    const response = await api.get(url)
    return response.data
  },

  async updateDriverLocation(lat, lng) {
    const response = await api.patch('/users/driver/location', { lat, lng })
    return response.data
  },

  async toggleDriverAvailability() {
    try {
      console.log('=== TOGGLE DRIVER AVAILABILITY START ===')
      console.log('Making API call to toggle driver availability')
      const response = await api.patch('/users/driver/availability')
      console.log('API response:', response)
      console.log('=== TOGGLE DRIVER AVAILABILITY END ===')
      return response.data
    } catch (error) {
      console.error('API Error in toggleDriverAvailability:', error)
      console.error('Error response:', error.response)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      throw error
    }
  },
}

export const adminService = {
  async getStats() {
    const response = await api.get('/admin/stats')
    return response.data
  },

  async getUsers(role = null) {
    const url = role ? `/admin/users?role=${role}` : '/admin/users'
    const response = await api.get(url)
    return response.data
  },

  async toggleUserActive(userId) {
    const response = await api.patch(`/admin/users/${userId}/toggle-active`)
    return response.data
  },

  async deleteUser(userId) {
    const response = await api.delete(`/admin/users/${userId}`)
    return response.data
  },
}

export const vacationService = {
  async createVacation(data) {
    const response = await api.post('/vacation/', data)
    return response.data
  },

  async getVacations() {
    const response = await api.get('/vacation/')
    return response.data
  },

  async getAvailableVacations() {
    const response = await api.get('/vacation/available')
    return response.data
  },

  async getVacation(id) {
    const response = await api.get(`/vacation/${id}`)
    return response.data
  },

  async cancelVacation(id) {
    const response = await api.delete(`/vacation/${id}`)
    return response.data
  },

  async confirmVacation(id) {
    const response = await api.patch(`/vacation/${id}/confirm`)
    return response.data
  },

  async rejectVacation(id) {
    const response = await api.patch(`/vacation/${id}/reject`)
    return response.data
  },

  async getLoyaltyPoints() {
    const response = await api.get('/vacation/loyalty/points')
    return response.data
  },
}

export const vacationSchedulerService = {
  async scheduleVacationRides(vacationId) {
    const response = await api.post(`/scheduler/vacation/${vacationId}/schedule-rides`)
    return response.data
  },
}

// Add the missing intercityService
export const intercityService = {
  async getCities() {
    const response = await api.get('/intercity/cities')
    return response.data
  },

  async getRides() {
    const response = await api.get('/intercity/rides')
    return response.data
  },

  async createRide(data) {
    const response = await api.post('/intercity/rides', data)
    return response.data
  },

  async acceptRide(rideId) {
    const response = await api.patch(`/intercity/rides/${rideId}/accept`)
    return response.data
  },
}