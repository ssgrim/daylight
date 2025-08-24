import type { Anchor, CandidateStop, Prefs } from "@daylight/shared";
export declare const haversineKm: (a: {
    lat: number;
    lng: number;
}, b: {
    lat: number;
    lng: number;
}) => number;
export declare function scoreCandidates(nowAnchor: Anchor | undefined, candidates: CandidateStop[], prefs: Prefs, contextCrowdLevel?: number): {
    id: string;
    score: number;
    terms: {
        distPenalty: number;
        ratingTerm: number;
        openTerm: number;
        catTerm: number;
        weatherTerm: number;
        crowdTerm: number;
        costTerm: number;
    };
}[];
