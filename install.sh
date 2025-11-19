#!/bin/bash

# Midnight Miner Installer

REPO="Herolias/MidnightMiner"
BINARY_NAME="midnight-miner-linux" # Ensure you upload the binary with this name to GitHub Releases
INSTALL_DIR="/usr/local/bin"
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

curl -fsSL "$DOWNLOAD_URL" -o "$EXE_NAME"

if [ $? -ne 0 ]; then
    echo "Error: Failed to download binary. Please check if a release exists on GitHub."
    exit 1
fi

chmod +x "$EXE_NAME"

echo "Installing to $INSTALL_DIR (requires sudo)..."
if sudo mv "$EXE_NAME" "$INSTALL_DIR/$EXE_NAME"; then
    echo "Success! You can now run the miner using:"
    echo "  $EXE_NAME start --wallets 5"
else
    echo "Failed to move binary to $INSTALL_DIR. You can run it locally with ./$EXE_NAME"
fi
