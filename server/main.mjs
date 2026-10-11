#!/usr/bin/env node
// StudyTrack app server entry point (Project 6): npm start
//
// Usage: node server/main.mjs [--port 3000] [--host 127.0.0.1] [--data <file>]
//                             [--write-delay-ms <n>]
//
//   --data            data file (default: STUDYTRACK_DATA_FILE, else
//                     studytrack-data.json in the working directory - the
//                     same file the P2 CLI uses)
//   --write-delay-ms  pause between reading and writing on every POST, to
//                     make overlapping writes easy to demonstrate (default 0)
//
// One process is the only writer of the data file while it runs. Do not run
// `node planner.js add` against the same file at the same time.

import { startApp, LOG_PAGE } from './app.mjs';

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const app = await startApp({
  port: Number(option('--port', process.env.PORT || 3000)),
  host: option('--host', '127.0.0.1'),
  dataFile: option('--data', undefined),
  writeDelayMs: Number(option('--write-delay-ms', 0)),
});

console.log(`StudyTrack server listening on ${app.url}`);
console.log(`Study log: ${app.url}${LOG_PAGE}`);
console.log(`Data file: ${app.store.file}`);

// Ctrl+C (SIGINT) or `kill` (SIGTERM): stop taking new requests, let any
// write that has started finish, then exit. A second signal exits at once.
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`${signal} received, finishing in-flight requests`);
    app.close().then(
      () => process.exit(0),
      (err) => {
        console.error(err);
        process.exit(1);
      },
    );
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
