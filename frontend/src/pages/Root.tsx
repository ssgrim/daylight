import { Link } from 'react-router-dom'

export default function Root() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Daylight</h1>
      <p className="mb-4">Plan smart. Pivot smarter.</p>
      <nav className="space-x-4">
        <Link to="/plan" className="text-sky-600 underline">Open Planner</Link>
        <Link to="/error-test" className="text-purple-600 underline">Error Test Page</Link>
      </nav>
    </div>
  )
}
