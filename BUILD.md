# Midnight Miner - Standalone Build Instructions

This project uses `pkg` to create standalone executable binaries for Windows, Linux, and macOS.

## Prerequisites
- Node.js installed
- npm install

## How to Build

Run the following command to compile the TypeScript code and generate the binaries:

```bash
npm run package
```

## Output
The executables will be generated in the `bin/` directory:
- `cardano-miner-win.exe` (Windows)
- `cardano-miner-linux` (Linux)
- `cardano-miner-macos` (macOS)

## Important Note regarding Browser
The miner uses Puppeteer, which requires a Chromium browser. The standalone executable **does not** include the browser binary (to keep the file size manageable).

- **First Run**: When you run the executable for the first time, Puppeteer will attempt to download the correct version of Chromium to your user profile directory (`~/.cache/puppeteer`). Please allow it time to download.
- **Offline Use**: If you need to run this on a machine without internet, you must manually copy the cached Chrome folder or set the `PUPPETEER_EXECUTABLE_PATH` environment variable to a local Chrome installation.

## Usage
**Windows:**
```cmd
cardano-miner-win.exe start --wallets 5 --cpu 4
```

**Linux/Mac:**
```bash
./cardano-miner-linux start --wallets 5 --cpu 4
```

