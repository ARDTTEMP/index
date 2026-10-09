import { spawn } from "node:child_process";
const server = spawn("npm", ["run", "start"], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let ready = false;
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => {
    if (String(d).includes("Ready")) {
      ready = true;
      resolve();
    }
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  server.on("exit", (c) => {
    if (!ready) reject(new Error("Server exited " + c));
  });
  setTimeout(() => reject(new Error("Server timeout")), 15000).unref();
});
try {
  const test = spawn(
    "node",
    [process.env.TEST_SCRIPT || "tests/browser-smoke.mjs"],
    { stdio: "inherit" },
  );
  const code = await new Promise((r) => test.on("exit", r));
  process.exitCode = code;
} finally {
  process.kill(-server.pid, "SIGTERM");
}
