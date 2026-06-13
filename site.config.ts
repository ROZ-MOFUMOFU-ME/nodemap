// =============================================================================
//  site.config.ts — EDIT EVERYTHING USER-FACING HERE
// =============================================================================
//  This is the single place to change the headings, table column labels, the
//  map defaults, and all of the footer text (links, social icons, donation
//  addresses). The React app (src/App.tsx) only reads from this file, so you
//  never have to dig through the component tree to rename a heading.
//
//  After editing, run `npm run build` (production) or just save while
//  `npm run dev` is running (the page hot-reloads).
// =============================================================================

export interface ContactLink {
  /** Font Awesome class string, e.g. "fab fa-x-twitter fa-fw". */
  icon: string
  url: string
}

export interface Donation {
  coin: string
  address: string
}

export interface SiteConfig {
  title: string
  headings: { map: string; table: string }
  columns: string[]
  map: {
    center: [number, number]
    zoom: number
    tileUrl: string
    attribution: string
    tileUrlDark: string
    attributionDark: string
    marker: {
      iconUrl: string
      iconSize: [number, number]
      iconAnchor: [number, number]
      popupAnchor: [number, number]
    }
  }
  footer: {
    projectName: string
    projectUrl: string
    author: string
    authorUrl: string
    licenseName: string
    licenseUrl: string
    contact: ContactLink[]
    githubStar: { user: string; repo: string } | null
    donations: Donation[]
  }
}

const siteConfig: SiteConfig = {
  // Browser tab title and the two section headings on the page.
  title: 'Node Map',
  headings: {
    map: 'Node Map',
    table: 'Node Info',
  },

  // Column headers for the "Node Info" table, left to right.
  columns: ['Address', 'User Agent', 'Height', 'Country', 'Location', 'Network'],

  // OpenStreetMap defaults.
  map: {
    center: [25, -0.0005], // [latitude, longitude]
    zoom: 2,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    // Dark-mode tiles (CARTO Dark Matter). Switched automatically with the theme toggle.
    tileUrlDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attributionDark:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    // Map marker pin. To use your OWN pin, set `iconUrl` to any image URL or an
    // inline SVG/PNG data URI. `iconAnchor` is the pixel that sits exactly on the
    // coordinate (here the tip of the pin); `popupAnchor` is the popup offset from it.
    marker: {
      iconUrl:
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32"%3E%3Cpath fill="%232563eb" d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z"/%3E%3Ccircle cx="12" cy="12" r="5" fill="%23fff"/%3E%3C/svg%3E',
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -36],
    },
  },

  // Everything in the page footer.
  footer: {
    projectName: 'nodemap',
    projectUrl: 'https://github.com/ROZ-MOFUMOFU-ME/nodemap',
    author: 'ROZ',
    authorUrl: 'https://github.com/ROZ-MOFUMOFU-ME',
    licenseName: 'MIT License',
    licenseUrl: 'https://en.wikipedia.org/wiki/MIT_License',

    // Contact / social links. `icon` is a Font Awesome class string.
    contact: [
      { icon: 'fab fa-x-twitter fa-fw', url: 'https://twitter.com/ROZ_mofumofu_me' },
      { icon: 'fas fa-envelope fa-fw', url: 'mailto:mail@mofumofu.me' },
      { icon: 'fab fa-discord fa-fw', url: 'https://discord.gg/zHUdQy2NzU' },
      { icon: 'fab fa-github fa-fw', url: 'https://github.com/ROZ-MOFUMOFU-ME' },
    ],

    // GitHub "star" button (set to null to hide it).
    githubStar: { user: 'ROZ-MOFUMOFU-ME', repo: 'nodemap' },

    // Donation addresses shown at the bottom of the footer.
    donations: [
      { coin: 'BTC', address: '3FpbJ5cotwPZQn9fcdZrPv4h72XquzEvez' },
      { coin: 'ETH', address: '0xc664a0416c23b1b13a18e86cb5fdd1007be375ae' },
      { coin: 'LTC', address: 'Lh96WZ7Rw9Wf4GDX2KXpzieneZFV5Xe5ou' },
      { coin: 'BCH', address: 'pzdsppue8uwc20x35psaqq8sgchkenr49c0qxzazxu' },
      { coin: 'ETC', address: '0xc664a0416c23b1b13a18e86cb5fdd1007be375ae' },
      { coin: 'MONA', address: 'MLEqE3vi11j4ZguMjkvMn5rUtze6kXbAzQ' },
    ],
  },
}

export default siteConfig
