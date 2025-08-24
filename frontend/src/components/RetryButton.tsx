import React from 'react';

interface RetryButtonProps {
  onRetry: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function RetryButton({ 
  onRetry, 
  loading = false, 
  disabled = false, 
  className = '',
  children = 'Retry'
}: RetryButtonProps) {
  const baseClasses = "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2";
  const variantClasses = "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed";
  
  const ariaLabel = loading 
    ? `${children} in progress`
    : `${children} previous action`;
  
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
      data-testid="retry-button"
      aria-label={ariaLabel}
      aria-describedby={loading ? 'retry-status' : undefined}
    >
      {loading && (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            data-testid="loading-spinner"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span id="retry-status" className="sr-only">Loading</span>
        </>
      )}
      {!loading && (
        <svg
          className="-ml-1 mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          data-testid="retry-icon"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
