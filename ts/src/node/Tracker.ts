import { Server } from "bittorrent-tracker";

// Run a webtorrent tracker
// See https://github.com/webtorrent/bittorrent-tracker for docs

export default class Tracker {
  server: Server;

  constructor(port) {
    this.server = new Server({
      udp: true,
      http: true,
      ws: true,
      stats: true,
      filter: (infoHash, params, callback) => {
        // Allow tracking all torrents
        // TODO: restrict this in a logical way
        // console.log("tracking", infoHash);
        callback(null);
      }
    });

    this.server.on("listening", () => this.onListening());
    this.server.on("start", addr => this.onStart(addr));

    this.server.listen(port);
  }

  onListening() {
    console.log(
      "tracker listening on http port " + this.server.http.address().port
    );
    console.log(
      "tracker listening on udp port " + this.server.udp.address().port
    );
    console.log(
      "tracker listening on websocket port " + this.server.ws.address().port
    );
  }

  onStart(addr) {
    // console.log("got torrent start message from", addr);
  }
}
