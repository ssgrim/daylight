// OpenAPI-aligned types for Daylight API
// These types are shared between backend and frontend

export interface Anchor {
  id: string;
  name: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  lat: number;
  lng: number;
  locked?: boolean;
}

export interface TripCreate {
  tripId: string;
  name?: string;
  anchors?: Anchor[];
}

export interface Trip extends TripCreate {
  createdAt: string; // ISO date-time
}

export interface Prefs {
  heatMaxF?: number;
  driveCapMin?: number;
}

export interface PlanRequest {
  suggestFor: string;
  now?: string; // ISO date-time
}

export interface Suggestion {
  id: string;
  title: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  score: number;
  reason?: string;
}

export type PlanResponse = Suggestion[];
