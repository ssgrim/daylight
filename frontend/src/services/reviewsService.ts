import { Review, ReviewVote, ReviewFlag, LocationRating, ReviewStats, CreateReviewRequest, UpdateReviewRequest, VoteReviewRequest, FlagReviewRequest, BusinessResponseRequest, ReviewsListResponse, ReviewFilters } from '../../../shared/src/types/reviews';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export class ReviewsService {
  private getAuthHeaders(): HeadersInit {
    // For development, use demo token
    // In production, get real JWT from auth store
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo-token'
    };
  }

  // Review CRUD operations
  async createReview(reviewData: CreateReviewRequest): Promise<Review> {
    const response = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(reviewData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create review: ${response.status}`);
    }

    const data = await response.json();
    return data.review;
  }

  async getReview(reviewId: string): Promise<Review> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get review: ${response.status}`);
    }

    const data = await response.json();
    return data.review;
  }

  async updateReview(reviewId: string, updateData: UpdateReviewRequest): Promise<Review> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update review: ${response.status}`);
    }

    const data = await response.json();
    return data.review;
  }

  async deleteReview(reviewId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to delete review: ${response.status}`);
    }
  }

  // Review listing and filtering
  async getLocationReviews(locationId: string, filters?: ReviewFilters): Promise<ReviewsListResponse> {
    const params = new URLSearchParams({ locationId });
    
    if (filters) {
      if (filters.rating) params.append('rating', filters.rating.toString());
      if (filters.tags) params.append('tags', filters.tags.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
      if (filters.withPhotos !== undefined) params.append('withPhotos', filters.withPhotos.toString());
    }

    const response = await fetch(`${API_BASE}/reviews?${params.toString()}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get location reviews: ${response.status}`);
    }

    return response.json();
  }

  async getUserReviews(userId: string, filters?: ReviewFilters): Promise<ReviewsListResponse> {
    const params = new URLSearchParams({ userId });
    
    if (filters) {
      if (filters.rating) params.append('rating', filters.rating.toString());
      if (filters.tags) params.append('tags', filters.tags.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
      if (filters.withPhotos !== undefined) params.append('withPhotos', filters.withPhotos.toString());
    }

    const response = await fetch(`${API_BASE}/reviews?${params.toString()}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get user reviews: ${response.status}`);
    }

    return response.json();
  }

  async getAllReviews(filters?: ReviewFilters): Promise<ReviewsListResponse> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.rating) params.append('rating', filters.rating.toString());
      if (filters.tags) params.append('tags', filters.tags.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
      if (filters.withPhotos !== undefined) params.append('withPhotos', filters.withPhotos.toString());
    }

    const response = await fetch(`${API_BASE}/reviews?${params.toString()}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get reviews: ${response.status}`);
    }

    return response.json();
  }

  // Voting and flagging
  async voteReview(reviewId: string, helpful: boolean): Promise<ReviewVote> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ helpful })
    });

    if (!response.ok) {
      throw new Error(`Failed to vote on review: ${response.status}`);
    }

    const data = await response.json();
    return data.vote;
  }

  async flagReview(reviewId: string, flagData: FlagReviewRequest): Promise<ReviewFlag> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}/flag`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(flagData)
    });

    if (!response.ok) {
      throw new Error(`Failed to flag review: ${response.status}`);
    }

    const data = await response.json();
    return data.flag;
  }

  // Ratings and statistics
  async getLocationRating(locationId: string): Promise<LocationRating> {
    const response = await fetch(`${API_BASE}/reviews/rating?locationId=${locationId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get location rating: ${response.status}`);
    }

    const data = await response.json();
    return data.rating;
  }

  async getUserStats(userId?: string): Promise<ReviewStats> {
    const params = userId ? `?userId=${userId}` : '';
    
    const response = await fetch(`${API_BASE}/reviews/stats${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get user stats: ${response.status}`);
    }

    const data = await response.json();
    return data.stats;
  }

  // Business responses
  async addBusinessResponse(reviewId: string, responseData: BusinessResponseRequest): Promise<void> {
    const response = await fetch(`${API_BASE}/reviews/${reviewId}/response`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(responseData)
    });

    if (!response.ok) {
      throw new Error(`Failed to add business response: ${response.status}`);
    }
  }
}

export const reviewsService = new ReviewsService();
