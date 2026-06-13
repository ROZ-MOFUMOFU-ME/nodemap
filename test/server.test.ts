import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, extractIp, reverseDnsLookup, shutdownServer, updatePeerLocations } from '../server'

afterAll(async () => {
  await shutdownServer()
})

describe('GET /peer-locations', () => {
  it('responds with HTTP 200 and a locations array', async () => {
    const res = await request(app).get('/peer-locations')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('locations')
    expect(Array.isArray(res.body.locations)).toBe(true)
    expect(res.body).toHaveProperty('lastUpdated')
  })
})

describe('GET /peer-locations reverse DNS', () => {
  beforeAll(async () => {
    // Populate the cache deterministically before asserting on its contents.
    await updatePeerLocations()
  })

  it('appends the reverse-DNS hostname to IPv6 peers', async () => {
    const res = await request(app).get('/peer-locations')
    const ips: string[] = res.body.locations.map((loc: { ip: string }) => loc.ip)

    // Regression: IPv6 peers resolved their PTR but the hostname never reached the
    // table. The row must carry both the (bracketed) address and the hostname.
    const ipv6 = ips.find((ip) => ip.includes('2001:db8::1234'))
    expect(ipv6).toBeDefined()
    expect(ipv6).toContain('test-dns')
  })

  it('appends the reverse-DNS hostname to IPv4 peers', async () => {
    const res = await request(app).get('/peer-locations')
    const ips: string[] = res.body.locations.map((loc: { ip: string }) => loc.ip)

    const ipv4 = ips.find((ip) => ip.includes('203.0.113.5'))
    expect(ipv4).toBeDefined()
    expect(ipv4).toContain('test-dns')
  })
})

describe('reverseDnsLookup PTR overrides (site.config.ts)', () => {
  it('applies an IPv4 override', async () => {
    expect(await reverseDnsLookup('1.1.1.1')).toBe('one.one.one.one')
  })

  it('applies an IPv6 override regardless of case / zero-compression / brackets', async () => {
    // site.config maps 2606:4700:4700::1111 -> one.one.one.one
    expect(await reverseDnsLookup('2606:4700:4700::1111')).toBe('one.one.one.one')
    expect(await reverseDnsLookup('2606:4700:4700:0:0:0:0:1111')).toBe('one.one.one.one')
    expect(await reverseDnsLookup('[2606:4700:4700::1111]:8333')).toBe('one.one.one.one')
  })

  it('falls through for addresses without an override', async () => {
    // In the test environment, non-overridden lookups return the mock hostname.
    expect(await reverseDnsLookup('203.0.113.5')).toBe('test-dns')
  })
})

describe('extractIp', () => {
  it('returns IPv4 unchanged', () => {
    expect(extractIp('1.2.3.4')).toBe('1.2.3.4')
  })

  it('strips the port from "ipv4:port"', () => {
    expect(extractIp('1.2.3.4:8333')).toBe('1.2.3.4')
  })

  it('strips the port from "host:port"', () => {
    expect(extractIp('example.com:8333')).toBe('example.com')
  })

  it('unwraps bracketed IPv6 with a port', () => {
    expect(extractIp('[2001:db8::1]:8333')).toBe('2001:db8::1')
  })

  it('unwraps bracketed IPv6 without a port', () => {
    expect(extractIp('[2001:db8::1]')).toBe('2001:db8::1')
  })

  // Regression: a bare IPv6 whose final group is all digits used to be mangled
  // into "2001:db8:" (the trailing group treated as a port), which broke reverse DNS.
  it('returns a bare IPv6 with an all-digit final group unchanged', () => {
    expect(extractIp('2001:db8::1')).toBe('2001:db8::1')
    expect(extractIp('2001:4860:4860::8888')).toBe('2001:4860:4860::8888')
    expect(extractIp('fe80::1')).toBe('fe80::1')
    expect(extractIp('::1')).toBe('::1')
  })

  it('is idempotent (re-extracting an already bare address is a no-op)', () => {
    expect(extractIp(extractIp('[2001:db8::1]:8333'))).toBe('2001:db8::1')
    expect(extractIp(extractIp('1.2.3.4:8333'))).toBe('1.2.3.4')
  })

  it('returns an empty string for falsy input', () => {
    expect(extractIp('')).toBe('')
    expect(extractIp(undefined)).toBe('')
  })
})
