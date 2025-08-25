import React, { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import { useProfileStore } from '../stores/profileStore';
import { UserPreferences, PrivacySettings } from '../../../shared/src/types/user';

export default function Profile() {
  const {
    profile,
    stats,
    locations,
    tripHistory,
    loading,
    error,
    loadProfile,
    updateProfile,
    loadLocations,
    loadTripHistory,
    clearError
  } = useProfileStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'privacy' | 'locations' | 'history'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    avatar: ''
  });

  useEffect(() => {
    loadProfile();
    loadLocations();
    loadTripHistory();
  }, [loadProfile, loadLocations, loadTripHistory]);

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        avatar: profile.avatar || ''
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        displayName: formData.displayName,
        avatar: formData.avatar
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handlePreferenceChange = async (preferences: Partial<UserPreferences>) => {
    try {
      await updateProfile({ preferences });
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  };

  const handlePrivacyChange = async (privacySettings: Partial<PrivacySettings>) => {
    try {
      await updateProfile({ privacySettings });
    } catch (err) {
      console.error('Failed to update privacy settings:', err);
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              {profile?.avatar ? (
                <img src={profile.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-blue-600">
                  {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.displayName || profile?.email || 'User Profile'}
              </h1>
              <p className="text-gray-600">{profile?.email}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className="text-sm text-gray-500">
                  {stats?.totalTrips || 0} trips
                </span>
                <span className="text-sm text-gray-500">
                  {stats?.totalLocations || 0} saved places
                </span>
                <span className="text-sm text-gray-500">
                  {stats?.countriesVisited || 0} countries
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <p className="text-red-700">{error}</p>
              <button
                onClick={clearError}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'preferences', label: 'Travel Preferences' },
              { id: 'privacy', label: 'Privacy' },
              { id: 'locations', label: 'Saved Places' },
              { id: 'history', label: 'Trip History' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {activeTab === 'profile' && (
            <ProfileTab
              profile={profile}
              formData={formData}
              isEditing={isEditing}
              onFormChange={setFormData}
              onSave={handleSaveProfile}
              loading={loading}
            />
          )}

          {activeTab === 'preferences' && (
            <PreferencesTab
              preferences={profile?.preferences}
              onChange={handlePreferenceChange}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacyTab
              privacySettings={profile?.privacySettings}
              onChange={handlePrivacyChange}
            />
          )}

          {activeTab === 'locations' && (
            <LocationsTab locations={locations} />
          )}

          {activeTab === 'history' && (
            <HistoryTab tripHistory={tripHistory} />
          )}
        </div>
      </div>
      </div>
    </>
  );
}

// Profile Tab Component
function ProfileTab({ profile, formData, isEditing, onFormChange, onSave, loading }: any) {
  if (isEditing) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => onFormChange({ ...formData, displayName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your display name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Avatar URL
          </label>
          <input
            type="url"
            value={formData.avatar}
            onChange={(e) => onFormChange({ ...formData, avatar: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 text-gray-900">{profile?.email}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Display Name</label>
          <p className="mt-1 text-gray-900">{profile?.displayName || 'Not set'}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Member Since</label>
          <p className="mt-1 text-gray-900">
            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Updated</label>
          <p className="mt-1 text-gray-900">
            {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Preferences Tab Component
function PreferencesTab({ preferences, onChange }: any) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-gray-900">Travel Preferences</h2>
      
      {/* Travel Style */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Travel Style</h3>
        <div className="grid grid-cols-3 gap-3">
          {['budget', 'mid-range', 'luxury'].map((style) => (
            <button
              key={style}
              onClick={() => onChange({ travelStyle: style })}
              className={`p-3 text-center border rounded-lg transition-colors ${
                preferences?.travelStyle === style
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {style.charAt(0).toUpperCase() + style.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Pace */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Travel Pace</h3>
        <div className="grid grid-cols-3 gap-3">
          {['relaxed', 'moderate', 'packed'].map((pace) => (
            <button
              key={pace}
              onClick={() => onChange({ pace })}
              className={`p-3 text-center border rounded-lg transition-colors ${
                preferences?.pace === pace
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {pace.charAt(0).toUpperCase() + pace.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Interests</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            'outdoor', 'culture', 'food', 'nightlife', 'shopping',
            'history', 'art', 'music', 'sports', 'family'
          ].map((interest) => (
            <button
              key={interest}
              onClick={() => onChange({
                interests: {
                  ...preferences?.interests,
                  [interest]: !preferences?.interests?.[interest]
                }
              })}
              className={`p-2 text-sm text-center border rounded-lg transition-colors ${
                preferences?.interests?.[interest]
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {interest.charAt(0).toUpperCase() + interest.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Privacy Tab Component
function PrivacyTab({ privacySettings, onChange }: any) {
  const settings = [
    { key: 'shareProfile', label: 'Share Profile', description: 'Allow others to see your public profile' },
    { key: 'shareTrips', label: 'Share Trips', description: 'Allow others to see your trips' },
    { key: 'shareLocation', label: 'Share Location', description: 'Share your current location with the app' },
    { key: 'allowRecommendations', label: 'Recommendations', description: 'Receive personalized recommendations' },
    { key: 'marketingEmails', label: 'Marketing Emails', description: 'Receive promotional emails' },
    { key: 'analyticsTracking', label: 'Analytics', description: 'Help improve the app with usage data' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Privacy Settings</h2>
      
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{setting.label}</h3>
              <p className="text-sm text-gray-500">{setting.description}</p>
            </div>
            <button
              onClick={() => onChange({
                [setting.key]: !privacySettings?.[setting.key]
              })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                privacySettings?.[setting.key] ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  privacySettings?.[setting.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Locations Tab Component
function LocationsTab({ locations }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Saved Places</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Add Location
        </button>
      </div>
      
      {locations?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location: any) => (
            <div key={location.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{location.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  location.type === 'home' ? 'bg-green-100 text-green-800' :
                  location.type === 'work' ? 'bg-blue-100 text-blue-800' :
                  location.type === 'favorite' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {location.type}
                </span>
              </div>
              {location.address && (
                <p className="text-sm text-gray-600 mb-2">{location.address}</p>
              )}
              {location.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {location.tags.map((tag: string, index: number) => (
                    <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No saved places yet</p>
          <p className="text-sm">Save your favorite locations for quick access</p>
        </div>
      )}
    </div>
  );
}

// History Tab Component
function HistoryTab({ tripHistory }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Trip History</h2>
      
      {tripHistory?.length > 0 ? (
        <div className="space-y-4">
          {tripHistory.map((trip: any) => (
            <div key={trip.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{trip.tripName}</h3>
                {trip.rating && (
                  <div className="flex items-center">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`text-sm ${
                          i < trip.rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
              </p>
              {trip.notes && (
                <p className="text-sm text-gray-700 mt-2">{trip.notes}</p>
              )}
              <div className="mt-2 text-sm text-gray-500">
                {trip.locations?.length || 0} locations visited
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No trip history yet</p>
          <p className="text-sm">Your completed trips will appear here</p>
        </div>
      )}
    </div>
  );
}
