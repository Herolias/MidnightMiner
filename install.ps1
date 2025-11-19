$Repo = "Herolias/MidnightMiner"
$BinaryName = "midnight-miner-win.exe"
$ExeName = "midnight-miner.exe"

Write-Host "--- Midnight Miner Installer ---"

$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryName"

Write-Host "Downloading latest release from $Repo..."

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExeName -ErrorAction Stop
    Write-Host "Success! Downloaded to $(Get-Location)\$ExeName"
    Write-Host ""
    Write-Host "You can now run the miner using:"
    Write-Host "  .\$ExeName start --wallets 5"
} catch {
    Write-Error "Failed to download binary. Please check if a release exists on GitHub and contains '$BinaryName'."
    exit 1
}
