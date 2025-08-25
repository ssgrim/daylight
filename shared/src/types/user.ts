// User profile and preferences types
export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  avatar?: string;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
  preferences: UserPreferences;
  privacySettings: PrivacySettings;
}

export interface UserPreferences {
  // Travel preferences
  travelStyle?: 'budget' | 'mid-range' | 'luxury';
  pace?: 'relaxed' | 'moderate' | 'packed';
  groupSize?: 'solo' | 'couple' | 'small-group' | 'large-group';
  
  // Accessibility needs
  accessibility?: {
    mobilityAssistance?: boolean;
    visualImpairment?: boolean;
    hearingImpairment?: boolean;
    cognitiveAssistance?: boolean;
    wheelchairAccess?: boolean;
  };
  
  // Dietary restrictions
  dietary?: {
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    kosher?: boolean;
    halal?: boolean;
    allergies?: string[];
    dislikes?: string[];
  };
  
  // Interests and categories
  interests?: {
    outdoor?: boolean;
    culture?: boolean;
    food?: boolean;
    nightlife?: boolean;
    shopping?: boolean;
    history?: boolean;
    art?: boolean;
    music?: boolean;
    sports?: boolean;
    family?: boolean;
  };
  
  // Time preferences
  timePreferences?: {
    earliestStart?: string; // HH:MM format
    latestEnd?: string; // HH:MM format
    maxWalkingDistance?: number; // in meters
    maxDrivingTime?: number; // in minutes
  };
  
  // Weather preferences
  weather?: {
    minTemperature?: number; // Celsius
    maxTemperature?: number; // Celsius
    rainTolerance?: 'none' | 'light' | 'moderate' | 'any';
    windTolerance?: 'none' | 'light' | 'moderate' | 'any';
  };
  
  // Budget preferences
  budget?: {
    dailyBudget?: number;
    currency?: string;
    includeTransport?: boolean;
    includeMeals?: boolean;
    includeActivities?: boolean;
  };
}

export interface PrivacySettings {
  shareProfile?: boolean;
  shareTrips?: boolean;
  shareLocation?: boolean;
  sharePreferences?: boolean;
  allowRecommendations?: boolean;
  marketingEmails?: boolean;
  analyticsTracking?: boolean;
}

export interface SavedLocation {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  type: 'home' | 'work' | 'favorite' | 'wishlist';
  notes?: string;
  tags?: string[];
  createdAt: string; // ISO date-time
  visitedAt?: string; // ISO date-time
}

export interface TripHistory {
  id: string;
  userId: string;
  tripId: string;
  tripName: string;
  startDate: string; // ISO date-time
  endDate: string; // ISO date-time
  locations: SavedLocation[];
  rating?: number; // 1-5
  notes?: string;
  photos?: string[]; // URLs
  shared?: boolean;
  createdAt: string; // ISO date-time
}

export interface UserStats {
  totalTrips: number;
  totalLocations: number;
  favoriteCategories: string[];
  averageRating: number;
  milesExplored: number;
  countriesVisited: number;
  citiesVisited: number;
}

// API request/response types
export interface UpdateProfileRequest {
  displayName?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
  privacySettings?: Partial<PrivacySettings>;
}

export interface SaveLocationRequest {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  type: SavedLocation['type'];
  notes?: string;
  tags?: string[];
}

export interface ProfileResponse {
  profile: UserProfile;
  stats: UserStats;
}
