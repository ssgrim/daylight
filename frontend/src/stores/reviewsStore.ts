import { create } from 'zustand';
import { Review, LocationRating, ReviewStats, ReviewFilters, ReviewsListResponse } from '../../../shared/src/types/reviews';
import { reviewsService } from '../services/reviewsService';

interface ReviewsState {
  // Current review data
  reviews: Review[];
  currentReview: Review | null;
  locationRating: LocationRating | null;
  userStats: ReviewStats | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  currentFilters: ReviewFilters;
  
  // Pagination
  hasNextPage: boolean;
  nextPageToken: string | null;
  
  // Actions
  loadLocationReviews: (locationId: string, filters?: ReviewFilters) => Promise<void>;
  loadUserReviews: (userId: string, filters?: ReviewFilters) => Promise<void>;
  loadNextPage: () => Promise<void>;
  createReview: (reviewData: any) => Promise<Review>;
  updateReview: (reviewId: string, updateData: any) => Promise<Review>;
  deleteReview: (reviewId: string) => Promise<void>;
  voteReview: (reviewId: string, helpful: boolean) => Promise<void>;
  flagReview: (reviewId: string, reason: 'spam' | 'inappropriate' | 'fake' | 'offensive' | 'off-topic' | 'other', details?: string) => Promise<void>;
  loadLocationRating: (locationId: string) => Promise<void>;
  loadUserStats: (userId?: string) => Promise<void>;
  setCurrentReview: (review: Review | null) => void;
  setFilters: (filters: Partial<ReviewFilters>) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  reviews: [],
  currentReview: null,
  locationRating: null,
  userStats: null,
  loading: false,
  error: null,
  currentFilters: {},
  hasNextPage: false,
  nextPageToken: null,
};

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  ...initialState,

  loadLocationReviews: async (locationId: string, filters: ReviewFilters = {}) => {
    set({ loading: true, error: null, currentFilters: filters });
    
    try {
      const response = await reviewsService.getLocationReviews(locationId, filters);
      set({
        reviews: response.reviews,
        hasNextPage: response.hasMore || false,
        nextPageToken: response.hasMore ? 'next' : null, // Simple pagination token
        loading: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load reviews',
        loading: false 
      });
    }
  },

  loadUserReviews: async (userId: string, filters: ReviewFilters = {}) => {
    set({ loading: true, error: null, currentFilters: filters });
    
    try {
      const response = await reviewsService.getUserReviews(userId, filters);
      set({
        reviews: response.reviews,
        hasNextPage: response.hasMore || false,
        nextPageToken: response.hasMore ? 'next' : null, // Simple pagination token
        loading: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load user reviews',
        loading: false 
      });
    }
  },

  loadNextPage: async () => {
    const { nextPageToken, currentFilters, reviews } = get();
    
    if (!nextPageToken) return;
    
    set({ loading: true });
    
    try {
      // This would need to be implemented to append to existing reviews
      // For now, we'll just reload - in production you'd want proper pagination
      set({ loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load more reviews',
        loading: false 
      });
    }
  },

  createReview: async (reviewData: any): Promise<Review> => {
    set({ loading: true, error: null });
    
    try {
      const review = await reviewsService.createReview(reviewData);
      
      // Add the new review to the beginning of the list
      set(state => ({
        reviews: [review, ...state.reviews],
        loading: false
      }));
      
      return review;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create review',
        loading: false 
      });
      throw error;
    }
  },

  updateReview: async (reviewId: string, updateData: any): Promise<Review> => {
    set({ loading: true, error: null });
    
    try {
      const updatedReview = await reviewsService.updateReview(reviewId, updateData);
      
      // Update the review in the list
      set(state => ({
        reviews: state.reviews.map(review => 
          review.id === reviewId ? updatedReview : review
        ),
        currentReview: state.currentReview?.id === reviewId ? updatedReview : state.currentReview,
        loading: false
      }));
      
      return updatedReview;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update review',
        loading: false 
      });
      throw error;
    }
  },

  deleteReview: async (reviewId: string) => {
    set({ loading: true, error: null });
    
    try {
      await reviewsService.deleteReview(reviewId);
      
      // Remove the review from the list
      set(state => ({
        reviews: state.reviews.filter(review => review.id !== reviewId),
        currentReview: state.currentReview?.id === reviewId ? null : state.currentReview,
        loading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete review',
        loading: false 
      });
      throw error;
    }
  },

  voteReview: async (reviewId: string, helpful: boolean) => {
    try {
      await reviewsService.voteReview(reviewId, helpful);
      
      // Update the review's vote counts optimistically
      set(state => ({
        reviews: state.reviews.map(review => {
          if (review.id === reviewId) {
            const helpfulVotes = helpful 
              ? review.helpfulVotes + 1 
              : review.helpfulVotes;
            const unhelpfulVotes = !helpful 
              ? review.unhelpfulVotes + 1 
              : review.unhelpfulVotes;
            
            return {
              ...review,
              helpfulVotes,
              unhelpfulVotes
            };
          }
          return review;
        }),
        currentReview: state.currentReview?.id === reviewId 
          ? {
              ...state.currentReview,
              helpfulVotes: helpful 
                ? state.currentReview.helpfulVotes + 1 
                : state.currentReview.helpfulVotes,
              unhelpfulVotes: !helpful 
                ? state.currentReview.unhelpfulVotes + 1 
                : state.currentReview.unhelpfulVotes
            }
          : state.currentReview
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to vote on review'
      });
    }
  },

  flagReview: async (reviewId: string, reason: 'spam' | 'inappropriate' | 'fake' | 'offensive' | 'off-topic' | 'other', details?: string) => {
    try {
      await reviewsService.flagReview(reviewId, { reason, description: details });
      
      // You might want to show a success message or update UI state
      // For now, we'll just clear any errors
      set({ error: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to flag review'
      });
    }
  },

  loadLocationRating: async (locationId: string) => {
    try {
      const rating = await reviewsService.getLocationRating(locationId);
      set({ locationRating: rating, error: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load location rating'
      });
    }
  },

  loadUserStats: async (userId?: string) => {
    try {
      const stats = await reviewsService.getUserStats(userId);
      set({ userStats: stats, error: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load user stats'
      });
    }
  },

  setCurrentReview: (review: Review | null) => {
    set({ currentReview: review });
  },

  setFilters: (filters: Partial<ReviewFilters>) => {
    set(state => ({
      currentFilters: { ...state.currentFilters, ...filters }
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  }
}));
