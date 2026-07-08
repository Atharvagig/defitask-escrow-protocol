const Mocha = require("mocha");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const net = require("net");

const originalSpawn = child_process.spawn;
child_process.spawn = function (cmd, args, options) {
  if (cmd === "npx.cmd" && options && options.shell === false) {
    const hardhatPath = path.resolve(__dirname, "../node_modules/hardhat/internal/cli/bootstrap.js");
    const newArgs = [hardhatPath];
    if (args && args.length > 0 && args[0] === "hardhat") {
      newArgs.push(...args.slice(1));
    } else if (args) {
      newArgs.push(...args);
    }
    return originalSpawn.call(this, process.execPath, newArgs, options);
  }
  return originalSpawn.apply(this, arguments);
};
const spawn = child_process.spawn;

const PORT = 8545;
const HOST = "127.0.0.1";

let nodeProcess = null;

function cleanupNodeProcess() {
  if (nodeProcess) {
    console.log("Teardown: Stopping the temporary local Hardhat node...");
    try {
      nodeProcess.kill("SIGTERM");
    } catch (err) {
      // Ignore errors if already dead or not killable
    }
    nodeProcess = null;
  }
}

// Register process signal/exception handlers
process.on("exit", () => {
  cleanupNodeProcess();
});

process.on("SIGINT", () => {
  cleanupNodeProcess();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanupNodeProcess();
  process.exit(143);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in E2E Runner:", err);
  cleanupNodeProcess();
  process.exit(1);
});

/**
 * Checks if the port is open (i.e. Hardhat node is running).
 */
function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(1000);
    socket.once("error", onError);
    socket.once("timeout", onError);
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

async function main() {
  const isRunning = await isPortOpen(PORT, HOST);

  if (!isRunning) {
    console.log(`No Hardhat node detected on port ${PORT}. Starting a temporary local node...`);
    
    const isWindows = process.platform === "win32";
    const command = isWindows ? "npx.cmd" : "npx";

    // Spawn hardhat node in background
    nodeProcess = spawn(command, ["hardhat", "node"], {
      cwd: path.join(__dirname, ".."),
      shell: false,
      stdio: "ignore" // Ignore output to avoid cluttering test results
    });

    // Wait for the node to start up
    let connected = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (await isPortOpen(PORT, HOST)) {
        connected = true;
        break;
      }
    }

    if (!connected) {
      console.error("Failed to start Hardhat node in a timely manner.");
      cleanupNodeProcess();
      process.exit(1);
    }
    console.log("Hardhat node started successfully.");
  } else {
    console.log(`Using existing Hardhat node on port ${PORT}.`);
  }

  // Initialize Mocha
  const mocha = new Mocha({
    timeout: 30000,
    reporter: "spec"
  });

  // Find all E2E test files
  const e2eDir = __dirname;
  fs.readdirSync(e2eDir)
    .filter((file) => file.endsWith(".e2e.js"))
    .forEach((file) => {
      mocha.addFile(path.join(e2eDir, file));
    });

  // Run tests
  mocha.run((failures) => {
    if (nodeProcess) {
      cleanupNodeProcess();
      // Give the process a moment to cleanup
      setTimeout(() => {
        process.exit(failures ? 1 : 0);
      }, 500);
    } else {
      process.exit(failures ? 1 : 0);
    }
  });
}

main().catch((err) => {
  console.error("E2E Test Runner failed with error:", err);
  cleanupNodeProcess();
  process.exit(1);
});
