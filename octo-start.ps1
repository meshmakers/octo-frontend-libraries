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

    # Verify npx is available
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
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

    # Map configuration to Angular configuration name
    $ngConfiguration = if ($configuration -eq "Release") { "production" } else { "development" }

    $npxPath = (Get-Command npx).Source

    # Start demo-app and legacy-demo-app using System.Diagnostics.Process
    # This works correctly both standalone and when called from Start-Job (no console/terminal required)
    function Start-NgServe($project, $port) {
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $npxPath
        $psi.Arguments = "ng serve $project --port $port --configuration $ngConfiguration"
        $psi.WorkingDirectory = $frontendLibsPath
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

        $proc = [System.Diagnostics.Process]::new()
        $proc.StartInfo = $psi
        $proc.Start() | Out-Null

        return $proc
    }

    Write-Host "Starting demo-app on https://localhost:4201" -ForegroundColor Cyan
    Write-Host "Starting legacy-demo-app on https://localhost:4202" -ForegroundColor Cyan

    $demoProc = Start-NgServe "demo-app" 4201
    $legacyProc = Start-NgServe "legacy-demo-app" 4202

    $processes = @($demoProc, $legacyProc)
    $projectNames = @("demo-app", "legacy-demo-app")

    try {
        while ($true) {
            # Read and forward stdout/stderr from both processes
            for ($i = 0; $i -lt $processes.Count; $i++) {
                $proc = $processes[$i]
                $name = $projectNames[$i]

                if ($proc.StandardOutput -and !$proc.StandardOutput.EndOfStream) {
                    while ($proc.StandardOutput.Peek() -ge 0) {
                        $line = $proc.StandardOutput.ReadLine()
                        if ($line) { Write-Output "[$name] $line" }
                    }
                }
                if ($proc.StandardError -and !$proc.StandardError.EndOfStream) {
                    while ($proc.StandardError.Peek() -ge 0) {
                        $line = $proc.StandardError.ReadLine()
                        if ($line) { Write-Output "[$name] $line" }
                    }
                }
            }

            # Check if all processes have exited
            $allExited = $true
            foreach ($proc in $processes) {
                if (-not $proc.HasExited) {
                    $allExited = $false
                }
            }
            if ($allExited) {
                Write-Host "All processes have exited." -ForegroundColor Yellow
                break
            }

            Start-Sleep -Milliseconds 500
        }
    }
    catch {
        # Ctrl+C or error
    }
    finally {
        Write-Host "Stopping servers..." -ForegroundColor Yellow
        foreach ($proc in $processes) {
            if (-not $proc.HasExited) {
                if ($IsMacOS -or $IsLinux) {
                    # Kill the process tree
                    kill -- -$($proc.Id) 2>$null
                    if (-not $proc.HasExited) {
                        $proc.Kill($true)
                    }
                }
                else {
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
