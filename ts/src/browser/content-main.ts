// This code runs in our content script, in the context of every web page.
// It does not run in the context of web pages that failed to load.
// It does not run in .axiom pages, because the loader stops it and runs itself instead.

import { routeWindowMessages } from "./WindowUtil";

routeWindowMessages();
