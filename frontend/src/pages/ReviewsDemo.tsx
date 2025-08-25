import React from 'react';
import { ReviewsList } from '../components/ReviewsList';
import { StarRating } from '../components/StarRating';

// Demo data for development
const demoLocationRating = {
  locationId: 'demo-location',
  averageRating: 4.2,
  totalReviews: 127,
  ratingDistribution: {
    5: 45,
    4: 38,
    3: 22,
    2: 15,
    1: 7
  }
};

const demoReviews = [
  {
    id: 'review-1',
    locationId: 'demo-location',
    locationName: 'Demo Location',
    userId: 'user-1',
    userName: 'Sarah Johnson',
    rating: 5,
    content: 'Absolutely fantastic experience! The service was impeccable and the atmosphere was perfect for our anniversary dinner. The staff went above and beyond to make our evening special.',
    tags: ['Great Service', 'Romantic', 'Excellent Food'],
    photos: [],
    createdAt: '2024-01-15T18:30:00Z',
    updatedAt: '2024-01-15T18:30:00Z',
    helpfulVotes: 12,
    unhelpfulVotes: 0,
    verified: true,
    flagged: false
  },
  {
    id: 'review-2',
    locationId: 'demo-location',
    locationName: 'Demo Location',
    userId: 'user-2',
    userName: 'Mike Chen',
    rating: 4,
    content: 'Really good food and nice ambiance. The only downside was the wait time - we had to wait about 30 minutes even with a reservation. But the food made up for it!',
    tags: ['Good Food', 'Long Wait'],
    photos: [],
    createdAt: '2024-01-12T19:45:00Z',
    updatedAt: '2024-01-12T19:45:00Z',
    helpfulVotes: 8,
    unhelpfulVotes: 1,
    verified: false,
    flagged: false,
    businessResponse: {
      businessName: 'Demo Restaurant',
      businessOwner: 'Restaurant Manager',
      content: 'Thank you for your feedback, Mike! We apologize for the wait time and are working on improving our reservation system. We\'re glad you enjoyed the food!',
      createdAt: '2024-01-13T10:00:00Z'
    }
  },
  {
    id: 'review-3',
    locationId: 'demo-location',
    locationName: 'Demo Location',
    userId: 'user-3',
    userName: 'Jessica Williams',
    rating: 3,
    content: 'Average experience. The food was okay but nothing special. Service was friendly but slow. Prices are a bit high for what you get.',
    tags: ['Average Food', 'Expensive', 'Slow Service'],
    photos: [],
    createdAt: '2024-01-10T20:15:00Z',
    updatedAt: '2024-01-10T20:15:00Z',
    helpfulVotes: 3,
    unhelpfulVotes: 2,
    verified: true,
    flagged: false
  }
];

export function ReviewsDemo() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Reviews & Ratings System Demo
          </h1>
          <p className="text-gray-600">
            A comprehensive demonstration of the reviews and ratings functionality
          </p>
        </div>

        {/* Star Rating Component Demo */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Star Rating Component
          </h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 w-24">Small:</span>
              <StarRating rating={4.5} size="sm" />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 w-24">Medium:</span>
              <StarRating rating={3.2} size="md" />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 w-24">Large:</span>
              <StarRating rating={5.0} size="lg" />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 w-24">Extra Large:</span>
              <StarRating rating={2.7} size="xl" />
            </div>
          </div>
        </div>

        {/* Interactive Rating Demo */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Interactive Rating
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Click on the stars to rate (interactive mode):
              </p>
              <StarRating 
                rating={0} 
                interactive 
                size="lg"
                onRatingChange={(rating) => console.log('Rating selected:', rating)}
              />
            </div>
          </div>
        </div>

        {/* Reviews List with Mock Data */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Reviews List (Demo Mode)
          </h2>
          
          {/* Mock Location Rating Summary */}
          <div className="mb-6 p-6 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Customer Reviews
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-gray-900 mr-2">
                      {demoLocationRating.averageRating.toFixed(1)}
                    </span>
                    <StarRating rating={demoLocationRating.averageRating} size="lg" />
                  </div>
                  <div className="text-sm text-gray-600">
                    Based on {demoLocationRating.totalReviews} reviews
                  </div>
                </div>
              </div>
              
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Write a Review
              </button>
            </div>

            {/* Rating Distribution */}
            <div className="mt-6">
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = demoLocationRating.ratingDistribution[rating as keyof typeof demoLocationRating.ratingDistribution] || 0;
                  const percentage = demoLocationRating.totalReviews > 0 
                    ? (count / demoLocationRating.totalReviews) * 100 
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

          {/* Individual Reviews */}
          <div className="space-y-4">
            {demoReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {review.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{review.userName}</h4>
                      <div className="flex items-center space-x-2">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                        {review.verified && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-3">
                  <p className="text-gray-700">{review.content}</p>
                </div>

                {/* Tags */}
                {review.tags && review.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {review.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Business Response */}
                {review.businessResponse && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-center mb-1">
                      <span className="text-sm font-semibold text-blue-900">
                        Response from {review.businessResponse.businessName}
                      </span>
                      <span className="ml-2 text-xs text-blue-600">
                        {new Date(review.businessResponse.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-blue-800">
                      {review.businessResponse.content}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V8a2 2 0 00-2-2H4.5A2.5 2.5 0 002 8.5V14a2.5 2.5 0 002.5 2.5H7l3 1.5L14 10z" />
                      </svg>
                      <span>Helpful ({review.helpfulVotes})</span>
                    </button>
                    
                    <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h8.5a2.5 2.5 0 002.5-2.5V9.5a2.5 2.5 0 00-2.5-2.5H17l-3-1.5L10 14z" />
                      </svg>
                      <span>({review.unhelpfulVotes})</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button className="text-sm text-gray-600 hover:text-yellow-600">
                      Flag
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mt-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">
            Implementation Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">✅ Completed</h3>
              <ul className="space-y-1">
                <li>• Star rating component (static & interactive)</li>
                <li>• Review cards with voting & flagging</li>
                <li>• Review form with validation</li>
                <li>• Zustand store for state management</li>
                <li>• API service layer</li>
                <li>• Rating distribution visualization</li>
                <li>• Business response system</li>
                <li>• Tag system</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🔄 Backend Features</h3>
              <ul className="space-y-1">
                <li>• DynamoDB schema for reviews</li>
                <li>• Lambda handlers for CRUD operations</li>
                <li>• Voting and flagging system</li>
                <li>• Location rating aggregation</li>
                <li>• User statistics tracking</li>
                <li>• Review moderation</li>
                <li>• Photo upload support (placeholder)</li>
                <li>• Comprehensive filtering & sorting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
