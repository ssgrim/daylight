import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ddb, TABLE } from '../lib/reviewsDb';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Review, ReviewVote, ReviewFlag, LocationRating, ReviewStats, CreateReviewRequest, UpdateReviewRequest, VoteReviewRequest, FlagReviewRequest, BusinessResponseRequest, ReviewsListResponse, ReviewFilters } from '../../../shared/src/types/reviews';
import { info, error } from '../lib/logger.mjs';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { requestContext, pathParameters, body, queryStringParameters } = event;
    const method = requestContext.http.method;
    const path = requestContext.http.path;

    // Extract user ID from headers (demo for now)
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    let userId = 'demo-user';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // In production, extract from JWT token
      userId = 'demo-user';
    }

    // Route handling
    if (method === 'GET' && path === '/reviews') {
      const locationId = queryStringParameters?.locationId;
      const userIdQuery = queryStringParameters?.userId;
      const filters: ReviewFilters = {
        rating: queryStringParameters?.rating ? parseInt(queryStringParameters.rating) : undefined,
        tags: queryStringParameters?.tags ? queryStringParameters.tags.split(',') : undefined,
        sortBy: (queryStringParameters?.sortBy as any) || 'newest',
        verified: queryStringParameters?.verified === 'true',
        withPhotos: queryStringParameters?.withPhotos === 'true'
      };
      
      if (locationId) {
        return await getLocationReviews(locationId, filters);
      } else if (userIdQuery) {
        return await getUserReviews(userIdQuery, filters);
      } else {
        return await getAllReviews(filters);
      }
    }
    
    if (method === 'POST' && path === '/reviews') {
      const reviewData: CreateReviewRequest = JSON.parse(body || '{}');
      return await createReview(userId, reviewData);
    }
    
    if (method === 'GET' && path.startsWith('/reviews/') && !path.includes('/vote') && !path.includes('/flag')) {
      const reviewId = pathParameters?.reviewId;
      if (!reviewId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Review ID required' }) };
      }
      return await getReview(reviewId);
    }
    
    if (method === 'PUT' && path.startsWith('/reviews/') && !path.includes('/vote') && !path.includes('/flag')) {
      const reviewId = pathParameters?.reviewId;
      if (!reviewId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Review ID required' }) };
      }
      const updateData: UpdateReviewRequest = JSON.parse(body || '{}');
      return await updateReview(userId, reviewId, updateData);
    }
    
    if (method === 'DELETE' && path.startsWith('/reviews/') && !path.includes('/vote') && !path.includes('/flag')) {
      const reviewId = pathParameters?.reviewId;
      if (!reviewId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Review ID required' }) };
      }
      return await deleteReview(userId, reviewId);
    }

    if (method === 'POST' && path.includes('/vote')) {
      const reviewId = pathParameters?.reviewId;
      if (!reviewId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Review ID required' }) };
      }
      const voteData: VoteReviewRequest = JSON.parse(body || '{}');
      return await voteReview(userId, reviewId, voteData);
    }

    if (method === 'POST' && path.includes('/flag')) {
      const reviewId = pathParameters?.reviewId;
      if (!reviewId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Review ID required' }) };
      }
      const flagData: FlagReviewRequest = JSON.parse(body || '{}');
      return await flagReview(userId, reviewId, flagData);
    }

    if (method === 'GET' && path.includes('/rating')) {
      const locationId = queryStringParameters?.locationId;
      if (!locationId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Location ID required' }) };
      }
      return await getLocationRating(locationId);
    }

    if (method === 'GET' && path.includes('/stats')) {
      const userIdQuery = queryStringParameters?.userId || userId;
      return await getUserStats(userIdQuery);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (err: any) {
    error('Reviews handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function createReview(userId: string, reviewData: CreateReviewRequest): Promise<any> {
  try {
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const review: Review = {
      id: reviewId,
      userId,
      userName: 'Demo User', // In production, fetch from user profile
      userAvatar: undefined,
      locationId: reviewData.locationId,
      locationName: reviewData.locationName,
      rating: reviewData.rating,
      title: reviewData.title,
      content: reviewData.content,
      photos: reviewData.photos || [],
      tags: reviewData.tags || [],
      helpfulVotes: 0,
      unhelpfulVotes: 0,
      visitDate: reviewData.visitDate,
      createdAt: now,
      updatedAt: now,
      flagged: false,
      verified: false,
      businessResponse: undefined
    };

    // Store main review record
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `REVIEW#${reviewId}`,
        sk: 'META',
        ...review
      }
    }));

    // Store location index
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `LOCATION#${reviewData.locationId}`,
        sk: `REVIEW#${reviewId}`,
        reviewId,
        rating: reviewData.rating,
        createdAt: now
      }
    }));

    // Store user index  
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${userId}`,
        sk: `REVIEW#${reviewId}`,
        reviewId,
        locationId: reviewData.locationId,
        rating: reviewData.rating,
        createdAt: now
      }
    }));

    // Update location rating
    await updateLocationRating(reviewData.locationId);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review })
    };
  } catch (err) {
    error('Create review error:', err);
    throw err;
  }
}

async function getReview(reviewId: string): Promise<any> {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `REVIEW#${reviewId}`, sk: 'META' }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Review not found' })
      };
    }

    const review = result.Item as Review;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review })
    };
  } catch (err) {
    error('Get review error:', err);
    throw err;
  }
}

async function getLocationReviews(locationId: string, filters: ReviewFilters): Promise<any> {
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `LOCATION#${locationId}`,
        ':sk': 'REVIEW#'
      }
    }));

    let reviews: Review[] = [];
    
    if (result.Items) {
      // Fetch full review details
      const reviewPromises = result.Items.map(item => 
        ddb.send(new GetCommand({
          TableName: TABLE,
          Key: { pk: `REVIEW#${item.reviewId}`, sk: 'META' }
        }))
      );
      
      const reviewResults = await Promise.all(reviewPromises);
      reviews = reviewResults
        .filter(r => r.Item)
        .map(r => r.Item as Review);
    }

    // Apply filters
    reviews = applyFilters(reviews, filters);

    const response: ReviewsListResponse = {
      reviews,
      total: reviews.length,
      page: 1,
      pageSize: reviews.length,
      hasMore: false
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    error('Get location reviews error:', err);
    throw err;
  }
}

async function getUserReviews(userId: string, filters: ReviewFilters): Promise<any> {
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'REVIEW#'
      }
    }));

    let reviews: Review[] = [];
    
    if (result.Items) {
      // Fetch full review details
      const reviewPromises = result.Items.map(item => 
        ddb.send(new GetCommand({
          TableName: TABLE,
          Key: { pk: `REVIEW#${item.reviewId}`, sk: 'META' }
        }))
      );
      
      const reviewResults = await Promise.all(reviewPromises);
      reviews = reviewResults
        .filter(r => r.Item)
        .map(r => r.Item as Review);
    }

    // Apply filters
    reviews = applyFilters(reviews, filters);

    const response: ReviewsListResponse = {
      reviews,
      total: reviews.length,
      page: 1,
      pageSize: reviews.length,
      hasMore: false
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    error('Get user reviews error:', err);
    throw err;
  }
}

async function getAllReviews(filters: ReviewFilters): Promise<any> {
  try {
    // This would need pagination in production
    const result = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'sk = :sk',
      ExpressionAttributeValues: {
        ':sk': 'META'
      }
    }));

    let reviews: Review[] = [];
    
    if (result.Items) {
      reviews = result.Items.map(item => item as Review);
    }

    // Apply filters
    reviews = applyFilters(reviews, filters);

    const response: ReviewsListResponse = {
      reviews,
      total: reviews.length,
      page: 1,
      pageSize: reviews.length,
      hasMore: false
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    error('Get all reviews error:', err);
    throw err;
  }
}

async function updateReview(userId: string, reviewId: string, updateData: UpdateReviewRequest): Promise<any> {
  try {
    const now = new Date().toISOString();
    
    const updateExpression = [];
    const expressionAttributeNames: any = {};
    const expressionAttributeValues: any = {};

    if (updateData.rating !== undefined) {
      updateExpression.push('#rating = :rating');
      expressionAttributeNames['#rating'] = 'rating';
      expressionAttributeValues[':rating'] = updateData.rating;
    }

    if (updateData.title !== undefined) {
      updateExpression.push('#title = :title');
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':title'] = updateData.title;
    }

    if (updateData.content !== undefined) {
      updateExpression.push('#content = :content');
      expressionAttributeNames['#content'] = 'content';
      expressionAttributeValues[':content'] = updateData.content;
    }

    if (updateData.photos !== undefined) {
      updateExpression.push('#photos = :photos');
      expressionAttributeNames['#photos'] = 'photos';
      expressionAttributeValues[':photos'] = updateData.photos;
    }

    if (updateData.tags !== undefined) {
      updateExpression.push('#tags = :tags');
      expressionAttributeNames['#tags'] = 'tags';
      expressionAttributeValues[':tags'] = updateData.tags;
    }

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: `REVIEW#${reviewId}`, sk: 'META' },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ':userId': userId
      }
    }));

    return await getReview(reviewId);
  } catch (err) {
    error('Update review error:', err);
    throw err;
  }
}

async function deleteReview(userId: string, reviewId: string): Promise<any> {
  try {
    // Get review first to get location ID
    const reviewResult = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `REVIEW#${reviewId}`, sk: 'META' }
    }));

    if (!reviewResult.Item || reviewResult.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not authorized to delete this review' })
      };
    }

    const locationId = reviewResult.Item.locationId;

    // Delete main review
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: `REVIEW#${reviewId}`, sk: 'META' }
    }));

    // Delete location index
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: `LOCATION#${locationId}`, sk: `REVIEW#${reviewId}` }
    }));

    // Delete user index
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: `USER#${userId}`, sk: `REVIEW#${reviewId}` }
    }));

    // Update location rating
    await updateLocationRating(locationId);

    return {
      statusCode: 204,
      headers: { 'Content-Type': 'application/json' },
      body: ''
    };
  } catch (err) {
    error('Delete review error:', err);
    throw err;
  }
}

async function voteReview(userId: string, reviewId: string, voteData: VoteReviewRequest): Promise<any> {
  try {
    const voteId = `vote_${userId}_${reviewId}`;
    const now = new Date().toISOString();

    const vote: ReviewVote = {
      id: voteId,
      reviewId,
      userId,
      helpful: voteData.helpful,
      createdAt: now
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `REVIEW#${reviewId}`,
        sk: `VOTE#${userId}`,
        ...vote
      }
    }));

    // Update review vote counts
    const increment = voteData.helpful ? 1 : -1;
    const field = voteData.helpful ? 'helpfulVotes' : 'unhelpfulVotes';
    
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: `REVIEW#${reviewId}`, sk: 'META' },
      UpdateExpression: `ADD #field :increment`,
      ExpressionAttributeNames: { '#field': field },
      ExpressionAttributeValues: { ':increment': increment }
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    };
  } catch (err) {
    error('Vote review error:', err);
    throw err;
  }
}

async function flagReview(userId: string, reviewId: string, flagData: FlagReviewRequest): Promise<any> {
  try {
    const flagId = `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const flag: ReviewFlag = {
      id: flagId,
      reviewId,
      reporterId: userId,
      reason: flagData.reason,
      description: flagData.description,
      createdAt: now,
      status: 'pending'
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `REVIEW#${reviewId}`,
        sk: `FLAG#${flagId}`,
        ...flag
      }
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag })
    };
  } catch (err) {
    error('Flag review error:', err);
    throw err;
  }
}

async function getLocationRating(locationId: string): Promise<any> {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `LOCATION#${locationId}`, sk: 'RATING' }
    }));

    const rating = result.Item as LocationRating || {
      locationId,
      locationName: 'Unknown Location',
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categories: {},
      lastUpdated: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    };
  } catch (err) {
    error('Get location rating error:', err);
    throw err;
  }
}

async function getUserStats(userId: string): Promise<any> {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `USER#${userId}`, sk: 'STATS' }
    }));

    const stats = result.Item as ReviewStats || {
      userId,
      totalReviews: 0,
      averageRating: 0,
      helpfulVotes: 0,
      expertCategories: [],
      trustScore: 50,
      verifiedReviews: 0,
      joinedDate: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats })
    };
  } catch (err) {
    error('Get user stats error:', err);
    throw err;
  }
}

async function updateLocationRating(locationId: string): Promise<void> {
  try {
    // Get all reviews for location
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `LOCATION#${locationId}`,
        ':sk': 'REVIEW#'
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return;
    }

    // Calculate statistics
    const ratings = result.Items.map(item => item.rating).filter(r => r);
    const totalReviews = ratings.length;
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / totalReviews;
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      ratingDistribution[rating as keyof typeof ratingDistribution]++;
    });

    const locationRating: LocationRating = {
      locationId,
      locationName: 'Location Name', // Would fetch from location service
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      categories: {},
      lastUpdated: new Date().toISOString()
    };

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `LOCATION#${locationId}`,
        sk: 'RATING',
        ...locationRating
      }
    }));
  } catch (err) {
    error('Update location rating error:', err);
  }
}

function applyFilters(reviews: Review[], filters: ReviewFilters): Review[] {
  let filtered = [...reviews];

  if (filters.rating) {
    filtered = filtered.filter(review => review.rating === filters.rating);
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(review => 
      review.tags?.some(tag => filters.tags!.includes(tag))
    );
  }

  if (filters.verified) {
    filtered = filtered.filter(review => review.verified === filters.verified);
  }

  if (filters.withPhotos) {
    filtered = filtered.filter(review => review.photos && review.photos.length > 0);
  }

  // Sort
  switch (filters.sortBy) {
    case 'oldest':
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'highest-rated':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    case 'lowest-rated':
      filtered.sort((a, b) => a.rating - b.rating);
      break;
    case 'most-helpful':
      filtered.sort((a, b) => b.helpfulVotes - a.helpfulVotes);
      break;
    case 'newest':
    default:
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  return filtered;
}
