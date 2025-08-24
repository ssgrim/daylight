import { useState, useEffect } from 'react';

/**
 * Custom hook for debounced values
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debounced search functionality
 * @param searchFn - Function to call when search is triggered
 * @param delay - Debounce delay in milliseconds
 * @returns Object with search trigger function and loading state
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  delay: number = 500
) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const debouncedQuery = useDebounce(searchQuery, delay);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      setIsSearching(true);
      searchFn(debouncedQuery)
        .finally(() => setIsSearching(false));
    }
  }, [debouncedQuery, searchFn]);

  return {
    isSearching,
    setSearchQuery,
    searchQuery
  };
}
