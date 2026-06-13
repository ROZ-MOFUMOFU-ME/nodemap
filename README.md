# Node Map

[![CI](https://img.shields.io/github/actions/workflow/status/ROZ-MOFUMOFU-ME/nodemap/node.js.yml?branch=main&style=flat&logo=githubactions&logoColor=white&label=CI)](https://github.com/ROZ-MOFUMOFU-ME/nodemap/actions/workflows/node.js.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-5FA04E?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/ROZ-MOFUMOFU-ME/nodemap?style=flat&color=blue)](https://github.com/ROZ-MOFUMOFU-ME/nodemap/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ROZ-MOFUMOFU-ME/nodemap?style=flat&logo=github&color=yellow)](https://github.com/ROZ-MOFUMOFU-ME/nodemap/stargazers)

![initial](https://github.com/user-attachments/assets/4eef45dc-0e96-4124-813c-abe68551d958)

This project provides a web application for displaying information about cryptocurrency coin daemon nodes using RPC. It visualizes node data on an OpenStreetMap and displays detailed information in a table format. The backend is a TypeScript + Express API (run directly with [tsx](https://tsx.is)); the frontend is a React 19 + Vite app styled with Tailwind CSS 4.

## Features

- Visual representation of coin nodes on an OpenStreetMap.
- Light / dark mode toggle (remembers your choice).
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

- You have installed Node.js 20+ and npm 10+.
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
4. Add RPC client settings and your IPinfo token to the `.env` file:

   ```ini
   # RPC server settings
   DAEMON_RPC_HOST=127.0.0.1
   DAEMON_RPC_PORT=8333
   DAEMON_RPC_USERNAME=your_username
   DAEMON_RPC_PASSWORD=your_password
   DAEMON_RPC_SSL=false
   DAEMON_RPC_TIMEOUT=30000

   # IPinfo.io token
   IPINFO_TOKEN=your_ipinfo_token

   # Reverse-DNS resolvers (comma-separated). Many hosts cannot answer IPv6 PTR
   # (ip6.arpa) queries, so reverse lookups fall back to these public resolvers.
   # Leave empty to use only the system resolver.
   DNS_SERVERS=1.1.1.1,8.8.8.8

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

## Customizing the site

All user-facing text and branding lives in a single top-level file: [`site.config.ts`](site.config.ts).
Edit it to change the page headings, the table column labels, the map defaults, and every
part of the footer (links, social icons, GitHub star button, and donation addresses) — there is
no need to dig through the React components. It also holds `dnsOverrides`, a map for forcing the
reverse-DNS (PTR) hostname of specific IPv4/IPv6 addresses (handy for nodes with no PTR record). After editing, run `npm run build` (production) or
just save while `npm run dev` is running and the page hot-reloads.

## Project layout & scripts

The backend and frontend are no longer split across `src/server` and `src/client`:

- `server.ts` — the Express API (run with `tsx`, no build step).
- `src/` — the React + Vite client (`main.tsx`, `App.tsx`, `index.css`).
- `site.config.ts` — shared, user-editable site configuration.
- `test/` — Vitest tests (run against the API with supertest).

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Run the API (`tsx watch`) and the Vite dev server. |
| `npm run build`     | Build the production client into `dist/`.          |
| `npm run start`     | Serve the built client + API (`tsx server.ts`).    |
| `npm run typecheck` | Type-check the whole project with `tsc --noEmit`.  |
| `npm run lint`      | Lint with ESLint 10 + typescript-eslint.           |
| `npm run format`    | Format the project with Prettier.                  |
| `npm test`          | Run the Vitest suite.                              |

## Publish on the Internet

### Set up reverse proxy and web server e.g. Nginx

```nginx.conf
server {
    listen                  443 ssl http2;
    listen                  [::]:443 ssl http2;
    server_name             nodemap.example.com;
    root                    /path/to/nodemap/dist;

    # SSL
    ssl_certificate         /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;

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

- [ROZ](https://github.com/ROZ-MOFUMOFU-ME) - Author

- [Aoi Emerauda](https://github.com/emerauda) - Alternative

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
