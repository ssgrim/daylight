import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`animate-pulse bg-gray-300 rounded ${className}`}
      style={style}
      data-testid="skeleton"
      aria-hidden="true"
    />
  );
}

export function PlaceResultSkeleton() {
  return (
    <div className="p-4 border-2 border-gray-200 rounded-lg" data-testid="place-skeleton" aria-hidden="true">
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SearchResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div data-testid="search-results-skeleton" aria-label="Loading search results">
      <Skeleton className="h-6 w-48 mb-3" />
      <div className="grid gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <PlaceResultSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
