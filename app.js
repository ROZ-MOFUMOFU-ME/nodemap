const express = require('express');
const Client = require('bitcoin-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const NodeCache = require('node-cache');
const app = express();

function loadEnvVariables() {
    const envPath = path.join(__dirname, '.env');
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
loadEnvVariables();

const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // Setup cache TTL set for 60 minutes
const cacheRefreshInterval = process.env.CACHE_REFRESH_INTERVAL || 3600000; // Default interval set for 60 minutes
let lastCacheUpdateTime = null;

const isTestEnv = process.env.NODE_ENV === 'test';

let client;
const ipInfoToken = process.env.IPINFO_TOKEN;

if (isTestEnv) {
    var mockData = require('./test/mockData');
}

// Validates essential environment variables are set
const requiredVars = ['DAEMON_RPC_HOST', 'IPINFO_TOKEN'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length) {
    console.log("Missing required environment variables:", missingVars.join(', '));
    return;
}

// Function to set the client (for testing purposes)
function setClient(newClient) {
    client = newClient;
}

// Helper function to check if a string is a URL
function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (error) {
        return false;
    }
}

// Helper function to check if a string is an IPv6 address
function isIPv6(address) {
    return /^[0-9a-fA-F:]+$/.test(address);
}

// Function to wrap IPv6 address with brackets or leave URLs intact
function formatHost(address) {
    if (isUrl(address)) {
        return address; // Return as is if it's a URL
    }
    return isIPv6(address) ? `[${address}]` : address;
}

// Initialize client for production environment
if (!isTestEnv) {
    client = new Client({
        host: formatHost(process.env.DAEMON_RPC_HOST), // Use the new helper function here
        port: process.env.DAEMON_RPC_PORT,
        username: process.env.DAEMON_RPC_USERNAME,
        password: process.env.DAEMON_RPC_PASSWORD,
        ssl: process.env.DAEMON_RPC_SSL === 'true',
        timeout: parseInt(process.env.DAEMON_RPC_TIMEOUT || '30000')
    });
}

console.log("Connecting to Sugarchain RPC:", {
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
    try {
        const result = await client.command('getnetworkinfo');
        return result || { localaddresses: [] };
    } catch (error) {
        console.error('Error accessing Coin Daemon for getnetworkinfo:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
        try {
            const info = await client.command('getinfo');
            return {
                subversion: info.version,
                protocolversion: info.protocolversion,
                localaddresses: [{
                    address: info.ip,
                    port: process.env.DAEMON_RPC_PORT || 8332
                }],
            };
        } catch (fallbackError) {
            console.error('Error accessing Coin Daemon for getinfo:', fallbackError);
            console.error('Error details:', JSON.stringify(fallbackError, null, 2));
            return { localaddresses: [] };
        }
    }
}

// Function to retrieve mining information
async function fetchMiningInfo() {
    if (isTestEnv) {
        return mockData.miningInfo;
    }
    try {
        const result = await client.command('getmininginfo');
        return result ? result : {};
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
    if (address.includes('[')) {
        // This is for IPv6 addresses enclosed in brackets, typically with a port
        return address.substring(1, address.indexOf(']'));
    } else if (address.includes(':')) {
        // Check if it's an IPv6 without brackets or an IPv4 with port
        const parts = address.split(':');
        if (parts.length > 2) {
            // It's an IPv6 address without brackets
            return address;
        } else {
            // It's an IPv4 address with port
            return parts[0];
        }
    } else {
        // Plain IPv4 address
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
        cache.set(cacheKey, data);
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

    if (fixedDnsLookups[ip]) {
        return fixedDnsLookups[ip];
    }

    const cacheKey = `dns:${ip}`;
    let data = cache.get(cacheKey);
    if (data) return data;

    try {
        [hostname] = await dns.reverse(ip);
        cache.set(cacheKey, hostname);
        return hostname;
    } catch (error) {
        // console.error('Reverse DNS lookup failed for IP:', ip, error);
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
            const ip = extractIp(peer.addr);
            if (!isValidIp(ip) || isLocalAddress(ip)) {
                console.warn('Invalid or local IP address skipped:', ip);
                return null;
            }

            const geoInfo = await getGeoLocation(ip) || {};
            const dnsLookup = await reverseDnsLookup(ip) || '';
            const orgInfo = formatOrg(geoInfo.org);
            const blocks = "blocks";
            return {
                ip: ip,
                userAgent: `${peer.subver}<br><span class="text-light">${peer.version}</span>`,
                blockHeight: `${peer.startingheight.toString()}<br><span class="text-light">${blocks}</span>`,
                location: geoInfo.loc ? geoInfo.loc.split(',') : '',
                country: `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>`,
                city: `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>`,
                org: `${orgInfo.name}<br><span class="text-light">${orgInfo.number}</span>`,
                dns: dnsLookup
            };
        }));

        const localAddresses = await Promise.all(networkInfo.localaddresses.map(async addr => {
            const ip = extractIp(addr.address);
            if (!isValidIp(ip)) {
                console.warn('Invalid IP address skipped:', ip);
                return null;
            }
            const geoInfo = await getGeoLocation(ip) || {};
            const dnsLookup = await reverseDnsLookup(ip) || '';
            const orgInfo = formatOrg(geoInfo.org);
            const blocks = "blocks";
            return {
                ip: ip,
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

setInterval(updatePeerLocations, cacheRefreshInterval); // Refresh cache every hour or as defined by CACHE_REFRESH_INTERVAL
updatePeerLocations(); // Initial fetch and cache when the server starts

// Configure express app and routes...
app.get('/peer-locations', async (req, res) => {
    try {
        let locations = cache.get('peer-locations');
        if (!locations) {
            console.log('No data available in cache, updating peer locations...');
            await updatePeerLocations();
            locations = cache.get('peer-locations');
        }

        if (locations) {
            console.log('Returning cached locations:', locations);
            res.json({
                locations: locations.map(location => ({
                    ...location,
                    ip: `${location.ip}<br><span class="text-light">${location.dns}</span>`
                })),
                lastUpdated: lastCacheUpdateTime
            });
        } else {
            console.log('No data available after update');
            res.status(404).json({ error: 'No data available' });
        }
    } catch (error) {
        console.error('Error in /peer-locations endpoint:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Configures static file serving and ejs view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(express.static('public'));

// Main page route
app.get('/', (req, res) => {
    res.render('index');
});

// Start the server
app.listen(port, () => {
    console.log(`Node Map Server running on http://localhost:${port}`);
    console.log(`Cache refresh interval is set to ${cacheRefreshInterval / 1000 / 60} minutes`);
});

module.exports = { app, setClient };