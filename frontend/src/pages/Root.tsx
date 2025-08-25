import { Link } from 'react-router-dom'

export default function Root() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Daylight</h1>
      <p className="mb-6">Plan smart. Pivot smarter.</p>
      
      <div className="space-y-4">
        <div>
          <Link 
            to="/plan" 
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Open Planner
          </Link>
        </div>
        
        <div>
          <Link 
            to="/error-demo" 
            className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            View Error Handling Demo
          </Link>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Enhanced Error Handling</h2>
        <p className="text-gray-700 text-sm">
          This application now includes comprehensive error handling with user-friendly messages, 
          automatic retry logic, and graceful error recovery. Visit the demo page to see it in action.
        </p>
      </div>
    </div>
  )
}
