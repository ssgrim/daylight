import React, { useState } from 'react';
import { Review } from '../../../shared/src/types/reviews';
import { StarRating } from './StarRating';
import { useReviewsStore } from '../stores/reviewsStore';

// Simple date formatter
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function ReviewCard({ review, showActions = true, compact = false, className = '' }: ReviewCardProps) {
  const { voteReview, deleteReview } = useReviewsStore();
  const [showFullText, setShowFullText] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (helpful: boolean) => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      await voteReview(review.id, helpful);
    } finally {
      setIsVoting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      await deleteReview(review.id);
    }
  };

  const truncatedText = review.content.length > 200 ? 
    review.content.substring(0, 200) + '...' : 
    review.content;

  const displayText = showFullText || compact ? review.content : truncatedText;
  const needsTruncation = review.content.length > 200 && !compact;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
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
                {formatDate(review.createdAt)}
              </span>
              {review.verified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-1">
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Review Content */}
      <div className="mb-3">
        <p className="text-gray-700 whitespace-pre-wrap">
          {displayText}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setShowFullText(!showFullText)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-1"
          >
            {showFullText ? 'Show less' : 'Read more'}
          </button>
        )}
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

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <div className="flex space-x-2 mb-3 overflow-x-auto">
          {review.photos.map((photo, index) => (
            <img
              key={index}
              src={photo}
              alt={`Review photo ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            />
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
              {formatDate(review.businessResponse.createdAt)}
            </span>
          </div>
          <p className="text-sm text-blue-800">
            {review.businessResponse.content}
          </p>
        </div>
      )}

      {/* Actions */}
      {showActions && !compact && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            {/* Helpful votes */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleVote(true)}
                disabled={isVoting}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V8a2 2 0 00-2-2H4.5A2.5 2.5 0 002 8.5V14a2.5 2.5 0 002.5 2.5H7l3 1.5L14 10z" />
                </svg>
                <span>Helpful ({review.helpfulVotes})</span>
              </button>
              
              <button
                onClick={() => handleVote(false)}
                disabled={isVoting}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h8.5a2.5 2.5 0 002.5-2.5V9.5a2.5 2.5 0 00-2.5-2.5H17l-3-1.5L10 14z" />
                </svg>
                <span>({review.unhelpfulVotes})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFlagModal(true)}
              className="text-sm text-gray-600 hover:text-yellow-600"
            >
              Flag
            </button>
            
            {/* Delete button - only show for own reviews */}
            <button
              onClick={handleDelete}
              className="text-sm text-gray-600 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Flag Modal - Simple implementation */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Flag Review</h3>
            <p className="text-gray-600 mb-4">
              Please select a reason for flagging this review:
            </p>
            <div className="space-y-2 mb-4">
              {['spam', 'inappropriate', 'fake', 'offensive', 'off-topic', 'other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    // Handle flag submission here
                    setShowFlagModal(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  {reason.charAt(0).toUpperCase() + reason.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFlagModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
