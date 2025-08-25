// Reviews and ratings system types
export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  locationId: string;
  locationName: string;
  rating: number; // 1-5 stars
  title?: string;
  content: string;
  photos?: string[]; // URLs to review photos
  tags?: string[]; // Categories like 'food', 'service', 'atmosphere'
  helpfulVotes: number;
  unhelpfulVotes: number;
  visitDate?: string; // ISO date when they visited
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
  flagged: boolean;
  verified: boolean; // Verified visit
  businessResponse?: BusinessResponse;
}

export interface BusinessResponse {
  id: string;
  businessName: string;
  businessOwner: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  helpful: boolean; // true = helpful, false = unhelpful
  createdAt: string;
}

export interface ReviewFlag {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: 'spam' | 'inappropriate' | 'fake' | 'offensive' | 'off-topic' | 'other';
  description?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'removed';
}

export interface LocationRating {
  locationId: string;
  locationName: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  categories: {
    [category: string]: {
      averageRating: number;
      count: number;
    };
  };
  lastUpdated: string;
}

export interface ReviewStats {
  userId: string;
  totalReviews: number;
  averageRating: number;
  helpfulVotes: number;
  expertCategories: string[]; // Categories where user has many high-quality reviews
  trustScore: number; // 0-100 based on review quality and helpfulness
  verifiedReviews: number;
  joinedDate: string;
}

// API request/response types
export interface CreateReviewRequest {
  locationId: string;
  locationName: string;
  rating: number;
  title?: string;
  content: string;
  photos?: string[];
  tags?: string[];
  visitDate?: string;
}

export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  content?: string;
  photos?: string[];
  tags?: string[];
  visitDate?: string;
}

export interface VoteReviewRequest {
  helpful: boolean;
}

export interface FlagReviewRequest {
  reason: ReviewFlag['reason'];
  description?: string;
}

export interface BusinessResponseRequest {
  businessName: string;
  businessOwner: string;
  content: string;
}

export interface ReviewsListResponse {
  reviews: Review[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ReviewFilters {
  rating?: number;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  verified?: boolean;
  withPhotos?: boolean;
  sortBy?: 'newest' | 'oldest' | 'highest-rated' | 'lowest-rated' | 'most-helpful';
}

// Moderation types
export interface ModerationAction {
  id: string;
  reviewId: string;
  moderatorId: string;
  action: 'approve' | 'flag' | 'remove' | 'warn';
  reason?: string;
  createdAt: string;
}

export interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  reviewsThisMonth: number;
  flaggedReviews: number;
  topCategories: Array<{
    category: string;
    count: number;
    averageRating: number;
  }>;
  ratingTrends: Array<{
    date: string;
    averageRating: number;
    count: number;
  }>;
}
