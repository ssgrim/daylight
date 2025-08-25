import { UserProfile, SavedLocation, TripHistory, UserStats, UpdateProfileRequest, SaveLocationRequest, ProfileResponse } from '../../../shared/src/types/user';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export class ProfileService {
  private getAuthHeaders(): HeadersInit {
    // For development, we'll use a demo token
    // In production, this would get the real JWT token from auth store
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo-token'
    };
  }

  async getProfile(): Promise<ProfileResponse> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Profile doesn't exist, create a default one
        return this.createProfile({
          email: 'demo@example.com',
          displayName: 'Demo User'
        });
      }
      throw new Error(`Failed to get profile: ${response.status}`);
    }

    return response.json();
  }

  async createProfile(profileData: Partial<UserProfile>): Promise<ProfileResponse> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create profile: ${response.status}`);
    }

    return response.json();
  }

  async updateProfile(updateData: UpdateProfileRequest): Promise<ProfileResponse> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.status}`);
    }

    return response.json();
  }

  async getLocations(): Promise<SavedLocation[]> {
    const response = await fetch(`${API_BASE}/profile/locations`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get locations: ${response.status}`);
    }

    const data = await response.json();
    return data.locations || [];
  }

  async saveLocation(locationData: SaveLocationRequest): Promise<SavedLocation> {
    const response = await fetch(`${API_BASE}/profile/locations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(locationData)
    });

    if (!response.ok) {
      throw new Error(`Failed to save location: ${response.status}`);
    }

    const data = await response.json();
    return data.location;
  }

  async deleteLocation(locationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/profile/locations/${locationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to delete location: ${response.status}`);
    }
  }

  async getTripHistory(): Promise<TripHistory[]> {
    const response = await fetch(`${API_BASE}/profile/trips`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get trip history: ${response.status}`);
    }

    const data = await response.json();
    return data.trips || [];
  }

  async saveTripHistory(tripData: Partial<TripHistory>): Promise<TripHistory> {
    const response = await fetch(`${API_BASE}/profile/trips`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(tripData)
    });

    if (!response.ok) {
      throw new Error(`Failed to save trip history: ${response.status}`);
    }

    const data = await response.json();
    return data.trip;
  }
}

export const profileService = new ProfileService();
