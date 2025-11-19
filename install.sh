#!/bin/bash

# Midnight Miner Installer

REPO="Herolias/MidnightMiner"
BINARY_NAME="midnight-miner-linux"
EXE_NAME="midnight-miner"

# Default to user-local bin to avoid sudo
INSTALL_DIR="$HOME/.local/bin"

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

# Create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    echo "Created directory $INSTALL_DIR"
fi

echo "Downloading latest release from $REPO..."
DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$BINARY_NAME"

# Download to current dir first
curl -fsSL "$DOWNLOAD_URL" -o "$EXE_NAME"

if [ $? -ne 0 ]; then
    echo "Error: Failed to download binary. Please check if a release exists on GitHub."
    exit 1
fi

chmod +x "$EXE_NAME"

echo "Installing to $INSTALL_DIR..."
mv "$EXE_NAME" "$INSTALL_DIR/$EXE_NAME"

if [ $? -eq 0 ]; then
    echo "Success! Installed to $INSTALL_DIR/$EXE_NAME"
    
    # Check if INSTALL_DIR is in PATH
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo ""
        echo "WARNING: $INSTALL_DIR is not in your PATH."
        echo "To run the miner, you need to add it to your PATH or run it directly."
        echo ""
        echo "To add to PATH, run the following (or add to your ~/.bashrc or ~/.zshrc):"
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
        echo "Then run:"
        echo "  $EXE_NAME start --wallets 5"
    else
        echo "You can now run the miner using:"
        echo "  $EXE_NAME start --wallets 5"
    fi
else
    echo "Failed to move binary to $INSTALL_DIR."
    exit 1
fi
