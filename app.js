const express = require('express');
const Client = require('bitcoin-core');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Exit if required environment variables are not set
if (!process.env.DAEMON_RPC_HOST || !process.env.IPINFO_TOKEN) {
    console.error("Required environment variables are not set.");
    process.exit(1);
}

// Configure coind client
const client = new Client({
    host: process.env.DAEMON_RPC_HOST,
    port: process.env.DAEMON_RPC_PORT,
    username: process.env.DAEMON_RPC_USERNAME,
    password: process.env.DAEMON_RPC_PASSWORD,
    ssl: process.env.DAEMON_RPC_SSL === 'true',
    timeout: parseInt(process.env.DAEMON_RPC_TIMEOUT || '30000')
});

const ipInfoToken = process.env.IPINFO_TOKEN;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

// Attempt to get peer information
client.command('getpeerinfo').then((response) => {
    // console.log("Coin Daemon Peer Info:", response);
}).catch((error) => {
    console.error('Error accessing Coin Daemon:', error);
});

// Extract IP address from connection details
function extractIp(address) {
    if (address.includes('[')) {
        return address.substring(0, address.indexOf(']') + 1);
    }
    return address.split(':')[0];
}

// Fetch geolocation information
async function getGeoLocation(ip) {
    try {
        const cleanIp = ip.replace(/\[|\]/g, '');
        const encodedIP = encodeURIComponent(cleanIp);
        const url = `https://ipinfo.io/${encodedIP}?token=${ipInfoToken}`;
        // console.log("Requesting URL:", url);
        const response = await axios.get(url);
        // console.log("API Response: ", response.data);
        return response.data;
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
}

// Endpoint to provide peer location information
app.get('/peer-locations', async (req, res) => {
    try {
        const peers = await client.command('getpeerinfo');
        const locations = [];

        for (const peer of peers) {
            const ip = extractIp(peer.addr);

            // Skip local network and localhost IPs
            if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("172.")) {
                continue;
            }

            const geoInfo = await getGeoLocation(ip) || {};
            locations.push({
                ip: ip + '<br><span class="text-light">' + (await reverseDnsLookup(ip) + '</span>' || ''),
                userAgent: peer.subver + '<br><span class="text-light">' + peer.version + '</span>',
                blockHeight: peer.startingheight,
                location: geoInfo.loc ? geoInfo.loc.split(',') : '',
                country: (geoInfo.country && geoInfo.timezone) ? `${geoInfo.country}<br><span class="text-light">${geoInfo.timezone}</span>` : '',
                region: geoInfo.region || '',
                city: (geoInfo.city && geoInfo.region) ? `${geoInfo.city}<br><span class="text-light">${geoInfo.region}</span>` : '',
                hostname: geoInfo.hostname || '',
                org: (geoInfo.asn && geoInfo.asn.name) ? `${geoInfo.asn.name}<br><span class="text-light">${geoInfo.asn.asn}</span>` : ''
            });
        }

        res.json(locations);
    } catch (error) {
        console.error('Failed to fetch peer locations:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Reverse DNS lookup
async function reverseDnsLookup(ip) {
    const dns = require('dns').promises;
    try {
        const hostnames = await dns.reverse(ip);
        return hostnames[0];
    } catch (error) {
        return '';
    }
}

// Serve static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.get('/', (req, res) => {
    res.render('index', { googleMapsApiKey: googleMapsApiKey });
});

// Start the server
app.listen(port, () => {
    console.log(`Node Map Server running on port ${port}`);
});
