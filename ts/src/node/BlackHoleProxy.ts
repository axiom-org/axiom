// Due to the inner workings of Chrome extensions, to make our pseudo-domain work well
// we need to have an external proxy that just redirects everything to a single static page.
// This is that proxy.

import * as http from "http";

const CONTENT = `
<html>
<body>
loading...
</body>
</html>
`;

export default class BlackHoleProxy {
  port: number;
  server: any;

  constructor(port) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      console.log("black hole proxying", req.url);
      res.end(CONTENT);
    });
    this.server.listen(this.port);
    console.log("running black hole proxy on port", this.port);
  }
}
