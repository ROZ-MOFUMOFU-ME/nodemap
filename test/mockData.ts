const mockData = {
  peerInfo: [
    {
      addr: '127.0.0.1',
      subver: '/Satoshi:0.19.0.1/',
      version: '70015',
      startingheight: 123456,
    },
    {
      // Bracketed IPv6 with a port — its reverse-DNS hostname must reach the table.
      addr: '[2001:db8::1234]:8333',
      subver: '/Satoshi:0.21.0/',
      version: '70016',
      startingheight: 123457,
    },
    {
      // IPv4 with a port — its reverse-DNS hostname must reach the table.
      addr: '203.0.113.5:8333',
      subver: '/Satoshi:0.21.0/',
      version: '70016',
      startingheight: 123458,
    },
  ],
  networkInfo: {
    subversion: '/Satoshi:0.19.0.1/',
    protocolversion: '70015',
    localaddresses: [{ address: '127.0.0.1' }],
  },
  miningInfo: {
    blocks: 123456,
  },
  geoLocation: {
    loc: '35.6895,139.6917',
    country: 'JP',
    city: 'Tokyo',
    org: 'Test Org',
  },
  dnsLookup: 'test-dns',
}

export default mockData
