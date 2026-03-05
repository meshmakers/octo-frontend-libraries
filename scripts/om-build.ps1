# Build script for frontend libraries
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

# Build frontend libraries
Write-Host "Building frontend-libraries..." -ForegroundColor Cyan
Push-Location "$repoRoot\src\frontend-libraries"
npm i
npm run build
Pop-Location

Write-Host "Build complete!" -ForegroundColor Green
