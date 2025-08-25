import React, { useEffect, useState } from 'react';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { StarRating } from './StarRating';
import { useReviewsStore } from '../stores/reviewsStore';
import { ReviewFilters } from '../../../shared/src/types/reviews';

interface ReviewsListProps {
  locationId?: string;
  locationName?: string;
  userId?: string;
  showWriteReview?: boolean;
  compact?: boolean;
  className?: string;
}

export function ReviewsList({ 
  locationId, 
  locationName = 'this location',
  userId, 
  showWriteReview = false, 
  compact = false,
  className = '' 
}: ReviewsListProps) {
  const { 
    reviews, 
    locationRating, 
    loading, 
    error, 
    currentFilters,
    loadLocationReviews, 
    loadUserReviews, 
    loadLocationRating,
    setFilters,
    clearError 
  } = useReviewsStore();
  
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [filterRating, setFilterRating] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (locationId) {
      loadLocationReviews(locationId, currentFilters);
      loadLocationRating(locationId);
    } else if (userId) {
      loadUserReviews(userId, currentFilters);
    }
  }, [locationId, userId, currentFilters]);

  const handleFilterChange = (newFilters: Partial<ReviewFilters>) => {
    setFilters(newFilters);
    
    // Reload reviews with new filters
    if (locationId) {
      loadLocationReviews(locationId, { ...currentFilters, ...newFilters });
    } else if (userId) {
      loadUserReviews(userId, { ...currentFilters, ...newFilters });
    }
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    handleFilterChange({ sortBy: newSortBy as any });
  };

  const handleRatingFilter = (rating: number) => {
    const newRating = filterRating === rating ? 0 : rating;
    setFilterRating(newRating);
    handleFilterChange({ rating: newRating || undefined });
  };

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading reviews</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button 
              onClick={clearError}
              className="text-red-600 hover:text-red-500 text-sm font-medium mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Location Rating Summary */}
      {locationId && locationRating && !compact && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Customer Reviews
              </h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-gray-900 mr-2">
                    {locationRating.averageRating.toFixed(1)}
                  </span>
                  <StarRating rating={locationRating.averageRating} size="lg" />
                </div>
                <div className="text-sm text-gray-600">
                  Based on {locationRating.totalReviews} review{locationRating.totalReviews !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            
            {showWriteReview && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Write a Review
              </button>
            )}
          </div>

          {/* Rating Distribution */}
          <div className="mt-6">
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = locationRating.ratingDistribution[rating] || 0;
                const percentage = locationRating.totalReviews > 0 
                  ? (count / locationRating.totalReviews) * 100 
                  : 0;
                
                return (
                  <div key={rating} className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700 w-8">
                      {rating}★
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Review Form Modal */}
      {showReviewForm && locationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ReviewForm
              locationId={locationId}
              locationName={locationName}
              onSubmit={() => setShowReviewForm(false)}
              onCancel={() => setShowReviewForm(false)}
            />
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      {!compact && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Sort Dropdown */}
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">
                  Sort by:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest">Highest rated</option>
                  <option value="lowest">Lowest rated</option>
                  <option value="helpful">Most helpful</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-sm font-medium text-gray-700">Filter:</span>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleRatingFilter(rating)}
                    className={`px-2 py-1 text-sm rounded ${
                      filterRating === rating
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {rating}★
                  </button>
                ))}
                {filterRating > 0 && (
                  <button
                    onClick={() => handleRatingFilter(0)}
                    className="text-xs text-gray-500 hover:text-gray-700 ml-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586a1 1 0 01-.293.707L9 19v-4.586a1 1 0 00-.293-.707L2.293 7.293A1 1 0 012 6.586V4z" />
              </svg>
              More Filters
            </button>
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 mr-2" />
                      <span className="text-sm">Verified reviews only</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 mr-2" />
                      <span className="text-sm">With photos</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Period
                  </label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option>All time</option>
                    <option>Last month</option>
                    <option>Last 3 months</option>
                    <option>Last year</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {loading && reviews.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h3>
            <p className="text-gray-600">
              {locationId 
                ? `Be the first to review ${locationName}!`
                : 'No reviews found matching your criteria.'
              }
            </p>
            {showWriteReview && locationId && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Write the First Review
              </button>
            )}
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              compact={compact}
              showActions={!compact}
            />
          ))
        )}

        {/* Loading more indicator */}
        {loading && reviews.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
