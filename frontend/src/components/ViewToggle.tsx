import React from 'react';

interface ViewToggleProps {
  view: 'list' | 'map';
  onViewChange: (view: 'list' | 'map') => void;
  className?: string;
}

export default function ViewToggle({ view, onViewChange, className = '' }: ViewToggleProps) {
  return (
    <fieldset className={`inline-flex rounded-lg bg-gray-100 p-1 ${className}`}>
      <legend className="sr-only">Choose view type</legend>
      <div className="inline-flex" role="group" aria-label="View toggle">
        <button
          type="button"
          onClick={() => onViewChange('list')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
            view === 'list'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-pressed={view === 'list'}
          aria-label="List view"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span>List</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onViewChange('map')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
            view === 'map'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-pressed={view === 'map'}
          aria-label="Map view"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span>Map</span>
          </div>
        </button>
      </div>
    </fieldset>
  );
}
