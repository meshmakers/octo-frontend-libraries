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

    # ng is started as "node <ng.js>" directly, not through npx: no cmd.exe/npx wrappers on Windows
    # (see AB#3715), and the started process is the dev server itself, so its PID can be recorded
    # and its process tree ended reliably on every platform.
    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) {
        Write-Host "node not found in PATH" -ForegroundColor Red
        exit 1
    }
    $ngCli = Join-Path $frontendLibsPath "node_modules/@angular/cli/bin/ng.js"
    if (-not (Test-Path $ngCli)) {
        Write-Host "Angular CLI not found at $ngCli (run npm ci)" -ForegroundColor Red
        exit 1
    }
    $onWindows = $IsWindows -or (-not ($IsMacOS -or $IsLinux))

    # Dev servers left over from the previous run: a stopped Start-Job does not run the finally
    # block below, so after Stop-Octo the ng serve processes survive and keep 4201/4202 bound.
    # The PIDs of the servers started by the last run are recorded in a file and ended here,
    # process tree included, before the ports are checked. Only processes this script started
    # are touched.
    $pidFile = Join-Path ([System.IO.Path]::GetTempPath()) "octo-start-frontend-libraries.pids"

    # One line per server: "<pid>|<start time as UTC ticks>". The start time is the PID reuse
    # guard: a process that now runs under a recorded PID but started at another time is not ours.
    function Stop-RecordedServers {
        if (-not (Test-Path $pidFile)) { return }
        foreach ($entry in @(Get-Content $pidFile | Where-Object { $_ -match '^\d+\|\d+$' })) {
            $recordedPid, $recordedTicks = $entry -split '\|'
            $recorded = Get-Process -Id ([int]$recordedPid) -ErrorAction Ignore
            if (-not $recorded) { continue }
            try { $startedTicks = $recorded.StartTime.ToUniversalTime().Ticks } catch { $startedTicks = -1 }
            if ([math]::Abs($startedTicks - [long]$recordedTicks) -gt 20000000) {
                Write-Output "PID $recordedPid from the last run belongs to another process now, leaving it alone"
                continue
            }
            Write-Output "Stopping leftover dev server from the last run (PID $recordedPid)"
            try { $recorded.Kill($true) } catch { Write-Output "Could not stop PID ${recordedPid}: $($_.Exception.Message)" }
        }
        Remove-Item $pidFile -Force -ErrorAction Ignore
    }

    # Bind test with the same address ng serve uses (0.0.0.0). Unix needs ReuseAddress so that
    # connections in TIME_WAIT from the previous run do not count as busy, exactly like node's own bind.
    function Test-PortFree($port) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
        if (-not $onWindows) { $probe.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true) }
        $errorsBefore = $Error.Count
        try { $probe.Start(); $free = $true } catch { $free = $false } finally { $probe.Stop() }
        # A failed bind is the expected answer here, not an error worth keeping in $Error.
        while ($Error.Count -gt $errorsBefore) { $Error.RemoveAt(0) }
        return $free
    }

    function Wait-PortFree($port, $timeoutMs = 5000) {
        $deadline = (Get-Date).AddMilliseconds($timeoutMs)
        while (-not (Test-PortFree $port) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        return (Test-PortFree $port)
    }

    Stop-RecordedServers
    foreach ($port in @(4201, 4202)) {
        if (-not (Wait-PortFree $port)) {
            # Same policy as the Refinery Studio start script: do not start against a busy port.
            Write-Output "ERROR: Port $port is in use, not starting the dev servers"
            exit 1
        }
    }

    # Map configuration to Angular configuration name
    $ngConfiguration = if ($configuration -eq "Release") { "production" } else { "development" }

    # Start demo-app and legacy-demo-app using System.Diagnostics.Process
    # This works correctly both standalone and when called from Start-Job (no console/terminal required)
    function Start-NgServe($project, $port) {
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $nodeExe
        $psi.Arguments = "`"$ngCli`" serve $project --port $port --configuration $ngConfiguration"
        $psi.WorkingDirectory = $frontendLibsPath
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        # Redirect stdin and close it right after start. Without this the child inherits the
        # stdin handle of the Start-Job host (the job protocol pipe); npx blocked on it before
        # it ever spawned `ng serve` - the servers never came up and the log stayed empty.
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
    Set-Content -Path $pidFile -Value ($processes | ForEach-Object { "$($_.Id)|$($_.StartTime.ToUniversalTime().Ticks)" })

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
                try { $proc.Kill($true) } catch { Write-Output "Could not stop PID $($proc.Id): $($_.Exception.Message)" }
            }
        }
        Remove-Item $pidFile -Force -ErrorAction Ignore
        Write-Host "Servers stopped." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
