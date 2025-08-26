// routeOptimizer.ts
// Core logic for multi-stop route optimization (MVP: TSP solver)

export type Stop = {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  timeWindow?: [number, number]; // Optional: [start, end] in epoch seconds
  rating?: number; // 1-5 rating score
  cost?: number; // Estimated cost in cents/smallest currency unit
  category?: string; // Activity category (food, attraction, etc.)
};

export type RouteResult = {
  order: string[]; // Ordered list of stop IDs
  totalDistance: number; // in meters
  totalTime: number; // in seconds
  totalCost?: number; // Total estimated cost in cents
  averageRating?: number; // Average rating of stops
  violations?: string[]; // List of constraint violations (e.g., time window misses)
  score: number; // Multi-objective optimization score (0-100)
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Multi-objective scoring function
function calculateRouteScore(
  stops: Stop[], 
  totalDistance: number, 
  totalTime: number,
  violations: string[],
  weights: { distance: number; time: number; cost: number; rating: number } = 
    { distance: 0.3, time: 0.3, cost: 0.2, rating: 0.2 }
): { score: number; totalCost?: number; averageRating?: number } {
  // Normalize metrics to 0-1 scale
  const maxDistance = 100000; // 100km max
  const maxTime = 43200; // 12 hours max
  const maxCost = 50000; // $500 max
  
  const distanceScore = Math.max(0, 1 - totalDistance / maxDistance);
  const timeScore = Math.max(0, 1 - totalTime / maxTime);
  
  const costs = stops.map(s => s.cost || 0);
  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  const costScore = Math.max(0, 1 - totalCost / maxCost);
  
  const ratings = stops.filter(s => s.rating).map(s => s.rating!);
  const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 3;
  const ratingScore = averageRating / 5;
  
  // Penalty for violations
  const violationPenalty = violations.length * 0.1;
  
  const score = Math.max(0, Math.min(100, (
    distanceScore * weights.distance +
    timeScore * weights.time +
    costScore * weights.cost +
    ratingScore * weights.rating
  ) * 100 - violationPenalty * 100));
  
  return { 
    score, 
    totalCost: totalCost > 0 ? totalCost : undefined,
    averageRating: ratings.length > 0 ? averageRating : undefined
  };
}
// Brute-force TSP for small N (MVP, N <= 8)
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permute(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

export function optimizeRoute(stops: Stop[], options?: { startTime?: number; weights?: { distance: number; time: number; cost: number; rating: number } }): RouteResult {
  // Default start time: now (epoch seconds)
  const tripStart = options?.startTime || Math.floor(Date.now() / 1000);
  if (stops.length <= 2) {
    const order = stops.map((s) => s.id);
    let totalDistance = 0;
    let violations: string[] = [];
    if (stops.length === 2) {
      totalDistance = haversine(stops[0].lat, stops[0].lon, stops[1].lat, stops[1].lon);
      // Check time windows if present
      if (stops[1].timeWindow) {
        const arrival = tripStart + totalDistance / 15;
        const [winStart, winEnd] = stops[1].timeWindow;
        if (arrival < winStart || arrival > winEnd) {
          violations.push(`Stop ${stops[1].id} arrival ${Math.round(arrival)} outside time window [${winStart}, ${winEnd}]`);
        }
      }
    }
    const totalTime = totalDistance / 15;
    const { score, totalCost, averageRating } = calculateRouteScore(stops, totalDistance, totalTime, violations, options?.weights);
    return { order, totalDistance, totalTime, violations: violations.length ? violations : undefined, score, totalCost, averageRating };
  }
  let bestOrder: Stop[] = [];
  let bestScore = -1;
  let bestResult: RouteResult = { order: [], totalDistance: 0, totalTime: 0, score: 0 };
  
  for (const perm of permute(stops.slice(1))) { // Fix first stop as start
    const route = [stops[0], ...perm];
    let dist = 0;
    let t = tripStart;
    let violations: string[] = [];
    for (let i = 0; i < route.length - 1; i++) {
      const segDist = haversine(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon);
      dist += segDist;
      t += segDist / 15; // Assume 15 m/s (54 km/h)
      // Check time window for next stop
      const tw = route[i + 1].timeWindow;
      if (tw) {
        const [winStart, winEnd] = tw;
        if (t < winStart || t > winEnd) {
          violations.push(`Stop ${route[i + 1].id} arrival ${Math.round(t)} outside time window [${winStart}, ${winEnd}]`);
        }
      }
    }
    const totalTime = dist / 15;
    const { score, totalCost, averageRating } = calculateRouteScore(route, dist, totalTime, violations, options?.weights);
    
    if (score > bestScore) {
      bestScore = score;
      bestOrder = route;
      bestResult = {
        order: route.map((s) => s.id),
        totalDistance: dist,
        totalTime,
        violations: violations.length ? violations : undefined,
        score,
        totalCost,
        averageRating
      };
    }
  }
  return bestResult;
}
