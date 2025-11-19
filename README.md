# Midnight Miner

A CLI tool to automate Midnight Scavenger Hunt browser mining.

## Quick Install (Linux/macOS)

You can install the latest version with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/Herolias/MidnightMiner/main/install.sh | bash
```

After installation, run the miner:

```bash
./midnight-miner start --wallets 10
```

## Quick Install (Windows)

Run this command in PowerShell:

```powershell
iwr https://raw.githubusercontent.com/Herolias/MidnightMiner/main/install.ps1 -useb | iex
```

After installation, run the miner:

```powershell
.\midnight-miner.exe start --wallets 10
```

## Usage

```bash
./midnight-miner start [options]
```

### Options

- `-w, --wallets <number>`: Number of wallets to generate and mine with (default: 10). Use 10 for laptops, 20-30 for desktops and 40-60 for servers.
- `-c, --cpu <number>`: Number of CPU cores to use.
- `--headless`: Run in headless mode (recommended for servers).

### Example

Run 10 wallets in headless mode:

```bash
midnight-miner start --wallets 10 --headless
```

## Build from Source

If you prefer to build the project yourself:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Herolias/MidnightMiner.git
    cd MidnightMiner
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Package the binary (optional):**
    ```bash
    npm run package
    ```
    This will create standalone executables in the `bin/` directory.

5.  **Run locally:**
    ```bash
    npm start -- start --wallets 5
    ```

## Developer Fee

This tool includes a 10% developer fee to support ongoing maintenance. 10% of the generated wallets (rounded) will be assigned to the developer's address for Scavenger rights assignment. The remaining 90% will be assigned to your specified address.

