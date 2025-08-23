import { Link } from 'react-router-dom'

export default function Root() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Daylight</h1>
      <p>Plan smart. Pivot smarter.</p>
      <Link to="/plan" className="text-sky-600 underline">Open Planner</Link>
    </div>
  )
}
