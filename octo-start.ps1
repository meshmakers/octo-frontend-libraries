param(
    [string]$configuration = "Release"
)

$scriptPath = $PSScriptRoot

Write-Host "Starting octo-frontend-libraries development servers (configuration: $configuration)" -ForegroundColor Green

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

    # Resolve npx path so child processes don't depend on shell PATH
    $npxPath = (Get-Command npx -ErrorAction SilentlyContinue).Source
    if (-not $npxPath) {
        Write-Host "npx not found in PATH" -ForegroundColor Red
        exit 1
    }

    # Kill any leftover processes on our ports
    foreach ($port in @(4201, 4202)) {
        $existingPid = $null
        if ($IsMacOS -or $IsLinux) {
            $existingPid = (lsof -ti :$port 2>$null)
        }
        if ($existingPid) {
            Write-Host "Killing leftover process on port $port (PID: $existingPid)" -ForegroundColor Yellow
            kill $existingPid 2>$null
            Start-Sleep -Milliseconds 500
        }
    }

    $processes = @()

    # Map configuration to Angular configuration name
    $ngConfiguration = if ($configuration -eq "Release") { "production" } else { "development" }

    # Start demo-app on port 4201
    Write-Host "Starting demo-app on https://localhost:4201" -ForegroundColor Cyan
    $demoProc = Start-Process -FilePath $npxPath `
        -ArgumentList "ng serve demo-app --port 4201 --configuration $ngConfiguration" `
        -WorkingDirectory $frontendLibsPath `
        -PassThru `
        -NoNewWindow
    $processes += $demoProc

    # Start legacy-demo-app on port 4202
    Write-Host "Starting legacy-demo-app on https://localhost:4202" -ForegroundColor Cyan
    $legacyProc = Start-Process -FilePath $npxPath `
        -ArgumentList "ng serve legacy-demo-app --port 4202 --configuration $ngConfiguration" `
        -WorkingDirectory $frontendLibsPath `
        -PassThru `
        -NoNewWindow
    $processes += $legacyProc

    Write-Host ""
    Write-Host "Both servers are running. Press Ctrl+C to stop." -ForegroundColor Green
    Write-Host "  demo-app:        https://localhost:4201" -ForegroundColor Cyan
    Write-Host "  legacy-demo-app: https://localhost:4202" -ForegroundColor Cyan
    Write-Host ""

    # Wait until Ctrl+C or a process exits
    try {
        while ($true) {
            foreach ($proc in $processes) {
                if ($proc.HasExited) {
                    Write-Host "Process $($proc.Id) exited with code $($proc.ExitCode)" -ForegroundColor Yellow
                }
            }
            if ($processes | Where-Object { $_.HasExited } | Measure-Object | Where-Object { $_.Count -eq $processes.Count }) {
                Write-Host "All processes have exited." -ForegroundColor Yellow
                break
            }
            Start-Sleep -Seconds 2
        }
    }
    catch {
        # Ctrl+C pressed
    }
    finally {
        Write-Host "Stopping servers..." -ForegroundColor Yellow
        foreach ($proc in $processes) {
            if (-not $proc.HasExited) {
                # Kill the process tree (ng serve spawns child node processes)
                if ($IsMacOS -or $IsLinux) {
                    # On Unix, kill the process group to catch children
                    kill -- -$($proc.Id) 2>$null
                    # Fallback: kill the process directly
                    if (-not $proc.HasExited) {
                        $proc.Kill($true)
                    }
                }
                else {
                    # On Windows, taskkill /T kills the process tree
                    taskkill /PID $proc.Id /T /F 2>$null | Out-Null
                }
            }
        }
        # Final cleanup: make sure nothing is left on our ports
        foreach ($port in @(4201, 4202)) {
            if ($IsMacOS -or $IsLinux) {
                $leftover = (lsof -ti :$port 2>$null)
                if ($leftover) {
                    kill -9 $leftover 2>$null
                }
            }
        }
        Write-Host "Servers stopped." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
