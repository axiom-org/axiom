#!/usr/bin/env node

process.on('unhandledRejection', r => console.log(r));

import { main } from "./CLI";
main();
