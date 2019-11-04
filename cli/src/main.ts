#!/usr/bin/env node

process.on('unhandledRejection', r => {
  console.error("unhandled rejection:", r);
});

import { main } from "./CLI";
main();
