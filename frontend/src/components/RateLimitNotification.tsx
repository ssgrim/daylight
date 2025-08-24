import React, { useState, useEffect } from 'react';
import { formatRetryAfter, type RateLimitInfo } from '../lib/apiClient';

interface RateLimitNotificationProps {
  rateLimitInfo: RateLimitInfo;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function RateLimitNotification({
  rateLimitInfo,
  onRetry,
  onDismiss,
  className = ''
}: RateLimitNotificationProps) {
  const [countdown, setCountdown] = useState(rateLimitInfo.retryAfter || 0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (rateLimitInfo.retryAfter && rateLimitInfo.retryAfter > 0) {
      setCountdown(rateLimitInfo.retryAfter);
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [rateLimitInfo.retryAfter]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleRetry = () => {
    if (countdown <= 0) {
      onRetry?.();
    }
  };

  if (!rateLimitInfo.isRateLimited || !isVisible) {
    return null;
  }

  return (
    <div 
      className={`bg-orange-50 border-2 border-orange-300 rounded-md p-4 ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="w-5 h-5 text-orange-500" 
            fill="currentColor" 
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-semibold text-orange-900">
            Rate Limit Exceeded
          </h3>
          <div className="mt-2 text-sm text-orange-800">
            <p>{rateLimitInfo.message || 'Too many requests. Please wait before trying again.'}</p>
            {countdown > 0 && (
              <p className="mt-1 font-medium" aria-live="polite">
                Please wait <span className="font-bold">{formatRetryAfter(countdown)}</span> before retrying.
              </p>
            )}
          </div>
          <div className="mt-3 flex space-x-2">
            {countdown <= 0 && onRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="bg-orange-100 text-orange-900 px-3 py-1.5 rounded text-sm font-medium hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                aria-label="Retry the previous action"
              >
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="text-orange-700 hover:text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 text-sm font-medium px-2 py-1 rounded"
              aria-label="Dismiss rate limit notification"
            >
              Dismiss
            </button>
          </div>
        </div>
        {onDismiss && (
          <div className="ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-orange-500 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded p-1"
              aria-label="Close rate limit notification"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Progress bar for countdown */}
      {countdown > 0 && rateLimitInfo.retryAfter && (
        <div className="mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={rateLimitInfo.retryAfter} aria-valuenow={countdown} aria-label={`Time remaining: ${formatRetryAfter(countdown)}`}>
          <div className="flex justify-between text-xs text-orange-700 mb-1">
            <span>Retry available in:</span>
            <span className="font-medium">{formatRetryAfter(countdown)}</span>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-orange-600 h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ 
                width: `${Math.max(0, rateLimitInfo.retryAfter ? (countdown / rateLimitInfo.retryAfter) * 100 : 0)}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
