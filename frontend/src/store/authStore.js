import { create } from 'zustand'

// Get role from URL or default to 'rider'
const getRoleFromUrl = () => {
  if (typeof window === 'undefined') return 'rider'
  
  const port = window.location.port
  if (port === '6001') return 'driver' // Changed from 6000 to 6001
  if (port === '7001') return 'admin'
  return 'rider' // default
}

const getStorageKey = () => {
  const role = getRoleFromUrl()
  return `auth-storage-${role}`
}

export const useAuthStore = create(
  (set, get) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    role: getRoleFromUrl(),
    
    login: (token, user) => {
      const storageKey = getStorageKey()
      localStorage.setItem(`${storageKey}-token`, token)
      localStorage.setItem(`${storageKey}-user`, JSON.stringify(user))
      set({ token, user, isAuthenticated: true, role: user.role })
    },
    
    logout: () => {
      const storageKey = getStorageKey()
      localStorage.removeItem(`${storageKey}-token`)
      localStorage.removeItem(`${storageKey}-user`)
      set({ token: null, user: null, isAuthenticated: false })
    },
    
    updateUser: (user) => set({ user }),
    
    // Initialize from storage
    initFromStorage: () => {
      const storageKey = getStorageKey()
      const token = localStorage.getItem(`${storageKey}-token`)
      const userStr = localStorage.getItem(`${storageKey}-user`)
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr)
          set({ token, user, isAuthenticated: true, role: user.role })
        } catch (e) {
          console.error('Failed to parse user from storage:', e)
          // Clear invalid storage
          localStorage.removeItem(`${storageKey}-token`)
          localStorage.removeItem(`${storageKey}-user`)
        }
      }
    },
    
    // Clear all auth storage (useful for debugging)
    clearAllAuth: () => {
      // Clear all possible auth storage keys
      const keys = ['rider', 'driver', 'admin']
      keys.forEach(role => {
        localStorage.removeItem(`auth-storage-${role}-token`)
        localStorage.removeItem(`auth-storage-${role}-user`)
      })
      set({ token: null, user: null, isAuthenticated: false })
    }
  })
)