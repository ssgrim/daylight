# Solver Engine

This document describes the solver engine used by Daylight for multi-stop route optimization.

Overview
- For small numbers of stops (<= 8), Daylight uses an exact brute-force TSP search (permutation) that guarantees an optimal ordering.
- For larger numbers of stops, Daylight falls back to a simulated annealing (SA) metaheuristic to produce a high-quality route quickly.

Features
- Time window constraint handling: stops can specify a `timeWindow` as `[startEpochSec, endEpochSec]`. The solver penalizes or flags violations.
- Multi-objective scoring: distance, time, cost, and rating are combined into a single 0-100 score. Weights are configurable via the `weights` option passed to `optimizeRoute`.
- Simulated annealing parameters are conservative and tuned for typical use; they can be adjusted in `backend/src/lib/routeOptimizer.ts`.

Usage
Call the exported function `optimizeRoute(stops, options?)` where `stops` is an array of Stop objects and `options` may include `startTime` (epoch seconds) and `weights`.

Limitations & next steps
- OR-Tools integration and more advanced VRP/VRPTW support is planned for future work.
- Additional metaheuristics (genetic algorithms, TSPSolver) can be added and benchmarked.

