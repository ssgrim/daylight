import { Request, Response } from 'express';

// Mock data for demonstration purposes
const data = [
  { id: 1, name: 'Item 1', category: 'A', rating: 4.5 },
  { id: 2, name: 'Item 2', category: 'B', rating: 3.8 },
  { id: 3, name: 'Item 3', category: 'A', rating: 4.9 },
  { id: 4, name: 'Item 4', category: 'C', rating: 2.5 },
];

// Handler for advanced search with filters
export const advancedSearch = (req: Request, res: Response) => {
  const { category, minRating } = req.query;

  let results = data;

  // Apply category filter if provided
  if (category) {
    results = results.filter(item => item.category === category);
  }

  // Apply minimum rating filter if provided
  if (minRating) {
    const minRatingValue = parseFloat(minRating as string);
    results = results.filter(item => item.rating >= minRatingValue);
  }

  res.json(results);
};