import { Link } from 'react-router-dom'
import { Car, Plane, MapPin, Shield, Award, Clock } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <nav className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8" />
              <span className="text-2xl font-bold">Uber Vacation</span>
            </div>
            <div className="space-x-4">
              <Link to="/login" className="btn-outline text-white border-white hover:bg-white hover:text-primary-600">
                Login
              </Link>
              <Link to="/register" className="bg-white text-primary-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
                Sign Up
              </Link>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-slide-up">
            Your Complete Travel Solution
          </h1>
          <p className="text-xl md:text-2xl mb-10 text-primary-100 max-w-3xl mx-auto">
            Book rides, plan intercity trips, and create unforgettable vacation experiences - all in one platform
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl">
              Get Started
            </Link>
            <Link to="/login" className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200">
              Become a Driver
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-16">Why Choose Us</h2>
        <div className="grid md:grid-cols-3 gap-10">
          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <Car className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Local Rides</h3>
            <p className="text-gray-600">
              Quick and reliable rides within your city. Multiple vehicle options to suit your needs.
            </p>
          </div>

          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <MapPin className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Intercity Travel</h3>
            <p className="text-gray-600">
              Schedule comfortable rides between cities with transparent pricing and professional drivers.
            </p>
          </div>

          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <Plane className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Vacation Packages</h3>
            <p className="text-gray-600">
              Complete vacation planning with transportation, accommodation, and premium services.
            </p>
          </div>

          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <Shield className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Safe & Secure</h3>
            <p className="text-gray-600">
              Verified drivers, real-time tracking, and 24/7 support for your safety and peace of mind.
            </p>
          </div>

          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <Award className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Loyalty Rewards</h3>
            <p className="text-gray-600">
              Earn points on every ride and vacation. Unlock exclusive benefits and discounts.
            </p>
          </div>

          <div className="card text-center hover:scale-105 transition-transform duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-4 rounded-full">
                <Clock className="w-10 h-10 text-primary-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">24/7 Availability</h3>
            <p className="text-gray-600">
              Book rides anytime, anywhere. Our drivers are ready to serve you round the clock.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Your Journey?</h2>
          <p className="text-xl mb-8">Join thousands of satisfied customers today</p>
          <Link to="/register" className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-10 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl inline-block">
            Sign Up Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-dark-900 text-gray-300 py-10">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Car className="w-6 h-6" />
            <span className="text-xl font-bold">Uber Vacation</span>
          </div>
          <p className="text-sm">© 2024 Uber Vacation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
