import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { useReviewsStore } from '../stores/reviewsStore';

interface ReviewFormProps {
  locationId: string;
  locationName: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function ReviewForm({ locationId, locationName, onSubmit, onCancel, className = '' }: ReviewFormProps) {
  const { createReview, loading } = useReviewsStore();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const commonTags = [
    'Clean', 'Friendly Staff', 'Good Value', 'Great Service', 'Quick Service',
    'Crowded', 'Noisy', 'Expensive', 'Long Wait', 'Poor Service'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (rating === 0) newErrors.rating = 'Please select a rating';
    if (content.trim().length < 10) newErrors.content = 'Review must be at least 10 characters';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await createReview({
        locationId,
        rating,
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
        photos: photos.length > 0 ? photos : undefined
      });

      // Reset form
      setRating(0);
      setContent('');
      setTags([]);
      setPhotos([]);
      setErrors({});
      
      onSubmit?.();
    } catch (error) {
      setErrors({ submit: 'Failed to submit review. Please try again.' });
    }
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleNewTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      addTag(newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Write a Review for {locationName}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Rating *
          </label>
          <StarRating
            rating={rating}
            interactive
            size="lg"
            onRatingChange={setRating}
          />
          {errors.rating && (
            <p className="text-red-600 text-sm mt-1">{errors.rating}</p>
          )}
        </div>

        {/* Review Content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            Your Review *
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your experience... What did you like? What could be improved?"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex justify-between items-center mt-1">
            {errors.content && (
              <p className="text-red-600 text-sm">{errors.content}</p>
            )}
            <span className="text-sm text-gray-500 ml-auto">
              {content.length}/500
            </span>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional)
          </label>
          
          {/* Selected Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Common Tags */}
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-2">Quick tags:</p>
            <div className="flex flex-wrap gap-2">
              {commonTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  disabled={tags.includes(tag) || tags.length >= 5}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Tag Input */}
          {tags.length < 5 && (
            <div>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleNewTagKeyPress}
                placeholder="Add a custom tag (press Enter)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos (Optional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Click to upload photos or drag and drop
            </p>
            <p className="text-xs text-gray-500">PNG, JPG up to 10MB each</p>
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="text-red-600 text-sm">{errors.submit}</div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
