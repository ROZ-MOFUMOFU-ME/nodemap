# Node Map
[![Join the chat at https://github.com/ROZ-MOFUMOFU-ME/nodemap/](https://badges.gitter.im/Join%20Chat.svg)](https://matrix.to/#/#nodemap:gitter.im)
[![Node.js CI](https://github.com/ROZ-MOFUMOFU-ME/nodemap/actions/workflows/node.js.yml/badge.svg)](https://github.com/ROZ-MOFUMOFU-ME/nodemap/actions/workflows/node.js.yml)
[![CircleCI](https://circleci.com/gh/ROZ-MOFUMOFU-ME/nodemap/tree/main.svg?style=svg)](https://circleci.com/gh/ROZ-MOFUMOFU-ME/nodemap/tree/main)

![initial](https://github.com/user-attachments/assets/4eef45dc-0e96-4124-813c-abe68551d958)

This project provides a web application for displaying information about cryptocurrency coin daemon nodes using RPC. It visualizes node data on a OpenStreetMap and displays detailed information in a table format. The project is built with Node.js and uses PureCSS for styling.

## Features

- Visual representation of coin nodes on a OpenStreetMap.
- Node data will be cached for 60 minutes.
- Detailed table view showing using IPinfo.io:
  - IP address and Hostname (if available)
  - User agent (Wallet Version)
  - Coin block height
  - Country and Timezone
  - Location (City, States)
  - Network details, ASN Number

## Prerequisites

Before you begin, ensure you have met the following requirements:
- You have installed Node.js 12+ and npm 6+.
- You have a basic understanding of JavaScript and Node.js.
- You have a cryptocurrency daemon node can accessible via RPC.
- You have a IPinfo.io token or something else.
- You have a Reverse Proxy and web server. (Recommend Nginx)

## Installing Node Map

To install Node Map, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/ROZ-MOFUMOFU-ME/nodemap.git
   ```
2. Navigate to the project directory:
   ```bash
   cd nodemap
   ```
3. Install the necessary packages:
   ```bash
   npm install
   ```
4. Add RPC Client Settings and IPinfo token and Google Maps API Key to the `.env` file:
   ```app.js
   # RPC server settings
   DAEMON_RPC_HOST=127.0.0.1
   DAEMON_RPC_PORT=8333
   DAEMON_RPC_USERNAME=your_username
   DAEMON_RPC_PASSWORD=your_password
   DAEMON_RPC_SSL=false
   DAEMON_RPC_TIMEOUT=30000

   # IPinfo.io token
   IPINFO_TOKEN=your_ipinfo_token

   # Interval to update data
   CACHE_REFRESH_INTERVAL=3600000

   # Node Map server port
   PORT=3000

   # Vite development server port
   VITE_DEV_PORT=5173
   ```
   
## Using Node Map

To use Node Map, run the following command from the root of the project:
  ```bash
  npm run build
  ```
and
  ```bash
  npm run start
  ```
or
  ```bash
  pm2 start npm --name nodemap -- start
  ```

Open your web browser and navigate to `http://localhost:3000` to view nodemap.

## Publish on the Internet

### Set up reverse proxy and wev server e.g. Nginx
   ```nginx.conf
   server {
       listen                  443 ssl http2;
       listen                  [::]:443 ssl http2;
       server_name             nodemap.exaple.com;
       root                    /path/to/nodemap/dist;

       # SSL
       ssl_certificate         /etc/letsencrypt/live/exaple.com/fullchain.pem;
       ssl_certificate_key     /etc/letsencrypt/live/exaple.com/privkey.pem;
       ssl_trusted_certificate /etc/letsencrypt/live/exaple.com/chain.pem;

       # logging
       access_log              /var/log/nginx/access.log combined buffer=512k flush=1m;
       error_log               /var/log/nginx/error.log warn;

       # reverse proxy
       location / {
           proxy_pass                         http://127.0.0.1:3000;
           proxy_set_header Host              $host;
           proxy_http_version                 1.1;
           proxy_cache_bypass                 $http_upgrade;

           # Proxy SSL
           proxy_ssl_server_name              on;

           # Proxy headers
           proxy_set_header Upgrade           $http_upgrade;
           proxy_set_header Connection        $connection_upgrade;
           proxy_set_header X-Real-IP         $remote_addr;
           proxy_set_header Forwarded         $proxy_add_forwarded;
           proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_set_header X-Forwarded-Host  $host;
           proxy_set_header X-Forwarded-Port  $server_port;

           # Proxy timeouts
           proxy_connect_timeout              60s;
           proxy_send_timeout                 60s;
           proxy_read_timeout                 60s;
       }      
   ```
[nginxconfig.io](https://www.digitalocean.com/community/tools/nginx) This site is useful to setup Nginx!

### start reverse proxy and web server
   ```
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```
Accessing example.com will show nodemap.

## Contributing to Node Map

To contribute to Node Map, follow these steps:

1. Fork this repository.
2. Create a branch: `git checkout -b <branch_name>`.
3. Make your changes and commit them: `git commit -m '<commit_message>'`
4. Push to the original branch: `git push origin <project_name>/<location>`
5. Create the pull request.

Alternatively, see the GitHub documentation on [creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/ROZ-MOFUMOFU-ME/nodemap/blob/main/LICENSE) file for details.

## Contact

ROZ: [@ROZ_mofumofu_me](https://twitter.com/ROZ_mofumofu_me)

Aoi Emerauda: [@Aoi_Emerauda](https://twitter.com/Aoi_Emerauda) Alternative

Project Link: [https://github.com/ROZ-MOFUMOFU-ME/nodemap](https://github.com/ROZ-MOFUMOFU-ME/nodemap)

## Credits

* [ROZ](https://github.com/ROZ-MOFUMOFU-ME) - Author

* [Aoi Emerauda](https://github.com/emerauda) - Alternative

## Donations

Donations for development are greatly appreciated!

[GitHub Sponsors](https://github.com/sponsors/ROZ-MOFUMOFU-ME)

[Patreon](https://patreon.com/emerauda)

[FANBOX](https://emerauda.fanbox.cc/)

[Fantia](https://fantia.jp/emerauda)

[Buy Me a Coffee](https://buymeacoffee.com/emerauda)

BTC: 3FpbJ5cotwPZQn9fcdZrPv4h72XquzEvez

ETH: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae

LTC: Lh96WZ7Rw9Wf4GDX2KXpzieneZFV5Xe5ou

BCH: pzdsppue8uwc20x35psaqq8sgchkenr49c0qxzazxu

ETC: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae

MONA: MLEqE3vi11j4ZguMjkvMn5rUtze6kXbAzQ
