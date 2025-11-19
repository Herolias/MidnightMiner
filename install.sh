#!/bin/bash

# Midnight Miner Installer

REPO="Herolias/MidnightMiner"
BINARY_NAME="midnight-miner-linux"
EXE_NAME="midnight-miner"

echo "--- Midnight Miner Installer ---"

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    BINARY_NAME="midnight-miner-linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    BINARY_NAME="midnight-miner-macos"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Downloading latest release from $REPO..."
DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$BINARY_NAME"

# Download to current directory
curl -fsSL "$DOWNLOAD_URL" -o "$EXE_NAME"

if [ $? -ne 0 ]; then
    echo "Error: Failed to download binary. Please check if a release exists on GitHub."
    exit 1
fi

chmod +x "$EXE_NAME"

echo "Success! Downloaded to $(pwd)/$EXE_NAME"
echo ""
echo "You can now run the miner using:"
echo "  ./$EXE_NAME start --wallets 10 --headless"
