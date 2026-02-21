<#
.SYNOPSIS
    Telerik/Kendo UI License Setup Script

.DESCRIPTION
    This script checks for the TELERIK_LICENSE environment variable and creates
    the license file required by Kendo UI components.

.EXAMPLE
    .\scripts\setup-license.ps1

.NOTES
    Environment Variables:
      TELERIK_LICENSE - The Telerik/Kendo UI license key (required)

    Exit Codes:
      0 - Success
      1 - TELERIK_LICENSE environment variable not set
#>

$LICENSE_ENV_VAR = "TELERIK_LICENSE"
$LICENSE_FILE_NAME = "kendo-ui-license.txt"

function Main {
    $license = [Environment]::GetEnvironmentVariable($LICENSE_ENV_VAR)

    if (-not $license) {
        $license = $env:TELERIK_LICENSE
    }

    if (-not $license) {
        Write-Host ""
        Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
        Write-Host "║  ERROR: TELERIK_LICENSE environment variable is not set!       ║" -ForegroundColor Red
        Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Red
        Write-Host "║  To fix this:                                                  ║" -ForegroundColor Red
        Write-Host "║  1. Download your license from:                                ║" -ForegroundColor Red
        Write-Host "║     https://www.telerik.com/account/your-products              ║" -ForegroundColor Red
        Write-Host "║  2. Set the environment variable (PowerShell):                 ║" -ForegroundColor Red
        Write-Host "║     `$env:TELERIK_LICENSE = `"<your-license-key>`"               ║" -ForegroundColor Red
        Write-Host "║  3. Or set permanently:                                        ║" -ForegroundColor Red
        Write-Host "║     [Environment]::SetEnvironmentVariable(                     ║" -ForegroundColor Red
        Write-Host "║       `"TELERIK_LICENSE`", `"<key>`", `"User`")                      ║" -ForegroundColor Red
        Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        exit 1
    }

    # Write the license file
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $licenseFilePath = Join-Path (Split-Path -Parent $scriptDir) $LICENSE_FILE_NAME

    try {
        Set-Content -Path $licenseFilePath -Value $license -NoNewline -Encoding UTF8
        Write-Host "✓ Telerik license file created: $LICENSE_FILE_NAME" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to write license file: $_" -ForegroundColor Red
        exit 1
    }

    # Activate the license
    try {
        Write-Host "→ Activating Kendo UI license..." -ForegroundColor Cyan
        $projectRoot = Split-Path -Parent $scriptDir
        Push-Location $projectRoot
        npx kendo-ui-license activate
        Pop-Location
        Write-Host "✓ Kendo UI license activated" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to activate license. Build will continue but license warnings may appear." -ForegroundColor Red
        # Don't exit with error - let the build continue
    }
}

Main
