import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

function App() {
  const [locations, setLocations] = useState([])
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    fetchLocations()
  }, [])

  function fetchLocations() {
    fetch('/peer-locations')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          throw new TypeError(`Expected JSON, got ${contentType}`)
        }
        return response.json()
      })
      .then(data => {
        setLocations(data.locations || [])
        const lastUpdated = new Date(data.lastUpdated || new Date())
        setLastUpdated(lastUpdated.toLocaleString(undefined, { timeZoneName: 'short' }))
      })
      .catch(error => {
        console.error('Error fetching data:', error)
      })
  }

  return (
    <>
      <div className="pure-g">
        <div className="pure-u-1 header box">
          <h3>Node Map</h3>
          <div className="map-container">
            <MapContainer center={[25, -0.0005]} zoom={2} style={{ height: '100%' }}>
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {locations.map((loc, i) => {
                const coords = loc.location
                return coords?.length === 2
                  ? <Marker key={i} position={[coords[0], coords[1]]}>
                      <Popup dangerouslySetInnerHTML={{ __html: loc.ip }} />
                    </Marker>
                  : null
              })}
            </MapContainer>
          </div>
          <div id="boxFooter">Last Updated: {lastUpdated}</div>
        </div>
        <div className="pure-u-1 content box">
          <h3>Node Info</h3>
          <table className="pure-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>User Agent</th>
                <th>Height</th>
                <th>Country</th>
                <th>Location</th>
                <th>Network</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <tr key={i}>
                  <td dangerouslySetInnerHTML={{ __html: loc.ip }} />
                  <td dangerouslySetInnerHTML={{ __html: loc.userAgent }} />
                  <td dangerouslySetInnerHTML={{ __html: loc.blockHeight }} />
                  <td dangerouslySetInnerHTML={{ __html: loc.country }} />
                  <td dangerouslySetInnerHTML={{ __html: loc.city }} />
                  <td dangerouslySetInnerHTML={{ __html: loc.org }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer>
        <div>
          This site is powered by <a target="_blank" href="https://github.com/ROZ-MOFUMOFU-ME/nodemap">nodemap</a> project 
          created by <a target="_blank" href="https://github.com/ROZ-MOFUMOFU-ME">ROZ</a> originality and is
          licensed under the <a href="https://en.wikipedia.org/wiki/MIT_License">MIT License</a>.&nbsp;&nbsp;
          Contact:&nbsp;&nbsp;
          <a target="_blank" href="https://twitter.com/ROZ_mofumofu_me"><i className="fab fa-x-twitter fa-fw"></i></a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <a href="mailto:mail@mofumofu.me"><i className="fas fa-envelope fa-fw"></i></a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <a target="_blank" href="https://discord.gg/zHUdQy2NzU"><i className="fab fa-discord fa-fw"></i></a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <a target="_blank" href="https://github.com/ROZ-MOFUMOFU-ME"><i className="fab fa-github fa-fw"></i></a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <iframe src="https://ghbtns.com/github-btn.html?user=ROZ-MOFUMOFU-ME&repo=nodemap&type=star&count=true&v=2"
            frameBorder="0" scrolling="0" width="150" height="20"></iframe><br />
          <i className="fas fa-heart fa-fw"></i>&nbsp;&nbsp;Donating&nbsp;BTC:&nbsp;3FpbJ5cotwPZQn9fcdZrPv4h72XquzEvez&nbsp;&nbsp;ETH: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae&nbsp;&nbsp;LTC: Lh96WZ7Rw9Wf4GDX2KXpzieneZFV5Xe5ou<br />
          BCH: pzdsppue8uwc20x35psaqq8sgchkenr49c0qxzazxu&nbsp;&nbsp;ETC: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae&nbsp;&nbsp;MONA: MLEqE3vi11j4ZguMjkvMn5rUtze6kXbAzQ
        </div>
      </footer>
    </>
  )
}

export default App