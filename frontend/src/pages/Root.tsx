
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { t, useLocale, type Locale } from '../i18n'

export default function Root() {
  const { locale, setLocale } = useLocale()
  return (
    <>
      <Navigation />
      <div className="p-6">
      <div className="flex justify-end mb-2">
        <label className="mr-2">Lang:</label>
        <select value={locale} onChange={e => setLocale(e.target.value as Locale)} className="border rounded px-2 py-1">
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>
      <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
      <p>{t('slogan')}</p>
      <Link to="/plan" className="text-sky-600 underline">{t('openPlanner')}</Link>
      </div>
    </>
  )
}
