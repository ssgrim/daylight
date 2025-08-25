import { create } from 'zustand';
import { UserProfile, SavedLocation, TripHistory, UserStats, UpdateProfileRequest, SaveLocationRequest } from '../../../shared/src/types/user';
import { profileService } from '../services/profileService';

interface ProfileStore {
  // State
  profile: UserProfile | null;
  stats: UserStats | null;
  locations: SavedLocation[];
  tripHistory: TripHistory[];
  loading: boolean;
  error: string | null;

  // Actions
  loadProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  loadLocations: () => Promise<void>;
  saveLocation: (data: SaveLocationRequest) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;
  loadTripHistory: () => Promise<void>;
  saveTripHistory: (data: Partial<TripHistory>) => Promise<void>;
  clearError: () => void;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  // Initial state
  profile: null,
  stats: null,
  locations: [],
  tripHistory: [],
  loading: false,
  error: null,

  // Actions
  loadProfile: async () => {
    set({ loading: true, error: null });
    try {
      const response = await profileService.getProfile();
      set({ 
        profile: response.profile, 
        stats: response.stats,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message, 
        loading: false 
      });
    }
  },

  updateProfile: async (data: UpdateProfileRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await profileService.updateProfile(data);
      set({ 
        profile: response.profile, 
        stats: response.stats,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message, 
        loading: false 
      });
    }
  },

  loadLocations: async () => {
    try {
      const locations = await profileService.getLocations();
      set({ locations });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  saveLocation: async (data: SaveLocationRequest) => {
    try {
      const location = await profileService.saveLocation(data);
      const currentLocations = get().locations;
      set({ locations: [...currentLocations, location] });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteLocation: async (locationId: string) => {
    try {
      await profileService.deleteLocation(locationId);
      const currentLocations = get().locations;
      set({ 
        locations: currentLocations.filter(loc => loc.id !== locationId) 
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  loadTripHistory: async () => {
    try {
      const tripHistory = await profileService.getTripHistory();
      set({ tripHistory });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  saveTripHistory: async (data: Partial<TripHistory>) => {
    try {
      const trip = await profileService.saveTripHistory(data);
      const currentTrips = get().tripHistory;
      set({ tripHistory: [...currentTrips, trip] });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));
