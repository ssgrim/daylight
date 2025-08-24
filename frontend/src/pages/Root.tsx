import { Link } from 'react-router-dom'

export default function Root() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Daylight</h1>
        <p className="text-xl text-gray-700 mb-6">Plan smart. Pivot smarter.</p>
      </header>
      
      <main>
        <nav aria-label="Main navigation">
          <Link 
            to="/plan" 
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" 
              />
            </svg>
            Open Trip Planner
          </Link>
        </nav>
        
        <section className="mt-12" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-semibold text-gray-900 mb-6">Features</h2>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="text-green-600 text-xl mr-3" aria-hidden="true">✓</span>
              <span className="text-gray-700">Search for places and attractions</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 text-xl mr-3" aria-hidden="true">✓</span>
              <span className="text-gray-700">View results in list or map format</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 text-xl mr-3" aria-hidden="true">✓</span>
              <span className="text-gray-700">Auto-search as you type</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 text-xl mr-3" aria-hidden="true">✓</span>
              <span className="text-gray-700">Responsive design for all devices</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
