// The TorrentDownloader finds the right torrent for a bucket and uses that to return
// subsequent files.
// It is designed to be used non-persistently from a web browser.

import ChainClient from "../iso/ChainClient";
import TorrentClient from "../iso/TorrentClient";

// Removes a leading / and adds a trailing index.html if needed
// so that callers can be indifferent
function cleanPathname(pathname) {
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }
  if (pathname.charAt(0) === "/") {
    pathname = pathname.substr(1);
  }
  return pathname;
}

async function readAsText(file): Promise<string> {
  return await new Promise((resolve, reject) => {
    file.getBlob((err, blob) => {
      if (err) {
        reject(err);
      }
      let reader = new FileReader();

      reader.onload = e => {
        resolve((e.target as any).result);
      };
      reader.readAsText(blob);
    });
  });
}

async function readAsDataURL(file): Promise<string> {
  return await new Promise((resolve, reject) => {
    file.getBlob((err, blob) => {
      if (err) {
        reject(err);
      }
      let reader = new FileReader();

      reader.onload = e => {
        resolve((e.target as any).result);
      };
      reader.readAsDataURL(blob);
    });
  });
}

// Async file reader.
// We keep a data url around because to redirect to it, we need it to be available
// synchronously.
async function readFile(file): Promise<any> {
  let answer = {} as any;
  if (file.name.endsWith("html") || file.name.endsWith("js")) {
    answer.text = await readAsText(file);
  }
  if (!file.name.endsWith("html")) {
    answer.data = await readAsDataURL(file);
  }
  return answer;
}

export default class TorrentDownloader {
  client: TorrentClient;
  lastFetchTime: { [hostname: string]: Date };
  magnets: any;
  cache: any;
  network: string;
  verbose: boolean;

  constructor(network: string) {
    this.network = network;
    this.client = new TorrentClient(network);

    // The last time a file from a hostname was fetched
    this.lastFetchTime = {};

    // Maps hostname to {magnet, time} object
    this.magnets = {};

    // this.cache[magnet][filename] is the cache for the file.
    // files are stored with maybe { text: text } and maybe { data: dataURL }.
    this.cache = {};

    this.verbose = false;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  // Turns a torrent into a map from filename to data
  async readTorrent(torrent) {
    let data = {};
    for (let file of torrent.files) {
      this.log("got data for", file.path);
      data[file.path] = await readFile(file);
    }
    return data;
  }

  // Starts downloading and resolves when the download finishes.
  // Resolves to a map of filename to content, which is also stored in this.cache.
  async downloadMagnet(magnet) {
    if (this.cache[magnet]) {
      return this.cache[magnet];
    }
    let torrent = await this.client.download(magnet);
    await torrent.waitForDone();
    this.log("finished", torrent.infoHash);
    let data = await this.readTorrent(torrent.torrent);
    this.cache[magnet] = data;
    return data;
  }

  // Returns a magnet url for a host.
  // If there is no data for this host, throws a helpful error.
  // TODO: sometimes read from cache instead of just writing to it, have staleness logic
  async getMagnetURL(hostname) {
    console.log("looking up bucket for", hostname);
    let client = new ChainClient(null, this.network);
    let name = "www:" + hostname.split(".")[0];
    let bucket = await client.getBucket(name);
    if (!bucket) {
      throw new Error("unregistered host: " + name);
    }
    if (!bucket.magnet) {
      throw new Error("no data uploaded yet for host: " + name);
    }
    console.log("found magnet:", bucket.magnet);

    let now = new Date();
    this.magnets[hostname] = {
      magnet: bucket.magnet,
      time: now
    };
    return bucket.magnet;
  }

  // Starts downloading all files from a hostname and resolves when they are ready
  // Throws an error if the files cannot be found
  // Resolves to a map from filename to content
  async downloadHostname(hostname) {
    let magnet = await this.getMagnetURL(hostname);
    return await this.downloadMagnet(magnet);
  }

  // Returns null if the file is not in the cache.
  getFileFromCache(hostname, pathname) {
    pathname = cleanPathname(pathname);

    let magnetData = this.magnets[hostname];
    if (!magnetData) {
      return null;
    }
    let magnet = magnetData.magnet;
    let cache = this.cache[magnet];
    if (!cache) {
      return null;
    }

    this.lastFetchTime[hostname] = new Date();
    return cache[pathname] || null;
  }

  // Rejects if there is no such file or if there is a loading failure.
  // TODO: remove if nothing is using this
  async getFile(hostname, pathname) {
    pathname = cleanPathname(pathname);
    console.log("loading", pathname, "from", hostname);

    let data = await this.downloadHostname(hostname);
    this.lastFetchTime[hostname] = new Date();
    return data[pathname];
  }

  // Returns an html string but scripts are inlined.
  async inlineJavaScript(hostname, pathname): Promise<string> {
    pathname = cleanPathname(pathname);
    console.log("loading", pathname, "from", hostname);

    let data = await this.downloadHostname(hostname);
    this.lastFetchTime[hostname] = new Date();

    let html = data[pathname].text;
    if (!html) {
      throw new Error("no html present for " + pathname);
    }

    // This logic could certainly be more robust but it should err on
    // the side of not inlining.
    let regex = /<script src="[^"<>]*\.js"><\/script>/g;
    console.log("XXX", html.matchAll(regex));
    return html;
  }
}
