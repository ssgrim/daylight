// routeOptimizer.ts
// Core logic for multi-stop route optimization (MVP: TSP solver)

export type Stop = {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  timeWindow?: [number, number]; // Optional: [start, end] in epoch seconds
};

export type RouteResult = {
  order: string[]; // Ordered list of stop IDs
  totalDistance: number; // in meters
  totalTime: number; // in seconds (MVP: just distance for now)
  violations?: string[]; // List of constraint violations (e.g., time window misses)
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

export function optimizeRoute(stops: Stop[], options?: { startTime?: number }): RouteResult {
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
    return { order, totalDistance, totalTime: totalDistance / 15, violations: violations.length ? violations : undefined };
  }
  let bestOrder: Stop[] = [];
  let minDist = Infinity;
  let bestViolations: string[] = [];
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
    // Prefer routes with fewer violations, then by distance
    if (
      violations.length < bestViolations.length ||
      (violations.length === bestViolations.length && dist < minDist) ||
      bestOrder.length === 0
    ) {
      minDist = dist;
      bestOrder = route;
      bestViolations = violations;
    }
  }
  return {
    order: bestOrder.map((s) => s.id),
    totalDistance: minDist,
    totalTime: minDist / 15,
    violations: bestViolations.length ? bestViolations : undefined,
  };
}
