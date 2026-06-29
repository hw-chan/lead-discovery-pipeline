import { spawn } from "child_process";
import path from "path";

function runScript(name: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [path.resolve(__dirname, script)], {
      stdio: "inherit",
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
  });
}

function startProcess(name: string, script: string) {
  const proc = spawn("node", [path.resolve(__dirname, script)], {
    stdio: "inherit",
  });
  proc.on("error", (err) => {
    console.error(`Failed to start ${name}:`, err);
    process.exit(1);
  });
  proc.on("close", (code) => {
    console.error(`${name} exited with code ${code}`);
    process.exit(code ?? 1);
  });
}

async function main() {
  await runScript("migrate", "migrate.js");
  startProcess("server", "server.js");
  startProcess("worker", "worker.js");
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
