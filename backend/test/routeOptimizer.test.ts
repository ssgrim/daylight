import { optimizeRoute, Stop } from "../src/lib/routeOptimizer";

describe("Route Optimizer", () => {
  it("should return the correct route for two stops", () => {
    const stops: Stop[] = [
      { id: "1", lat: 40.7128, lon: -74.006 },
      { id: "2", lat: 34.0522, lon: -118.2437 },
    ];

    const result = optimizeRoute(stops);

    expect(result.order).toEqual(["1", "2"]);
    expect(result.totalDistance).toBeGreaterThan(0);
    expect(result.totalTime).toBeGreaterThan(0);
  });

  it("should handle time window violations", () => {
    const stops: Stop[] = [
      { id: "1", lat: 40.7128, lon: -74.006 },
      { id: "2", lat: 34.0522, lon: -118.2437, timeWindow: [0, 1000] },
    ];

    const result = optimizeRoute(stops, { startTime: 2000 });

    expect(result.violations).toBeDefined();
    expect(result.violations?.length).toBeGreaterThan(0);
  });

  it("should calculate the correct score", () => {
    const stops: Stop[] = [
      { id: "1", lat: 40.7128, lon: -74.006, rating: 5 },
      { id: "2", lat: 34.0522, lon: -118.2437, rating: 4 },
    ];

    const result = optimizeRoute(stops);

    expect(result.score).toBeGreaterThan(0);
    expect(result.averageRating).toBeCloseTo(4.5, 1);
  });

  it("should return an empty route for no stops", () => {
    const stops: Stop[] = [];

    const result = optimizeRoute(stops);

    expect(result.order).toEqual([]);
    expect(result.totalDistance).toBe(0);
    expect(result.totalTime).toBe(0);
  });

  it("should handle a single stop correctly", () => {
    const stops: Stop[] = [
      { id: "1", lat: 40.7128, lon: -74.006 },
    ];

    const result = optimizeRoute(stops);

    expect(result.order).toEqual(["1"]);
    expect(result.totalDistance).toBe(0);
    expect(result.totalTime).toBe(0);
  });

  it("should handle stops with the same location", () => {
    const stops: Stop[] = [
      { id: "1", lat: 40.7128, lon: -74.006 },
      { id: "2", lat: 40.7128, lon: -74.006 },
    ];

    const result = optimizeRoute(stops);

    expect(result.order).toEqual(["1", "2"]);
    expect(result.totalDistance).toBe(0);
    expect(result.totalTime).toBe(0);
  });
});
