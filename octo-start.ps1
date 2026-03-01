param(
    [string]$configuration = "Release"
)

$scriptPath = $PSScriptRoot

Write-Host "Starting octo-frontend-libraries development servers" -ForegroundColor Green

$frontendLibsPath = Join-Path $scriptPath "src/frontend-libraries"

if (!(Test-Path $frontendLibsPath)) {
    Write-Host "Path not found: $frontendLibsPath" -ForegroundColor Red
    exit 1
}

Push-Location $frontendLibsPath
try {
    # Check if node_modules exists, if not run npm ci
    $nodeModules = Join-Path $frontendLibsPath "node_modules"
    if (!(Test-Path $nodeModules)) {
        Write-Host "node_modules not found, running npm ci..." -ForegroundColor Yellow
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "npm ci failed" -ForegroundColor Red
            exit 1
        }
    }

    # Start demo-app on port 4201
    Write-Host "Starting demo-app on https://localhost:4201" -ForegroundColor Cyan
    $demoJob = Start-Job -ScriptBlock {
        param($workDir)
        Set-Location $workDir
        npx ng serve demo-app --port 4201 --configuration development 2>&1
    } -ArgumentList $frontendLibsPath -Name "demo-app"

    # Start legacy-demo-app on port 4202
    Write-Host "Starting legacy-demo-app on https://localhost:4202" -ForegroundColor Cyan
    $legacyJob = Start-Job -ScriptBlock {
        param($workDir)
        Set-Location $workDir
        npx ng serve legacy-demo-app --port 4202 --configuration development 2>&1
    } -ArgumentList $frontendLibsPath -Name "legacy-demo-app"

    Write-Host ""
    Write-Host "Both servers are running. Press Ctrl+C to stop." -ForegroundColor Green
    Write-Host "  demo-app:        https://localhost:4201" -ForegroundColor Cyan
    Write-Host "  legacy-demo-app: https://localhost:4202" -ForegroundColor Cyan
    Write-Host ""

    # Wait for both jobs
    try {
        while ($demoJob.State -eq "Running" -or $legacyJob.State -eq "Running") {
            Start-Sleep -Seconds 2
        }
    }
    catch {
        # Ctrl+C pressed, stop both jobs
    }
    finally {
        Stop-Job -Job $demoJob -ErrorAction SilentlyContinue
        Stop-Job -Job $legacyJob -ErrorAction SilentlyContinue
        Remove-Job -Job $demoJob -Force -ErrorAction SilentlyContinue
        Remove-Job -Job $legacyJob -Force -ErrorAction SilentlyContinue
        Write-Host "Servers stopped." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
