import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Profile from '../pages/Profile';

// Mock the profile store
vi.mock('../stores/profileStore', () => ({
  useProfileStore: vi.fn(() => ({
    profile: {
      userId: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      avatar: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      preferences: {
        travelStyle: 'mid-range',
        pace: 'moderate',
        interests: { outdoor: true, culture: false }
      },
      privacySettings: {
        shareProfile: false,
        shareTrips: true,
        allowRecommendations: true
      }
    },
    stats: {
      totalTrips: 5,
      totalLocations: 12,
      favoriteCategories: ['outdoor', 'culture'],
      averageRating: 4.2,
      milesExplored: 1250,
      countriesVisited: 3,
      citiesVisited: 8
    },
    locations: [
      {
        id: 'loc1',
        userId: 'test-user',
        name: 'Central Park',
        lat: 40.7829,
        lng: -73.9654,
        type: 'favorite',
        tags: ['park', 'nature']
      }
    ],
    tripHistory: [
      {
        id: 'trip1',
        userId: 'test-user',
        tripId: 'trip-123',
        tripName: 'New York Weekend',
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-01-17T00:00:00Z',
        rating: 4,
        notes: 'Great city break!'
      }
    ],
    loading: false,
    error: null,
    loadProfile: vi.fn(),
    updateProfile: vi.fn(),
    loadLocations: vi.fn(),
    loadTripHistory: vi.fn(),
    clearError: vi.fn()
  }))
}));

const renderProfile = () => {
  return render(
    <BrowserRouter>
      <Profile />
    </BrowserRouter>
  );
};

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile information', () => {
    renderProfile();
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('5 trips')).toBeInTheDocument();
    expect(screen.getByText('12 saved places')).toBeInTheDocument();
    expect(screen.getByText('3 countries')).toBeInTheDocument();
  });

  it('shows profile tabs', () => {
    renderProfile();
    
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Travel Preferences')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Saved Places')).toBeInTheDocument();
    expect(screen.getByText('Trip History')).toBeInTheDocument();
  });

  it('allows switching between tabs', async () => {
    renderProfile();
    
    // Click on preferences tab
    fireEvent.click(screen.getByText('Travel Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Travel Style')).toBeInTheDocument();
    });

    // Click on privacy tab
    fireEvent.click(screen.getByText('Privacy'));
    await waitFor(() => {
      expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
    });
  });

  it('shows saved locations', async () => {
    renderProfile();
    
    fireEvent.click(screen.getByText('Saved Places'));
    await waitFor(() => {
      expect(screen.getByText('Central Park')).toBeInTheDocument();
    });
  });

  it('shows trip history', async () => {
    renderProfile();
    
    fireEvent.click(screen.getByText('Trip History'));
    await waitFor(() => {
      expect(screen.getByText('New York Weekend')).toBeInTheDocument();
      expect(screen.getByText('Great city break!')).toBeInTheDocument();
    });
  });

  it('allows editing profile', async () => {
    renderProfile();
    
    fireEvent.click(screen.getByText('Edit Profile'));
    
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});
