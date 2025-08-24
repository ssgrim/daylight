export type LatLng = {
    lat: number;
    lng: number;
};
export type Anchor = {
    id: string;
    name: string;
    location: LatLng;
};
export type PreferenceWeights = {
    distance: number;
    rating: number;
    openNow: number;
    categoryAffinity: Record<string, number>;
    weather: number;
    crowding: number;
    cost: number;
};
export type Prefs = {
    weights: PreferenceWeights;
};
export type LiveContext = {
    crowdLevelHint?: number;
    trafficLevel?: "low" | "med" | "high";
    weatherSummary?: string;
};
export type CandidateStop = {
    id: string;
    name: string;
    location: LatLng;
    categories?: string[];
    rating?: number;
    costIndex?: number;
};
export type Suggestion = {
    id: string;
    name: string;
    location: LatLng;
    score: number;
    breakdown: any;
    reason?: string;
};
export type PlanRequest = {
    tripId: string;
    atTime: string;
    anchors: Anchor[];
    prefs: Prefs;
    candidates?: CandidateStop[];
    context?: LiveContext;
};
export type PlanResponse = {
    suggestions: Suggestion[];
    eval?: any[];
};
export type Trip = {
    tripId: string;
    name: string;
    startsAt: string;
    endsAt: string;
    anchors: Anchor[];
    createdAt: string;
    updatedAt: string;
};
