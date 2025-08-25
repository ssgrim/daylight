import { create } from 'zustand'

export type Locale = 'en' | 'es'

export const messages: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Daylight',
    slogan: 'Plan smart. Pivot smarter.',
    openPlanner: 'Open Planner',
    planner: 'Planner',
    lat: 'Lat',
    lng: 'Lng',
    fetch: 'Fetch',
    seattle: 'Seattle',
    sanfrancisco: 'San Francisco',
    showEvents: 'Show events',
    showTraffic: 'Show traffic',
    loading: 'Loading suggestions…',
    unableToLoad: 'Unable to load live suggestions',
    demoStop: 'Demo Stop',
    traffic: 'Traffic congestion',
    tickets: 'Tickets',
    nearbyEvents: 'Nearby events',
  },
  es: {
    title: 'Luz del Día',
    slogan: 'Planifica inteligente. Cambia mejor.',
    openPlanner: 'Abrir Planificador',
    planner: 'Planificador',
    lat: 'Latitud',
    lng: 'Longitud',
    fetch: 'Buscar',
    seattle: 'Seattle',
    sanfrancisco: 'San Francisco',
    showEvents: 'Mostrar eventos',
    showTraffic: 'Mostrar tráfico',
    loading: 'Cargando sugerencias…',
    unableToLoad: 'No se pueden cargar sugerencias en vivo',
    demoStop: 'Parada de Demostración',
    traffic: 'Congestión de tráfico',
    tickets: 'Entradas',
    nearbyEvents: 'Eventos cercanos',
  }
}

export const useLocale = create<{ locale: Locale; setLocale: (l: Locale) => void }>((set) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale })
}))

export function t(key: string) {
  const { locale } = useLocale.getState()
  return messages[locale][key] || key
}
