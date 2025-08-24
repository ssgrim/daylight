const toRad = (d) => (d * Math.PI) / 180;
export const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) *
            Math.cos(toRad(b.lat)) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
};
export function scoreCandidates(nowAnchor, candidates, prefs, contextCrowdLevel = 0) {
    const w = prefs.weights;
    return candidates
        .map((c) => {
        const distKm = nowAnchor ? haversineKm(nowAnchor.location, c.location) : 0;
        const distPenalty = -w.distance * Math.min(1, distKm / 50);
        const ratingTerm = w.rating * ((c.rating ?? 3.5) / 5);
        const openTerm = w.openNow * 1; // stub: assume open if no hours provided
        const catTerm = (c.categories || []).reduce((acc, cat) => acc + (w.categoryAffinity[cat] ?? 0), 0) /
            Math.max(1, (c.categories || []).length);
        const weatherTerm = -w.weather * 0;
        const crowdTerm = -w.crowding * Math.max(contextCrowdLevel, 0);
        const costTerm = -w.cost * (c.costIndex ?? 0.3);
        const terms = { distPenalty, ratingTerm, openTerm, catTerm, weatherTerm, crowdTerm, costTerm };
        const score = Object.values(terms).reduce((a, b) => a + b, 0);
        return { id: c.id, score, terms };
    })
        .sort((a, b) => b.score - a.score);
}
