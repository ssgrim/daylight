import React from 'react';
import { useParams } from 'react-router-dom';
import { ReviewsList } from '../components/ReviewsList';

export function ReviewsPage() {
  const { locationId } = useParams<{ locationId: string }>();
  
  if (!locationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Location Not Found
          </h1>
          <p className="text-gray-600">
            The location you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ReviewsList
          locationId={locationId}
          locationName="Selected Location"
          showWriteReview={true}
        />
      </div>
    </div>
  );
}
