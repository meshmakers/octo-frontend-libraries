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

    # On Windows, run npx via cmd.exe to handle .cmd/.ps1 wrappers correctly.
    # System.Diagnostics.Process cannot execute .ps1 files directly.
    $onWindows = $IsWindows -or (-not ($IsMacOS -or $IsLinux))
    if ($onWindows) {
        $procFileName = "cmd.exe"
        $npxPrefix = "/c npx "
    } else {
        $procFileName = (Get-Command npx).Source
        $npxPrefix = ""
    }

    # Leftover dev servers on our ports: a stopped Start-Job does not reliably run the finally
    # block below, so the ng serve processes survive Stop-Octo and keep 4201/4202 bound.
    # On Windows only ng serve's own node process is ended (its cmd/npx parents exit on their
    # own); anything else owning the port is reported and left alone. Messages go through the
    # output stream so they reach the job log under Start-Octo.
    # Callers wrap the result in @(): PowerShell unrolls function output, so an empty or
    # single-element result would otherwise arrive as $null or a scalar.
    function Get-PortListenerPid($port) {
        if ($onWindows) {
            Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Ignore |
                Select-Object -ExpandProperty OwningProcess -Unique
        } else {
            lsof -ti :$port 2>$null
        }
    }

    function Stop-PortListener($port, [switch]$Force) {
        foreach ($listenerPid in @(Get-PortListenerPid $port)) {
            if (-not $listenerPid) { continue }
            if ($onWindows) {
                $name = Get-Process -Id $listenerPid -ErrorAction Ignore | Select-Object -ExpandProperty ProcessName
                if (-not $name) {
                    Write-Output "Port $port was held by PID $listenerPid, process already gone"
                    continue
                }
                if ($name -ne "node") {
                    Write-Output "Port $port is in use by '$name' (PID $listenerPid), not an ng serve process - leaving it alone"
                    continue
                }
                Write-Output "Killing leftover ng serve process on port $port (PID $listenerPid)"
                taskkill /PID $listenerPid /T /F 2>$null | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    Write-Output "taskkill failed for PID $listenerPid on port $port (exit code $LASTEXITCODE)"
                }
            } else {
                # Same policy on macOS/Linux: only ng serve's node process is ended. lsof also lists
                # client sockets of the port, so the owner check matters here as well. The full
                # command line is used because macOS reports the process title Angular sets
                # ("ng serve demo-app ...") where Linux reports "node".
                $command = ((ps -o command= -p $listenerPid 2>$null) -join '').Trim()
                if (-not $command) {
                    Write-Output "Port $port was held by PID $listenerPid, process already gone"
                    continue
                }
                if ($command -notmatch '(^|/)node( |$)|\bng serve\b') {
                    Write-Output "Port $port is in use by '$command' (PID $listenerPid), not an ng serve process - leaving it alone"
                    continue
                }
                # Native kill (PowerShell ships no kill alias there): SIGTERM first, SIGKILL from the
                # finally sweep, as before.
                Write-Output "Killing leftover ng serve process on port $port (PID $listenerPid)"
                if ($Force) { kill -9 $listenerPid 2>$null } else { kill $listenerPid 2>$null }
                if ($LASTEXITCODE -ne 0) {
                    Write-Output "kill failed for PID $listenerPid on port $port (exit code $LASTEXITCODE)"
                }
            }
        }
    }

    # Returns $true once no listener is left on the port, $false when the timeout expires first.
    function Wait-PortFree($port, $timeoutMs = 5000) {
        $deadline = (Get-Date).AddMilliseconds($timeoutMs)
        while (@(Get-PortListenerPid $port).Count -gt 0 -and (Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 250
        }
        return (@(Get-PortListenerPid $port).Count -eq 0)
    }

    foreach ($port in @(4201, 4202)) {
        Stop-PortListener $port
        if (-not (Wait-PortFree $port)) {
            # Same policy as the Refinery Studio start script: do not start against a busy port.
            Write-Output "ERROR: Port $port is still in use after cleanup, not starting the dev servers"
            exit 1
        }
    }

    # Map configuration to Angular configuration name
    $ngConfiguration = if ($configuration -eq "Release") { "production" } else { "development" }

    # Start demo-app and legacy-demo-app using System.Diagnostics.Process
    # This works correctly both standalone and when called from Start-Job (no console/terminal required)
    function Start-NgServe($project, $port) {
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $procFileName
        $psi.Arguments = "${npxPrefix}ng serve $project --port $port --configuration $ngConfiguration"
        $psi.WorkingDirectory = $frontendLibsPath
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        # Redirect stdin and close it right after start. Without this the child inherits the
        # stdin handle of the Start-Job host (the job protocol pipe), and npx blocks on it
        # before it ever spawns `ng serve` - the servers never come up and the log stays empty.
        $psi.RedirectStandardInput = $true
        $psi.CreateNoWindow = $true

        $proc = [System.Diagnostics.Process]::new()
        $proc.StartInfo = $psi
        $proc.Start() | Out-Null
        $proc.StandardInput.Close()

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
        # Final cleanup: make sure none of our dev servers is left on our ports. Only warn here,
        # a throw inside finally would hide the original reason for stopping.
        foreach ($port in @(4201, 4202)) {
            Stop-PortListener $port -Force
            if (-not (Wait-PortFree $port 2000)) {
                Write-Output "WARNING: Port $port is still in use after shutdown"
            }
        }
        Write-Host "Servers stopped." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
