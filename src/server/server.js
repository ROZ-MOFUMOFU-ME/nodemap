import fs from 'fs';
import NodeCache from 'node-cache';
import axios from 'axios';
import * as dns from 'dns';
const dnsPromises = dns.promises;
import Client from 'bitcoin-core';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function loadEnvVariables() {
    const envPath = path.join(__dirname, '../../.env');
    try {
        const data = fs.readFileSync(envPath, 'utf8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const [key, value] = trimmedLine.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
        console.log('.env variables loaded successfully');
    } catch (error) {
        console.error('Failed to read .env file:', error.message);
    }
}

// Function to validate environment variables
function validateEnvironmentVars() {
    if (process.env.NODE_ENV === 'test') {
        process.env.DAEMON_RPC_HOST = process.env.DAEMON_RPC_HOST || 'dummy-host';
        process.env.IPINFO_TOKEN = process.env.IPINFO_TOKEN || 'dummy-token';
        return;
    }

    const requiredVars = ['DAEMON_RPC_HOST', 'IPINFO_TOKEN'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length) {
        console.error("Missing required environment variables:", missingVars.join(', '));
        process.exit(1); // Exit process with error code
    }
}

// Load environment variables
loadEnvVariables();

// Validate environment variables
validateEnvironmentVars();

const port = process.env.PORT || 3000;
console.log(`Server will run on port: ${port} (from .env)`);

// Read cache refresh interval from env (in ms), default to 60 minutes
const cacheRefreshInterval = parseInt(process.env.CACHE_REFRESH_INTERVAL, 10) || 3600000;
// Determine TTL in seconds: one‐thousandth of the refresh interval, or 3600s if not configured
const cacheTTL = process.env.CACHE_REFRESH_INTERVAL
    ? Math.floor(cacheRefreshInterval / 1000)
    : 3600;
// Initialize cache with calculated TTL
const cache = new NodeCache({ stdTTL: cacheTTL });
let lastCacheUpdateTime = null;

const isTestEnv = process.env.NODE_ENV === 'test';

let mockData = null;
let client = null;
const ipInfoToken = process.env.IPINFO_TOKEN;

if (isTestEnv) {
    try {
        const mockDataModule = await import('../../test/mockData.js');
        mockData = mockDataModule.default;
    } catch (err) {
        console.error('Error loading mock data:', err);
        mockData = {
            peerInfo: [],
            networkInfo: { localaddresses: [] },
            miningInfo: { blocks: 0 },
            geoLocation: {},
            dnsLookup: ''
        };
    }
}

// Format host address to handle IPv6 and other special cases
function formatHost(host) {
    if (!host) return 'localhost';

    // Extract host without port
    if (host.includes(':')) {
        // Don't process IPv6 addresses incorrectly
        if (host.includes('[') && host.includes(']')) {
            return host; // Return IPv6 address as is
        }
        // Remove port if included in host string
        return host.split(':')[0];
    }

    return host;
}

// Initialize client for production environment
if (!isTestEnv) {
    try {
        const rpcHost = process.env.DAEMON_RPC_HOST || 'localhost';
        const rpcPort = process.env.DAEMON_RPC_PORT || '8332';
        const rpcSsl = process.env.DAEMON_RPC_SSL === 'true';
        const rpcUser = process.env.DAEMON_RPC_USERNAME;
        const rpcPass = process.env.DAEMON_RPC_PASSWORD;

        const protocol = rpcSsl ? 'https://' : 'http://';

        console.log(`Connecting to RPC with URL: ${protocol}${rpcHost}:${rpcPort}`);

        // Correct initialization method for bitcoin-core v5
        client = new Client({
            network: 'mainnet',
            baseUrl: `${protocol}${rpcHost}:${rpcPort}`,
            username: rpcUser,
            password: rpcPass,
            timeout: parseInt(process.env.DAEMON_RPC_TIMEOUT || '30000')
        });
    } catch (error) {
        console.error("Failed to initialize RPC client:", error.message);
    }
}

console.log("Connecting to Daemon RPC:", {
    host: process.env.DAEMON_RPC_HOST,
    port: process.env.DAEMON_RPC_PORT,
    ssl: process.env.DAEMON_RPC_SSL
});
console.log(`Connecting to RPC with host: ${formatHost(process.env.DAEMON_RPC_HOST)}, port: ${process.env.DAEMON_RPC_PORT}`);

// Function to retrieve peer information
async function fetchPeerInfo() {
    if (isTestEnv) {
        return mockData.peerInfo;
    }
    const protocol = process.env.DAEMON_RPC_SSL === 'true' ? 'https' : 'http';
    let host = process.env.DAEMON_RPC_HOST;
    const port = process.env.DAEMON_RPC_PORT;

    // Adjust host to include port if there's no path
    if (!host.includes('/')) {
        host = `${host}:${port}`;
    }

    const rpcUrl = `${protocol}://${host}`;
    const rpcData = {
        jsonrpc: '1.0',
        id: 'curltest',
        method: 'getpeerinfo',
        params: []
    };

    try {
        const response = await axios.post(rpcUrl, rpcData, {
            auth: {
                username: process.env.DAEMON_RPC_USERNAME,
                password: process.env.DAEMON_RPC_PASSWORD
            },
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        console.log("Peer info received: ", response.data);
        return response.data.result;
    } catch (error) {
        console.error('Error accessing Coin Daemon for getpeerinfo:', error.message);
        console.error('Full Error details:', JSON.stringify(error, null, 2));
        return [];
    }
}

// Function to retrieve network information, with fallback to getinfo if getnetworkinfo fails
async function fetchNetworkInfo() {
    if (isTestEnv) {
        return mockData.networkInfo;
    }

    const protocol = process.env.DAEMON_RPC_SSL === 'true' ? 'https' : 'http';
    let host = process.env.DAEMON_RPC_HOST;
    const port = process.env.DAEMON_RPC_PORT;

    // Adjust host to include port if there's no path
    if (!host.includes('/')) {
        host = `${host}:${port}`;
    }

    const rpcUrl = `${protocol}://${host}`;
    const rpcData = {
        jsonrpc: '1.0',
        id: 'curltest',
        method: 'getnetworkinfo',
        params: []
    };

    try {
        const response = await axios.post(rpcUrl, rpcData, {
            auth: {
                username: process.env.DAEMON_RPC_USERNAME,
                password: process.env.DAEMON_RPC_PASSWORD
            },
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        console.log("Network info received: ", response.data);
        return response.data.result || { localaddresses: [] };
    } catch (error) {
        console.error('Error accessing Coin Daemon for getnetworkinfo:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));

        // Try getinfo as fallback
        try {
            const infoData = {
                jsonrpc: '1.0',
                id: 'curltest',
                method: 'getinfo',
                params: []
            };

            const infoResponse = await axios.post(rpcUrl, infoData, {
                auth: {
                    username: process.env.DAEMON_RPC_USERNAME,
                    password: process.env.DAEMON_RPC_PASSWORD
                },
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            const info = infoResponse.data.result || {};
            return {
                subversion: info.version,
                protocolversion: info.protocolversion,
                localaddresses: [{
                    address: info.ip,
                    port: process.env.DAEMON_RPC_PORT || 8876
                }],
            };
        } catch (fallbackError) {
            console.error('Error accessing Coin Daemon for getinfo:', fallbackError.message);
            return { localaddresses: [] };
        }
    }
}

// Function to retrieve mining information
async function fetchMiningInfo() {
    if (isTestEnv) {
        return mockData.miningInfo;
    }

    const protocol = process.env.DAEMON_RPC_SSL === 'true' ? 'https' : 'http';
    let host = process.env.DAEMON_RPC_HOST;
    const port = process.env.DAEMON_RPC_PORT;

    // Adjust host to include port if there's no path
    if (!host.includes('/')) {
        host = `${host}:${port}`;
    }

    const rpcUrl = `${protocol}://${host}`;
    const rpcData = {
        jsonrpc: '1.0',
        id: 'curltest',
        method: 'getmininginfo',
        params: []
    };

    try {
        const response = await axios.post(rpcUrl, rpcData, {
            auth: {
                username: process.env.DAEMON_RPC_USERNAME,
                password: process.env.DAEMON_RPC_PASSWORD
            },
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        console.log("Mining info received: ", response.data);
        return response.data.result || {};
    } catch (error) {
        console.error('Error accessing Coin Daemon for getmininginfo:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return {};
    }
}

// Helper function to validate IP addresses (IPv4 and IPv6)
function isValidIp(ip) {
    const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$|^fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}$|^::(ffff(:0{1,4}){0,1}:){0,1}(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,5})$|^([0-9a-fA-F]{1,4}:){1,4}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}:([0-9a-fA-F]{1,4}:){1,7}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

// Skip local and private addresses
function isLocalAddress(ip) {
    return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) ||
        ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("fe80:") || (ip.startsWith("172.") && parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31);
}

// Helper function to extract IP address
function extractIp(address) {
    if (!address) return '';
    if (address.includes('[') && address.includes(']')) {
        return address.substring(1, address.indexOf(']'));
    }
    else if (address.includes(':') && address.split(':').length === 2) {
        return address.split(':')[0];
    }
    else if (address.includes(':')) {
        const lastColonIndex = address.lastIndexOf(':');
        const afterLastColon = address.substring(lastColonIndex + 1);

        if (/^\d+$/.test(afterLastColon) && lastColonIndex > 0) {
            return address.substring(0, lastColonIndex);
        }
        return address;
    }
    else {
        return address;
    }
}

// Fetches geolocation information using the ipinfo.io API
async function getGeoLocation(ip) {
    if (isTestEnv) {
        return mockData.geoLocation;
    }
    if (!isValidIp(ip)) {
        console.warn('Invalid IP address:', ip);
        return null;
    }
    const cacheKey = `geo:${ip}`;
    const data = cache.get(cacheKey);
    if (data) return data;

    try {
        const cleanIp = ip.replace(/\[|\]/g, '');
        const encodedIP = encodeURIComponent(cleanIp);
        const url = `https://ipinfo.io/${encodedIP}?token=${ipInfoToken}`;
        console.log("Requesting URL:", url);
        const response = await axios.get(url);
        cache.set(cacheKey, response.data);
        console.log("API Response: ", response.data);
        return response.data;
    } catch (error) {
        console.error('Error getting location data for IP:', ip, error.message);
        return null;
    }
}

// Fixed DNS lookups for specific IP addresses
const fixedDnsLookups = {
    "8.8.8.8": "dns.google",
    "1.1.1.1": "one.one.one.one",
};

// Function to performs a reverse DNS lookup
async function reverseDnsLookup(ip) {
    if (isTestEnv) {
        return mockData.dnsLookup;
    }

    // Log the original IP address (for debugging)
    console.log(`Performing DNS lookup for IP: ${ip}`);

    // Normalize IP address (remove brackets and port number)
    const cleanIp = extractIp(ip);
    console.log(`Normalized IP for DNS lookup: ${cleanIp}`);

    // Check fixed DNS lookups
    for (const fixedIp of Object.keys(fixedDnsLookups)) {
        if (fixedIp === cleanIp) {
            console.log(`Fixed DNS match found: ${fixedIp} -> ${fixedDnsLookups[fixedIp]}`);
            return fixedDnsLookups[fixedIp];
        }
    }

    // Check cache
    const cacheKey = `dns:${cleanIp}`;
    let data = cache.get(cacheKey);
    if (data) {
        console.log(`DNS cache hit for ${cleanIp}: ${data}`);
        return data;
    }

    try {
        const hostnames = await dnsPromises.reverse(cleanIp);
        if (hostnames && hostnames.length > 0) {
            console.log(`DNS lookup successful for ${cleanIp}: ${hostnames[0]}`);
            cache.set(cacheKey, hostnames[0]);
            return hostnames[0];
        }
        console.log(`No DNS records found for ${cleanIp}`);
        return '';
    } catch (error) {
        // DNS lookup failed silently
        console.log(`DNS lookup failed for ${cleanIp}: ${error.message}`);
        cache.set(cacheKey, ''); // Cache empty result to avoid repeated lookups
        return '';
    }
}

// Function to format the 'org' data without adding HTML tags
function formatOrg(org) {
    if (!org) return { name: '', number: '' };
    const regex = /(AS\d+)\s*(.*)/;
    const match = org.match(regex);
    if (match) {
        // Return the company name and AS number as separate properties
        return { name: match[2], number: match[1] };
    }
    return { name: org, number: '' };
}

// Endpoint to serve peer location data
async function updatePeerLocations() {
    try {
        const peers = await fetchPeerInfo();
        const networkInfo = await fetchNetworkInfo();
        const miningInfo = await fetchMiningInfo();

        if (!peers || peers.length === 0) {
            console.warn('No peer information available');
            return;
        }

        const peerLocations = await Promise.all(peers.map(async peer => {
            const fullAddr = peer.addr;
            const ip = extractIp(peer.addr);
            if (!isValidIp(ip) || isLocalAddress(ip)) {
                console.warn('Invalid or local IP address skipped:', ip);
                return null;
            }

            const geoInfo = await getGeoLocation(ip) || {};
            // Get DNS hostname with proper error handling
            const dnsLookup = await reverseDnsLookup(ip) || '';
            const orgInfo = formatOrg(geoInfo.org);
            const blocks = "blocks";
            return {
                ip: `${fullAddr}`,
                dnsHostname: dnsLookup,
                userAgent: `${peer.subver}<br><span class="text-light">${peer.version}</span>`,
                blockHeight: `${peer.startingheight.toString()}<br><span class="text-light">${blocks}</span>`,
                location: geoInfo.loc ? geoInfo.loc.split(',') : '',
                country: `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>`,
                city: `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>`,
                org: `${orgInfo.name}<br><span class="text-light">${orgInfo.number}</span>`,
                dns: dnsLookup // Keep for compatibility
            };
        }));

        const localAddresses = await Promise.all(networkInfo.localaddresses.map(async addr => {
            let fullAddr;
            if (addr.address.includes(':')) {
                fullAddr = `[${addr.address}]:${addr.port}`;
            } else {
                fullAddr = `${addr.address}:${addr.port}`;
            }

            const ip = extractIp(addr.address);
            console.log(`Processing localAddress: ${addr.address}, extracted IP: ${ip}`);

            if (!isValidIp(ip)) {
                console.warn('Invalid IP address skipped:', ip);
                return null;
            }

            // Perform DNS resolution first, then get geoLocation
            const dnsLookup = await reverseDnsLookup(ip) || '';
            console.log(`DNS lookup result for ${ip}: ${dnsLookup}`);

            const geoInfo = await getGeoLocation(ip) || {};
            const orgInfo = formatOrg(geoInfo.org);
            const blocks = "blocks";

            return {
                ip: fullAddr,
                dnsHostname: dnsLookup, // Save DNS hostname as a separate property
                userAgent: `${networkInfo.subversion}<br><span class="text-light">${networkInfo.protocolversion}</span>`,
                blockHeight: `${miningInfo.blocks.toString()}<br><span class="text-light">${blocks}</span>`,
                location: geoInfo.loc ? geoInfo.loc.split(',') : '',
                country: `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>`,
                city: `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>`,
                org: `${orgInfo.name}<br><span class="text-light">${orgInfo.number}</span>`,
                dns: dnsLookup
            };
        }));

        // Combine peer locations with local address locations
        const combinedLocations = peerLocations.filter(location => location).concat(localAddresses);
        cache.set('peer-locations', combinedLocations);
        const now = new Date();
        lastCacheUpdateTime = now.toISOString();

        console.log(`Peer locations updated and cached at ${now.toLocaleString(undefined, { timeZoneName: 'short' })}`);
    } catch (error) {
        console.error('Failed to fetch peer locations:', error.message);
    }
}

// Replace existing setInterval
let updateInterval;
let server;

// Store timer in an exportable variable
function startUpdateInterval() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = setInterval(updatePeerLocations, cacheRefreshInterval);
}

// Load initial data
updatePeerLocations();
startUpdateInterval();

app.get('/peer-locations', (req, res) => {
    const locations = cache.get('peer-locations') || [];
    res.json({
        locations: locations.map(loc => {
            // If DNS hostname is available, add it to the display
            if (loc.ip && loc.dnsHostname) {
                loc.ip = `${loc.ip}<br><span class="text-light">${loc.dnsHostname}</span>`;
            }
            return loc;
        }),
        lastUpdated: lastCacheUpdateTime
    });
});

// Configure server startup
if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV === 'development') {
        const viteDevPort = process.env.VITE_DEV_PORT || '5173';
        console.log(`Running in development mode, Vite handles client rendering on port ${viteDevPort}`);
        app.use('/', (req, res) => {
            res.writeHead(302, {
                'Location': `http://localhost:${viteDevPort}/`
            });
            res.end();
        });
    } else {
        app.use(express.static(path.join(__dirname, '../../dist')));
        app.use('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
        });
    }
}

// API endpoint to serve peer location data
app.get('/peer-locations', (req, res) => {
    const locations = cache.get('peer-locations') || [];
    res.json({
        locations: locations.map(loc => {
            // If DNS hostname is available, add it to the display
            if (loc.ip && loc.dnsHostname) {
                loc.ip = `${loc.ip}<br><span class="text-light">${loc.dnsHostname}</span>`;
            }
            return loc;
        }),
        lastUpdated: lastCacheUpdateTime
    });
});

// Export function to set the client variable
export function setClient(newClient) {
    client = newClient;
    console.log('Test client has been set successfully');
}

// Store server in an exportable variable
function startServer() {
    server = app.listen(port, () => {
        console.log(`Node Map Server running on http://localhost:${port}`);
        console.log(`Cache refresh interval is set to ${cacheRefreshInterval / 1000 / 60} minutes`);
    });
    return server;
}

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

// Export function to shutdown the server
export function shutdownServer() {
    return new Promise((resolve) => {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        if (server) {
            server.close(() => {
                console.log('Server shutdown complete');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Export remaining functions
export { app, fetchPeerInfo, fetchNetworkInfo, fetchMiningInfo, startServer };