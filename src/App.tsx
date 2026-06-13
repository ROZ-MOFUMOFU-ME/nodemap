import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import config from '../site.config'

// Build the marker icon once from the shared config. Using an explicit icon also
// avoids react-leaflet's broken default marker under bundlers (its PNGs don't resolve).
const markerIcon = new Icon({
  iconUrl: config.map.marker.iconUrl,
  iconSize: config.map.marker.iconSize,
  iconAnchor: config.map.marker.iconAnchor,
  popupAnchor: config.map.marker.popupAnchor,
})

interface NodeLocation {
  ip: string
  dnsHostname?: string
  userAgent: string
  blockHeight: string
  location: string[] | ''
  country: string
  city: string
  org: string
}

interface PeerLocationsResponse {
  locations: NodeLocation[]
  lastUpdated: string | null
}

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [locations, setLocations] = useState<NodeLocation[]>([])
  const [lastUpdated, setLastUpdated] = useState('')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Apply and persist the colour theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Set the document title and fetch node data once on mount.
  useEffect(() => {
    document.title = config.title

    fetch('/peer-locations')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          throw new TypeError(`Expected JSON, got ${contentType}`)
        }
        return response.json() as Promise<PeerLocationsResponse>
      })
      .then((data) => {
        setLocations(data.locations ?? [])
        const updated = new Date(data.lastUpdated ?? Date.now())
        setLastUpdated(updated.toLocaleString(undefined, { timeZoneName: 'short' }))
      })
      .catch((error) => {
        console.error('Error fetching data:', error)
      })
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const { footer } = config

  const boxClass =
    'm-2.5 overflow-x-auto rounded border border-neutral-300 bg-white text-center dark:border-neutral-700 dark:bg-neutral-800'
  const cellClass =
    'whitespace-nowrap border border-neutral-300 px-4 py-3 text-left dark:border-neutral-700'

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] bg-neutral-100 text-neutral-800 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      {/* Map */}
      <section className={boxClass}>
        <div className="relative px-5 pt-3">
          <h3 className="text-lg font-semibold">{config.headings.map}</h3>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="absolute right-3 top-2 rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
          >
            <i className={theme === 'dark' ? 'fas fa-sun fa-fw' : 'fas fa-moon fa-fw'} />
            <span className="ml-2 hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
        <div className="relative z-[1] mx-auto my-5 h-[500px] w-[95%] shadow-md">
          <MapContainer
            center={config.map.center}
            zoom={config.map.zoom}
            style={{ height: '100%' }}
          >
            <TileLayer
              key={theme}
              url={theme === 'dark' ? config.map.tileUrlDark : config.map.tileUrl}
              attribution={theme === 'dark' ? config.map.attributionDark : config.map.attribution}
            />
            {locations.map((loc, i) => {
              const coords = loc.location
              return coords && coords.length === 2 ? (
                <Marker key={i} position={[Number(coords[0]), Number(coords[1])]} icon={markerIcon}>
                  <Popup>
                    <span dangerouslySetInnerHTML={{ __html: loc.ip }} />
                  </Popup>
                </Marker>
              ) : null
            })}
          </MapContainer>
        </div>
        <div className="m-5 text-left text-sm text-neutral-500">Last Updated: {lastUpdated}</div>
      </section>

      {/* Table */}
      <section className={boxClass}>
        <h3 className="px-5 pt-3 text-lg font-semibold">{config.headings.table}</h3>
        <table className="mx-auto my-5 w-[95%] border-collapse text-sm">
          <thead>
            <tr>
              {config.columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap border border-neutral-300 bg-neutral-200 px-4 py-3 text-left dark:border-neutral-700 dark:bg-neutral-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, i) => (
              <tr
                key={i}
                className="odd:bg-white even:bg-neutral-50 dark:odd:bg-neutral-800 dark:even:bg-neutral-900"
              >
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.ip }} />
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.userAgent }} />
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.blockHeight }} />
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.country }} />
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.city }} />
                <td className={cellClass} dangerouslySetInnerHTML={{ __html: loc.org }} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="px-4 py-4 text-center text-[0.9em] leading-6 text-neutral-500">
        <div>
          This site is powered by{' '}
          <a
            target="_blank"
            rel="noreferrer"
            href={footer.projectUrl}
            className="text-neutral-700 underline dark:text-neutral-300"
          >
            {footer.projectName}
          </a>{' '}
          project created by{' '}
          <a
            target="_blank"
            rel="noreferrer"
            href={footer.authorUrl}
            className="text-neutral-700 underline dark:text-neutral-300"
          >
            {footer.author}
          </a>{' '}
          originality and is licensed under the{' '}
          <a href={footer.licenseUrl} className="text-neutral-700 underline dark:text-neutral-300">
            {footer.licenseName}
          </a>
          .&nbsp;&nbsp;Contact:&nbsp;&nbsp;
          {footer.contact.map((c, i) => (
            <span key={c.url}>
              {i > 0 && <>&nbsp;&nbsp;|&nbsp;&nbsp;</>}
              <a
                href={c.url}
                className="text-neutral-700 dark:text-neutral-300"
                {...(c.url.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noreferrer' })}
              >
                <i className={c.icon} />
              </a>
            </span>
          ))}
          {footer.githubStar && (
            <>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <iframe
                src={`https://ghbtns.com/github-btn.html?user=${footer.githubStar.user}&repo=${footer.githubStar.repo}&type=star&count=true&v=2`}
                width="150"
                height="20"
                title="GitHub stars"
                className="inline-block align-middle"
              ></iframe>
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="whitespace-nowrap">
              <i className="fas fa-heart fa-fw" />
              &nbsp;Donating
            </span>
            {footer.donations.map((d) => (
              <span key={d.coin} className="min-w-0 max-w-full break-all">
                <span className="font-semibold">{d.coin}:</span>&nbsp;{d.address}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
