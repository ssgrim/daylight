
import React from 'react';
import { Link } from 'react-router-dom';
import { t, useLocale, type Locale } from '../i18n';

export default function Root() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-200 via-yellow-100 to-green-100 relative overflow-hidden">
      {/* Sun */}
      <div className="absolute top-8 right-16 w-24 h-24 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg">
        <div className="absolute inset-2 bg-gradient-to-br from-yellow-200 to-orange-300 rounded-full">
          <div className="absolute inset-2 bg-gradient-to-br from-yellow-100 to-orange-200 rounded-full"></div>
        </div>
      </div>

      {/* Sun rays */}
      <div className="absolute top-0 right-0 w-80 h-80 opacity-30">
        <div className="absolute top-16 right-20 w-1 h-16 bg-yellow-300 rotate-45 origin-bottom"></div>
        <div className="absolute top-12 right-24 w-1 h-12 bg-yellow-300 rotate-12 origin-bottom"></div>
        <div className="absolute top-10 right-32 w-1 h-14 bg-yellow-300 -rotate-12 origin-bottom"></div>
        <div className="absolute top-14 right-8 w-1 h-18 bg-yellow-300 rotate-75 origin-bottom"></div>
        <div className="absolute top-20 right-12 w-1 h-10 bg-yellow-300 rotate-90 origin-bottom"></div>
      </div>

      {/* Language selector */}
      <div className="absolute top-6 left-6 z-10">
        <div className="flex items-center bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <label className="mr-2 text-sm font-medium text-gray-700">Lang:</label>
          <select 
            value={locale} 
            onChange={e => setLocale(e.target.value as Locale)} 
            className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:outline-none focus:ring-0"
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </div>
      </div>

      {/* Background hills */}
      <div className="absolute bottom-0 left-0 w-full">
        {/* Back hills */}
        <svg viewBox="0 0 1200 300" className="w-full h-64 text-green-300/40">
          <path d="M0,300 L0,200 Q150,150 300,160 Q450,170 600,140 Q750,110 900,130 Q1050,150 1200,120 L1200,300 Z" fill="currentColor" />
        </svg>
        
        {/* Middle hills */}
        <svg viewBox="0 0 1200 250" className="w-full h-48 -mt-32 text-green-400/60">
          <path d="M0,250 L0,180 Q200,120 400,140 Q600,160 800,100 Q1000,140 1200,110 L1200,250 Z" fill="currentColor" />
        </svg>
        
        {/* Front hills */}
        <svg viewBox="0 0 1200 200" className="w-full h-32 -mt-24 text-green-500/80">
          <path d="M0,200 L0,140 Q300,80 600,120 Q900,160 1200,90 L1200,200 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Clouds */}
      <div className="absolute top-20 left-20 opacity-60">
        <svg width="80" height="40" viewBox="0 0 80 40" className="text-white">
          <ellipse cx="20" cy="25" rx="20" ry="15" fill="currentColor" />
          <ellipse cx="40" cy="20" rx="25" ry="18" fill="currentColor" />
          <ellipse cx="60" cy="25" rx="18" ry="12" fill="currentColor" />
        </svg>
      </div>
      
      <div className="absolute top-32 left-1/2 opacity-40">
        <svg width="60" height="30" viewBox="0 0 60 30" className="text-white">
          <ellipse cx="15" cy="20" rx="15" ry="10" fill="currentColor" />
          <ellipse cx="30" cy="15" rx="18" ry="12" fill="currentColor" />
          <ellipse cx="45" cy="20" rx="12" ry="8" fill="currentColor" />
        </svg>
      </div>

      {/* Floating particles for atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-200 rounded-full opacity-50 animate-float"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-orange-200 rounded-full opacity-60 animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-yellow-100 rounded-full opacity-40 animate-float-slow"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Main title with gradient text */}
          <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-orange-600 via-yellow-600 to-green-600 bg-clip-text text-transparent drop-shadow-lg">
            {t('title')}
          </h1>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-gray-700 mb-8 font-medium max-w-2xl mx-auto leading-relaxed">
            {t('slogan')}
          </p>

          {/* Call to action button */}
          <Link 
            to="/plan" 
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-orange-600 hover:to-yellow-600"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {t('openPlanner')}
          </Link>

          {/* Feature highlights */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/30">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Dawn Planning</h3>
              <p className="text-gray-600 text-sm">Start each day with purpose and clarity</p>
            </div>
            
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/30">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Growth Tracking</h3>
              <p className="text-gray-600 text-sm">Watch your progress bloom over time</p>
            </div>
            
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/30">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Mindful Living</h3>
              <p className="text-gray-600 text-sm">Cultivate peace and well-being daily</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wheat stalks decoration */}
      <div className="absolute bottom-20 left-10 opacity-30 animate-gentle-sway">
        <svg width="30" height="60" viewBox="0 0 30 60" className="text-yellow-600">
          <path d="M15 60 L15 30 M10 35 Q15 32 20 35 M10 40 Q15 37 20 40 M10 45 Q15 42 20 45 M10 50 Q15 47 20 50" 
                stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      
      <div className="absolute bottom-16 right-20 opacity-25 animate-gentle-sway" style={{animationDelay: '1s'}}>
        <svg width="25" height="50" viewBox="0 0 25 50" className="text-yellow-600">
          <path d="M12 50 L12 25 M8 30 Q12 27 16 30 M8 35 Q12 32 16 35 M8 40 Q12 37 16 40 M8 45 Q12 42 16 45" 
                stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
