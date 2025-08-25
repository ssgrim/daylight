import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reviewsService } from '../services/reviewsService';
import { useReviewsStore } from '../stores/reviewsStore';

// Mock fetch globally
global.fetch = vi.fn();

describe('Reviews Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a review successfully', async () => {
    const mockReview = {
      id: 'review-123',
      locationId: 'location-456',
      userId: 'user-789',
      userName: 'John Doe',
      rating: 5,
      content: 'Amazing place!',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      helpfulVotes: 0,
      unhelpfulVotes: 0,
      verified: true
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ review: mockReview })
    });

    const result = await reviewsService.createReview({
      locationId: 'location-456',
      locationName: 'Test Location',
      rating: 5,
      content: 'Amazing place!'
    });

    expect(result).toEqual(mockReview);
    expect(fetch).toHaveBeenCalledWith('/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token'
      },
      body: JSON.stringify({
        locationId: 'location-456',
        rating: 5,
        content: 'Amazing place!'
      })
    });
  });

  it('should get location reviews with filters', async () => {
    const mockResponse = {
      reviews: [
        {
          id: 'review-123',
          locationId: 'location-456',
          userId: 'user-789',
          userName: 'John Doe',
          rating: 5,
          content: 'Great!',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          helpfulVotes: 2,
          unhelpfulVotes: 0,
          verified: true
        }
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await reviewsService.getLocationReviews('location-456', {
      rating: 5,
      sortBy: 'newest'
    });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      '/reviews?locationId=location-456&rating=5&sortBy=newest',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer demo-token'
        })
      })
    );
  });

  it('should vote on a review', async () => {
    const mockVote = {
      id: 'vote-123',
      userId: 'user-789',
      reviewId: 'review-123',
      helpful: true,
      createdAt: '2024-01-01T00:00:00Z'
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ vote: mockVote })
    });

    const result = await reviewsService.voteReview('review-123', true);

    expect(result).toEqual(mockVote);
    expect(fetch).toHaveBeenCalledWith('/reviews/review-123/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token'
      },
      body: JSON.stringify({ helpful: true })
    });
  });

  it('should handle API errors', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400
    });

    await expect(reviewsService.createReview({
      locationId: 'location-456',
      locationName: 'Test Location',
      rating: 5,
      content: 'Test'
    })).rejects.toThrow('Failed to create review: 400');
  });
});

describe('Reviews Store', () => {
  beforeEach(() => {
    // Reset store state
    const store = useReviewsStore.getState();
    store.reset();
    vi.clearAllMocks();
  });

  it('should load location reviews', async () => {
    const mockResponse = {
      reviews: [
        {
          id: 'review-123',
          locationId: 'location-456',
          userId: 'user-789',
          userName: 'Jane Doe',
          rating: 4,
          content: 'Nice place',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          helpfulVotes: 1,
          unhelpfulVotes: 0,
          verified: false
        }
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const store = useReviewsStore.getState();
    await store.loadLocationReviews('location-456');

    const state = useReviewsStore.getState();
    expect(state.reviews).toEqual(mockResponse.reviews);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  it('should handle store errors', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const store = useReviewsStore.getState();
    await store.loadLocationReviews('location-456');

    const state = useReviewsStore.getState();
    expect(state.reviews).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Failed to load reviews');
  });

  it('should update review votes optimistically', async () => {
    // Set up initial state with a review
    const initialReview = {
      id: 'review-123',
      locationId: 'location-456',
      locationName: 'Test Location',
      userId: 'user-789',
      userName: 'Test User',
      rating: 4,
      content: 'Good place',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      helpfulVotes: 5,
      unhelpfulVotes: 1,
      verified: true,
      flagged: false
    };

    const store = useReviewsStore.getState();
    store.reviews = [initialReview];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ vote: { helpful: true } })
    });

    await store.voteReview('review-123', true);

    const state = useReviewsStore.getState();
    expect(state.reviews[0].helpfulVotes).toBe(6);
    expect(state.reviews[0].unhelpfulVotes).toBe(1);
  });
});
