import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as dns from 'node:dns'
import NodeCache from 'node-cache'
import express, { type Request, type Response } from 'express'

const dnsPromises = dns.promises
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
interface PeerInfo {
  addr: string
  subver: string
  version: string | number
  startingheight: number
}

interface LocalAddress {
  address: string
  port?: number
}

interface NetworkInfo {
  subversion?: string
  protocolversion?: string | number
  localaddresses: LocalAddress[]
}

interface MiningInfo {
  blocks: number
}

interface GeoLocation {
  loc?: string
  country?: string
  city?: string
  region?: string
  timezone?: string
  org?: string
  hostname?: string
}

interface NodeLocation {
  ip: string
  dnsHostname: string
  userAgent: string
  blockHeight: string
  location: string[] | ''
  country: string
  city: string
  org: string
  dns: string
}

interface MockData {
  peerInfo: PeerInfo[]
  networkInfo: NetworkInfo
  miningInfo: MiningInfo
  geoLocation: GeoLocation
  dnsLookup: string
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function loadEnvVariables(): void {
  const envPath = path.join(__dirname, '.env')
  try {
    const data = fs.readFileSync(envPath, 'utf8')
    for (const line of data.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      // Split on the first '=' only — values may legitimately contain '='
      // (e.g. base64-encoded RPC passwords), which the old split('=') truncated.
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key) process.env[key] = value
    }
    console.log('.env variables loaded successfully')
  } catch (error) {
    console.error('Failed to read .env file:', errMessage(error))
  }
}

function validateEnvironmentVars(): void {
  if (process.env.NODE_ENV === 'test') {
    process.env.DAEMON_RPC_HOST ||= 'dummy-host'
    process.env.IPINFO_TOKEN ||= 'dummy-token'
    return
  }

  const required = ['DAEMON_RPC_HOST', 'IPINFO_TOKEN']
  const missing = required.filter((name) => !process.env[name])
  if (missing.length) {
    console.error('Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
}

loadEnvVariables()
validateEnvironmentVars()

const port = Number(process.env.PORT) || 3000
console.log(`Server will run on port: ${port} (from .env)`)

// Read cache refresh interval from env (in ms), default to 60 minutes.
const cacheRefreshInterval = parseInt(process.env.CACHE_REFRESH_INTERVAL ?? '', 10) || 3600000
// TTL in seconds: one-thousandth of the refresh interval, or 3600s if not configured.
const cacheTTL = process.env.CACHE_REFRESH_INTERVAL ? Math.floor(cacheRefreshInterval / 1000) : 3600
const cache = new NodeCache({ stdTTL: cacheTTL })
let lastCacheUpdateTime: string | null = null

const isTestEnv = process.env.NODE_ENV === 'test'
const ipInfoToken = process.env.IPINFO_TOKEN

let mockData: MockData | null = null
if (isTestEnv) {
  try {
    const mod = (await import('./test/mockData')) as { default: MockData }
    mockData = mod.default
  } catch (error) {
    console.error('Error loading mock data:', errMessage(error))
    mockData = {
      peerInfo: [],
      networkInfo: { localaddresses: [] },
      miningInfo: { blocks: 0 },
      geoLocation: {},
      dnsLookup: '',
    }
  }
}

// Format host address to handle IPv6 and other special cases (used for logging).
function formatHost(host: string | undefined): string {
  if (!host) return 'localhost'
  if (host.includes(':')) {
    // Leave bracketed IPv6 addresses untouched.
    if (host.includes('[') && host.includes(']')) return host
    return host.split(':')[0]
  }
  return host
}

console.log('Connecting to Daemon RPC:', {
  host: process.env.DAEMON_RPC_HOST,
  port: process.env.DAEMON_RPC_PORT,
  ssl: process.env.DAEMON_RPC_SSL,
})
console.log(
  `Connecting to RPC with host: ${formatHost(process.env.DAEMON_RPC_HOST)}, port: ${process.env.DAEMON_RPC_PORT}`,
)

// ----------------------------------------------------------------------------
// RPC
// ----------------------------------------------------------------------------
function rpcUrl(): string {
  const protocol = process.env.DAEMON_RPC_SSL === 'true' ? 'https' : 'http'
  let host = process.env.DAEMON_RPC_HOST ?? ''
  const rpcPort = process.env.DAEMON_RPC_PORT ?? ''
  // Append the port unless the host already carries a path.
  if (!host.includes('/')) host = `${host}:${rpcPort}`
  return `${protocol}://${host}`
}

async function rpcCall<T>(method: string): Promise<T | null> {
  const auth = Buffer.from(
    `${process.env.DAEMON_RPC_USERNAME ?? ''}:${process.env.DAEMON_RPC_PASSWORD ?? ''}`,
  ).toString('base64')
  const timeoutMs = parseInt(process.env.DAEMON_RPC_TIMEOUT ?? '', 10) || 30000

  const response = await fetch(rpcUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'nodemap', method, params: [] }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`RPC ${method} failed: HTTP ${response.status}`)
  }

  const data = (await response.json()) as { result: T }
  return data.result
}

async function fetchPeerInfo(): Promise<PeerInfo[]> {
  if (isTestEnv) return mockData!.peerInfo
  try {
    return (await rpcCall<PeerInfo[]>('getpeerinfo')) ?? []
  } catch (error) {
    console.error('Error accessing Coin Daemon for getpeerinfo:', errMessage(error))
    return []
  }
}

async function fetchNetworkInfo(): Promise<NetworkInfo> {
  if (isTestEnv) return mockData!.networkInfo
  try {
    return (await rpcCall<NetworkInfo>('getnetworkinfo')) ?? { localaddresses: [] }
  } catch (error) {
    console.error('Error accessing Coin Daemon for getnetworkinfo:', errMessage(error))

    // Fall back to the legacy getinfo call.
    try {
      const info = await rpcCall<{ version?: string; protocolversion?: number; ip?: string }>(
        'getinfo',
      )
      return {
        subversion: info?.version,
        protocolversion: info?.protocolversion,
        localaddresses: [
          { address: info?.ip ?? '', port: Number(process.env.DAEMON_RPC_PORT) || 8876 },
        ],
      }
    } catch (fallbackError) {
      console.error('Error accessing Coin Daemon for getinfo:', errMessage(fallbackError))
      return { localaddresses: [] }
    }
  }
}

async function fetchMiningInfo(): Promise<MiningInfo> {
  if (isTestEnv) return mockData!.miningInfo
  try {
    return (await rpcCall<MiningInfo>('getmininginfo')) ?? { blocks: 0 }
  } catch (error) {
    console.error('Error accessing Coin Daemon for getmininginfo:', errMessage(error))
    return { blocks: 0 }
  }
}

// ----------------------------------------------------------------------------
// IP / DNS / geo helpers
// ----------------------------------------------------------------------------
function isValidIp(ip: string): boolean {
  const ipv4Pattern =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const ipv6Pattern =
    /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$|^fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}$|^::(ffff(:0{1,4}){0,1}:){0,1}(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,5})$|^([0-9a-fA-F]{1,4}:){1,4}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}:([0-9a-fA-F]{1,4}:){1,7}$/
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip)
}

// Skip local and private addresses.
function isLocalAddress(ip: string): boolean {
  return (
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) ||
    ip.startsWith('192.168') ||
    ip.startsWith('10.') ||
    ip.startsWith('fe80:') ||
    (ip.startsWith('172.') &&
      parseInt(ip.split('.')[1], 10) >= 16 &&
      parseInt(ip.split('.')[1], 10) <= 31)
  )
}

// Extract a bare IP address from "addr" / "addr:port" forms.
// Handles IPv4, hostnames, and IPv6 — including the [v6]:port form from getpeerinfo.
// Must be idempotent: reverseDnsLookup()/getGeoLocation() may re-extract an already
// bare address, and a bare IPv6 must survive that round-trip unchanged.
function extractIp(address: string | undefined): string {
  if (!address) return ''

  // Bracketed IPv6, optionally with a port: "[2001:db8::1]:8333" -> "2001:db8::1"
  if (address.startsWith('[')) {
    const end = address.indexOf(']')
    return end === -1 ? address.slice(1) : address.slice(1, end)
  }

  const colonCount = (address.match(/:/g) ?? []).length

  // Two or more colons without brackets is a bare IPv6 address — a port would be
  // bracketed ("[v6]:port"), so return it untouched. The previous heuristic treated
  // a trailing all-digit group (e.g. the "1" in "2001:db8::1") as a port and stripped
  // it, corrupting the address into "2001:db8:" so the reverse DNS lookup always failed.
  if (colonCount >= 2) return address

  // A single colon is "host:port" / "ipv4:port" — drop the port.
  if (colonCount === 1) return address.slice(0, address.indexOf(':'))

  // No colon: plain IPv4 or hostname.
  return address
}

// Fetch geolocation information using the ipinfo.io API.
async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  if (isTestEnv) return mockData!.geoLocation
  if (!isValidIp(ip)) {
    console.warn('Invalid IP address:', ip)
    return null
  }
  const cacheKey = `geo:${ip}`
  const cached = cache.get<GeoLocation>(cacheKey)
  if (cached) return cached

  try {
    const cleanIp = ip.replace(/\[|\]/g, '')
    const url = `https://ipinfo.io/${encodeURIComponent(cleanIp)}?token=${ipInfoToken}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`ipinfo.io HTTP ${response.status}`)
    const data = (await response.json()) as GeoLocation
    cache.set(cacheKey, data)
    return data
  } catch (error) {
    console.error('Error getting location data for IP:', ip, errMessage(error))
    return null
  }
}

const fixedDnsLookups: Record<string, string> = {
  '8.8.8.8': 'dns.google',
  '1.1.1.1': 'one.one.one.one',
}

// Public resolvers used as a fallback for reverse lookups. A host's own resolver
// frequently cannot answer ip6.arpa (IPv6 PTR) queries — it returns SERVFAIL, or even
// a misleading NXDOMAIN — which is the usual reason IPv6 hostnames are *always* blank
// while IPv4 ones resolve fine. These public resolvers answer ip6.arpa reliably (over
// IPv4 transport). Override with DNS_SERVERS (comma-separated); set it empty to rely on
// the system resolver alone.
const fallbackDnsServers = (process.env.DNS_SERVERS ?? '1.1.1.1,8.8.8.8')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const fallbackResolver = fallbackDnsServers.length > 0 ? new dnsPromises.Resolver() : null
if (fallbackResolver) fallbackResolver.setServers(fallbackDnsServers)

// Perform a reverse DNS lookup, preferring the system resolver but deferring to the
// public resolvers above whenever the system one yields nothing — including when it
// *claims* NXDOMAIN, which a broken ip6.arpa setup does for perfectly valid IPv6 PTRs.
async function reverseDnsLookup(ip: string): Promise<string> {
  if (isTestEnv) return mockData!.dnsLookup

  // Normalize (strip brackets and any port) before the PTR query.
  const cleanIp = extractIp(ip)

  if (fixedDnsLookups[cleanIp]) return fixedDnsLookups[cleanIp]

  const cacheKey = `dns:${cleanIp}`
  const cached = cache.get<string>(cacheKey)
  if (cached !== undefined) return cached

  // 1) System resolver. Only a positive answer is trusted here; its errors and empty
  //    results fall through to the public resolver below.
  let systemCode: string | undefined
  try {
    const hostnames = await dnsPromises.reverse(cleanIp)
    if (hostnames[0]) {
      cache.set(cacheKey, hostnames[0])
      return hostnames[0]
    }
  } catch (error) {
    systemCode = (error as { code?: string }).code
  }

  // 2) Public resolver — authoritative for both in-addr.arpa and ip6.arpa.
  if (fallbackResolver) {
    try {
      const hostnames = await fallbackResolver.reverse(cleanIp)
      const hostname = hostnames[0] ?? ''
      cache.set(cacheKey, hostname)
      return hostname
    } catch (error) {
      // A definitive "no PTR record" is cached; transient failures retry next refresh.
      const code = (error as { code?: string }).code
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        cache.set(cacheKey, '')
        return ''
      }
      console.log(`DNS reverse failed for ${cleanIp}: ${code ?? errMessage(error)}`)
      return ''
    }
  }

  // No public resolver configured — trust the system resolver's verdict.
  if (systemCode === 'ENOTFOUND' || systemCode === 'ENODATA') cache.set(cacheKey, '')
  return ''
}

// Split the ipinfo "org" string into a company name and AS number.
function formatOrg(org: string | undefined): { name: string; number: string } {
  if (!org) return { name: '', number: '' }
  const match = org.match(/(AS\d+)\s*(.*)/)
  if (match) return { name: match[2], number: match[1] }
  return { name: org, number: '' }
}

// ----------------------------------------------------------------------------
// Data refresh
// ----------------------------------------------------------------------------

// Cap how many peers we resolve at once. Firing hundreds of simultaneous reverse-DNS
// (and geo) lookups overwhelms the resolver, so queries time out — and a timed-out
// IPv6 lookup is exactly what used to get cached as an empty hostname.
const PEER_LOOKUP_CONCURRENCY = 16

// Like Promise.all(items.map(fn)) but with a bounded number of in-flight tasks,
// preserving input order in the result array.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function updatePeerLocations(): Promise<void> {
  try {
    const peers = await fetchPeerInfo()
    const networkInfo = await fetchNetworkInfo()
    const miningInfo = await fetchMiningInfo()

    if (!peers || peers.length === 0) {
      console.warn('No peer information available')
      return
    }

    const peerLocations = await mapWithConcurrency(
      peers,
      PEER_LOOKUP_CONCURRENCY,
      async (peer): Promise<NodeLocation | null> => {
        const fullAddr = peer.addr
        const ip = extractIp(peer.addr)
        if (!isValidIp(ip) || isLocalAddress(ip)) {
          console.warn('Invalid or local IP address skipped:', ip)
          return null
        }

        const geoInfo = (await getGeoLocation(ip)) ?? {}
        // Prefer the PTR record; fall back to the hostname ipinfo.io reports (if any).
        const hostname = (await reverseDnsLookup(ip)) || geoInfo.hostname || ''
        const orgInfo = formatOrg(geoInfo.org)
        return {
          ip: fullAddr,
          dnsHostname: hostname,
          userAgent: `${peer.subver}<br><span class="text-light">${peer.version}</span>`,
          blockHeight: `${peer.startingheight}<br><span class="text-light">blocks</span>`,
          location: geoInfo.loc ? geoInfo.loc.split(',') : '',
          country: `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>`,
          city: `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>`,
          org: `${orgInfo.name}<br><span class="text-light">${orgInfo.number}</span>`,
          dns: hostname,
        }
      },
    )

    const localAddresses = await mapWithConcurrency(
      networkInfo.localaddresses,
      PEER_LOOKUP_CONCURRENCY,
      async (addr): Promise<NodeLocation | null> => {
        const fullAddr = addr.address.includes(':')
          ? `[${addr.address}]:${addr.port}`
          : `${addr.address}:${addr.port}`

        const ip = extractIp(addr.address)
        if (!isValidIp(ip)) {
          console.warn('Invalid IP address skipped:', ip)
          return null
        }

        const geoInfo = (await getGeoLocation(ip)) ?? {}
        const hostname = (await reverseDnsLookup(ip)) || geoInfo.hostname || ''
        const orgInfo = formatOrg(geoInfo.org)
        return {
          ip: fullAddr,
          dnsHostname: hostname,
          userAgent: `${networkInfo.subversion}<br><span class="text-light">${networkInfo.protocolversion}</span>`,
          blockHeight: `${miningInfo.blocks}<br><span class="text-light">blocks</span>`,
          location: geoInfo.loc ? geoInfo.loc.split(',') : '',
          country: `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>`,
          city: `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>`,
          org: `${orgInfo.name}<br><span class="text-light">${orgInfo.number}</span>`,
          dns: hostname,
        }
      },
    )

    const combinedLocations = [...peerLocations, ...localAddresses].filter(
      (loc): loc is NodeLocation => loc !== null,
    )
    cache.set('peer-locations', combinedLocations)
    lastCacheUpdateTime = new Date().toISOString()

    console.log(`Peer locations updated and cached (${combinedLocations.length} entries)`)
  } catch (error) {
    console.error('Failed to fetch peer locations:', errMessage(error))
  }
}

// ----------------------------------------------------------------------------
// Server lifecycle
// ----------------------------------------------------------------------------
let updateInterval: ReturnType<typeof setInterval> | undefined
let server: ReturnType<typeof app.listen> | undefined

function startUpdateInterval(): void {
  if (updateInterval) clearInterval(updateInterval)
  updateInterval = setInterval(() => {
    void updatePeerLocations()
  }, cacheRefreshInterval)
}

// Load initial data.
void updatePeerLocations()
startUpdateInterval()

// API endpoint to serve peer location data.
app.get('/peer-locations', (_req: Request, res: Response) => {
  const locations = cache.get<NodeLocation[]>('peer-locations') ?? []
  res.json({
    // Build fresh objects per request — never mutate the cached entries, or every
    // request would re-append the hostname to loc.ip ("ip<br>host<br>host<br>...").
    locations: locations.map((loc) =>
      loc.ip && loc.dnsHostname
        ? { ...loc, ip: `${loc.ip}<br><span class="text-light">${loc.dnsHostname}</span>` }
        : loc,
    ),
    lastUpdated: lastCacheUpdateTime,
  })
})

// Serve the built client (or redirect to the Vite dev server in development).
if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'development') {
    const viteDevPort = process.env.VITE_DEV_PORT || '5173'
    console.log(`Running in development mode, Vite handles client rendering on port ${viteDevPort}`)
    app.use('/', (_req, res) => {
      res.redirect(302, `http://localhost:${viteDevPort}/`)
    })
  } else {
    app.use(express.static(path.join(__dirname, 'dist')))
    app.use('/', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'))
    })
  }
}

function startServer() {
  server = app.listen(port, () => {
    console.log(`Node Map Server running on http://localhost:${port}`)
    console.log(`Cache refresh interval is set to ${cacheRefreshInterval / 1000 / 60} minutes`)
  })
  return server
}

if (process.env.NODE_ENV !== 'test') startServer()

function shutdownServer(): Promise<void> {
  return new Promise((resolve) => {
    if (updateInterval) {
      clearInterval(updateInterval)
      updateInterval = undefined
    }
    if (server) {
      server.close(() => {
        console.log('Server shutdown complete')
        resolve()
      })
    } else {
      resolve()
    }
  })
}

export {
  app,
  fetchPeerInfo,
  fetchNetworkInfo,
  fetchMiningInfo,
  startServer,
  shutdownServer,
  extractIp,
  reverseDnsLookup,
  updatePeerLocations,
}
