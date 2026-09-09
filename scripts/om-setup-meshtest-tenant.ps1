#Requires -Version 7.0
<#
.SYNOPSIS
    Prepares the local `meshtest` tenant so that `npm run codegen` in octo-frontend-libraries and
    octo-frontend-refinery-studio can run against a complete GraphQL schema.

.DESCRIPTION
    The checked-in schema.graphql of both frontend repos is introspected from the local meshtest tenant.
    The GraphQL documents (src/**/*.graphql) reference types from 19 construction kit (CK) models, so the
    tenant must contain all of them before the schema is refreshed and codegen is run:

      Auto-installed on tenant creation (service-managed, nothing to do):
        System                (asset repository services)
        System.Identity       (identity services, System.Identity.Bootstrap blueprint)
        System.Notification   (identity services, System.Notification.Bootstrap blueprint)
        System.Bot            (bot services)
        System.UI             (platform services, System.UI.* cockpit blueprints)

      Installed by enabling a tenant feature:
        System.StreamData     octo-cli -c EnableStreamData
        System.Communication  octo-cli -c EnableCommunication
        System.Reporting      octo-cli -c EnableReporting      (needs the reporting service, port 5007)
        System.Ai             octo-cli -c EnableAi             (needs the AI service, port 5019, after EnableCommunication)

      Imported from the compiled octo-construction-kit outputs (octo-cli -c ImportCk):
        Basic, Basic.Energy, EnergyCommunity, Industry.Basic, Industry.Energy, Industry.Fluid,
        Industry.Maintenance, Industry.Manufacturing, Environment, OctoSdkDemo

    The script is idempotent: existing tenants, enabled features and already-installed CK model versions
    are detected and skipped. Only the octo-cli commands are used, so it works with any local checkout
    that was started with Start-Octo.

.PARAMETER TenantId
    Id of the tenant to prepare. Default: meshtest.

.PARAMETER Database
    MongoDB database name used when the tenant has to be created. Default: same as TenantId.

.PARAMETER BranchRoot
    Root directory of the branch checkout that contains octo-construction-kit. Default: two levels
    above this script (…/branches/<branch>).

.PARAMETER Configuration
    Build configuration of the octo-construction-kit outputs (DebugL, Debug, Release). Default: DebugL,
    the configuration used by Invoke-BuildAll / Start-Octo for local development.

.PARAMETER SystemContext
    octo-cli context that points at the system tenant (used for GetTenants / Create). Default: local_octosystem.

.PARAMETER TenantContext
    octo-cli context that points at the tenant. Created (or re-created when service URLs are missing)
    automatically. Default: local_<TenantId>.

.PARAMETER BuildConstructionKits
    Auto   - build octo-construction-kit only when a compiled ck-*.yaml is missing (default)
    Always - always run `dotnet build` before importing
    Never  - never build; fail when an output is missing

.PARAMETER SkipReporting
    Do not enable reporting (System.Reporting stays missing).

.PARAMETER SkipAi
    Do not enable the AI adapter (System.Ai stays missing).

.PARAMETER ImportSampleData
    Additionally import the runtime sample data (adapters, pipelines, simulator) from
    octo-construction-kit/src/Samples. Not required for codegen.

.PARAMETER Force
    Re-import CK models even if the same version is already installed.

.PARAMETER DryRun
    Print the octo-cli / dotnet commands instead of executing them.

.EXAMPLE
    ./scripts/om-setup-meshtest-tenant.ps1

.EXAMPLE
    ./scripts/om-setup-meshtest-tenant.ps1 -SkipAi -SkipReporting -ImportSampleData

.NOTES
    Prerequisites: services started via Start-Octo (identity, asset repo, bot, communication controller,
    platform services; optionally reporting + AI), octo-cli on PATH, an octo-cli context for the system
    tenant. Interactive device log-in is only started when a stored token cannot be refreshed.

    After the script has finished: refresh schema.graphql via the IDE GraphQL plugin (graphql.config.yml
    points at https://localhost:5001/tenants/meshTest/graphQL) and run `npm run codegen`.
#>
[CmdletBinding()]
param(
    [string]$TenantId = 'meshtest',
    [string]$Database = '',
    [string]$BranchRoot = '',
    [ValidateSet('DebugL', 'Debug', 'Release')]
    [string]$Configuration = 'DebugL',
    [string]$SystemContext = 'local_octosystem',
    [string]$TenantContext = '',
    [ValidateSet('Auto', 'Always', 'Never')]
    [string]$BuildConstructionKits = 'Auto',
    [switch]$SkipReporting,
    [switch]$SkipAi,
    [switch]$ImportSampleData,
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
# Native exit codes are evaluated explicitly below; do not let pwsh 7.4+ turn them into terminating errors.
$PSNativeCommandUseErrorActionPreference = $false

$TenantId = $TenantId.ToLowerInvariant()
if (-not $Database) { $Database = $TenantId }
if (-not $TenantContext) { $TenantContext = "local_$TenantId" }
if (-not $BranchRoot) { $BranchRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path }

$ConstructionKitRepo = Join-Path $BranchRoot 'octo-construction-kit'
$ConstructionKitSolution = Join-Path $ConstructionKitRepo 'Octo.ConstructionKit.sln'
$ConstructionKitSourceDir = Join-Path $ConstructionKitRepo 'src' 'ConstructionKits'
$SamplesDir = Join-Path $ConstructionKitRepo 'src' 'Samples'
$TargetFramework = 'net10.0'
$ContextsFile = Join-Path $HOME '.octo-cli' 'contexts.json'
$ServiceManagedWaitSeconds = 180

$LocalServiceDefaults = @{
    IdentityServiceUrl      = 'https://localhost:5003/'
    AssetServiceUrl         = 'https://localhost:5001/'
    BotServiceUrl           = 'https://localhost:5009/'
    CommunicationServiceUrl = 'https://localhost:5015/'
    ReportingServiceUrl     = 'https://localhost:5007/'
    AiServiceUrl            = 'https://localhost:5019/'
}

# Compiled CK projects in dependency order (see the `dependencies:` block of each ckModel.yaml).
$ConstructionKitProjects = @(
    'Octo.Sdk.Packages.Basic'
    'Octo.Sdk.Packages.Basic.Energy'
    'Octo.Sdk.Packages.EnergyCommunity'
    'Octo.Sdk.Packages.Industry.Basic'
    'Octo.Sdk.Packages.Industry.Energy'
    'Octo.Sdk.Packages.Industry.Fluid'
    'Octo.Sdk.Packages.Industry.Maintenance'
    'Octo.Sdk.Packages.Industry.Manufacturing'
    'Octo.Sdk.Packages.Environment'
    'Octo.Sdk.Demo'
)

$ServiceManagedModels = @('System', 'System.Identity', 'System.Notification', 'System.Bot', 'System.UI')
$FeatureModels = @{
    'Stream Data'   = 'System.StreamData'
    'Communication' = 'System.Communication'
    'Reporting'     = 'System.Reporting'
    'AI Services'   = 'System.Ai'
}

# --------------------------------------------------------------------------------------------------
# Output helpers
# --------------------------------------------------------------------------------------------------

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Info([string]$Message) { Write-Host "    $Message" }
function Write-Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "    WARNING: $Message" -ForegroundColor Yellow }
function Write-Cmd([string]$Message) { Write-Host "    > $Message" -ForegroundColor DarkGray }

# --------------------------------------------------------------------------------------------------
# octo-cli / context helpers
# --------------------------------------------------------------------------------------------------

function Invoke-OctoCli {
    <#
        Runs octo-cli against a named context (never touches the active context).
        Returns an object with ExitCode and Output (string[]). Throws on a non-zero exit code
        unless -AllowFailure is set. -Stream writes the output directly (needed for the device
        log-in so the user sees the code while the CLI is polling).
    #>
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$Context,
        [switch]$AllowFailure,
        [switch]$Quiet,
        [switch]$Stream
    )

    $display = "octo-cli $($Arguments -join ' ') --context $Context"
    if ($DryRun) {
        Write-Cmd "[dry-run] $display"
        return [pscustomobject]@{ ExitCode = 0; Output = @() }
    }

    Write-Cmd $display
    $output = @()
    if ($Stream) {
        & octo-cli @Arguments --context $Context
        $exitCode = $LASTEXITCODE
    }
    else {
        $output = @(& octo-cli @Arguments --context $Context 2>&1 | ForEach-Object { "$_" })
        $exitCode = $LASTEXITCODE
        if (-not $Quiet -or $exitCode -ne 0) {
            $output | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
    }

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "octo-cli exited with code $exitCode for: $display"
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

function Get-OctoContexts {
    if (-not (Test-Path $ContextsFile)) {
        throw "octo-cli context file not found at '$ContextsFile'. Register a context first (Register-OctoCliContext or octo-cli -c AddContext)."
    }
    return Get-Content -Raw $ContextsFile | ConvertFrom-Json -AsHashtable
}

function Get-OctoContextEntry([string]$Name) {
    $contexts = Get-OctoContexts
    if ($contexts.Contexts -and $contexts.Contexts.ContainsKey($Name)) {
        return $contexts.Contexts[$Name]
    }
    return $null
}

function Get-ContextOption($Entry, [string]$Key) {
    if ($null -eq $Entry -or $null -eq $Entry.OctoToolOptions) { return $null }
    $value = $Entry.OctoToolOptions[$Key]
    if ([string]::IsNullOrWhiteSpace($value)) { return $null }
    return $value
}

function Test-ServiceReachable([string]$Url) {
    $uri = [Uri]$Url
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync($uri.Host, $uri.Port)
        return $task.Wait(1500) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

# --------------------------------------------------------------------------------------------------
# GraphQL helpers (installed CK models of the tenant)
# --------------------------------------------------------------------------------------------------

function Get-InstalledCkModels {
    <#
        Returns a hashtable model name -> installed version, read via the asset repository GraphQL
        endpoint using the access token stored for the tenant context. Returns $null when the query
        fails (tenant not yet online, token expired, ...).
    #>
    param([Parameter(Mandatory)][string]$Context)

    if ($DryRun) { return @{} }

    $entry = Get-OctoContextEntry $Context
    $assetUrl = Get-ContextOption $entry 'AssetServiceUrl'
    $tenant = Get-ContextOption $entry 'TenantId'
    $token = $null
    if ($entry -and $entry.Authentication) { $token = $entry.Authentication['AccessToken'] }
    if (-not $assetUrl -or -not $tenant -or -not $token) { return $null }

    $endpoint = "$($assetUrl.TrimEnd('/'))/tenants/$tenant/graphQL"
    $query = '{ constructionKit { models(first: 500) { edges { node { id { name fullName } modelState } } } } }'
    try {
        $response = Invoke-RestMethod -Method Post -Uri $endpoint -SkipCertificateCheck `
            -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' `
            -Body (@{ query = $query } | ConvertTo-Json -Compress) -TimeoutSec 30
    }
    catch {
        Write-Verbose "GraphQL query failed: $($_.Exception.Message)"
        return $null
    }

    if ($response.errors) {
        Write-Verbose "GraphQL errors: $(($response.errors | ForEach-Object { $_.message }) -join '; ')"
        return $null
    }

    $models = @{}
    foreach ($edge in $response.data.constructionKit.models.edges) {
        $name = $edge.node.id.name
        $fullName = $edge.node.id.fullName
        $version = if ($fullName -and $fullName.Length -gt $name.Length + 1) { $fullName.Substring($name.Length + 1) } else { '?' }
        $models[$name] = $version
    }
    return $models
}

function Wait-ForCkModels {
    param(
        [Parameter(Mandatory)][string]$Context,
        [Parameter(Mandatory)][string[]]$Names,
        [int]$TimeoutSeconds = 120
    )

    if ($DryRun) { return @{} }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastMissing = $Names
    while ((Get-Date) -lt $deadline) {
        $installed = Get-InstalledCkModels -Context $Context
        if ($null -ne $installed) {
            $lastMissing = @($Names | Where-Object { -not $installed.ContainsKey($_) })
            if ($lastMissing.Count -eq 0) { return $installed }
        }
        Write-Info "Waiting for: $($lastMissing -join ', ') ..."
        Start-Sleep -Seconds 5
    }
    Write-Warn "Timed out after $TimeoutSeconds s waiting for: $($lastMissing -join ', ')"
    return Get-InstalledCkModels -Context $Context
}

# --------------------------------------------------------------------------------------------------
# Construction kit helpers
# --------------------------------------------------------------------------------------------------

function Resolve-ConstructionKit {
    <#
        Reads modelId from the project's ckModel.yaml and derives the compiled output file
        (ck-<name>[-<major>].yaml, the major suffix is omitted for major version 1 - see
        CkModelId.SemanticVersionedFullName in octo-construction-kit-engine).
    #>
    param([Parameter(Mandatory)][string]$Project)

    $projectDir = Join-Path $ConstructionKitSourceDir $Project
    $ckDir = Join-Path $projectDir 'ConstructionKit'
    if (-not (Test-Path $ckDir)) { throw "Construction kit source folder not found: $ckDir" }

    $modelFile = Get-ChildItem -Path $ckDir -File | Where-Object { $_.Name -ieq 'ckModel.yaml' } | Select-Object -First 1
    if (-not $modelFile) { throw "ckModel.yaml not found in $ckDir" }

    $match = Select-String -Path $modelFile.FullName -Pattern '^\s*modelId:\s*(?<name>[A-Za-z0-9.]+)-(?<version>\d+\.\d+\.\d+)' | Select-Object -First 1
    if (-not $match) { throw "No modelId found in $($modelFile.FullName)" }

    $name = $match.Matches[0].Groups['name'].Value
    $version = $match.Matches[0].Groups['version'].Value
    $major = [int]($version.Split('.')[0])
    $fileName = 'ck-' + $name.ToLowerInvariant() + $(if ($major -gt 1) { "-$major" } else { '' }) + '.yaml'
    $outputPath = Join-Path $projectDir 'bin' $Configuration $TargetFramework 'octo-ck-libraries' $Project 'out' $fileName

    return [pscustomobject]@{
        Project = $Project
        Name    = $name
        Version = $version
        Path    = $outputPath
    }
}

function Invoke-ConstructionKitBuild {
    if (-not (Test-Path $ConstructionKitSolution)) { throw "Solution not found: $ConstructionKitSolution" }
    Write-Cmd "dotnet build $ConstructionKitSolution -c $Configuration --nologo"
    if ($DryRun) { return }
    & dotnet build $ConstructionKitSolution -c $Configuration --nologo -v minimal
    if ($LASTEXITCODE -ne 0) { throw "dotnet build of octo-construction-kit failed (exit code $LASTEXITCODE)" }
}

# --------------------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------------------

$skippedModels = @{}   # model name -> reason (excluded from the final verification)

Write-Step "Preflight"
if (-not (Get-Command octo-cli -ErrorAction SilentlyContinue)) {
    throw "octo-cli not found on PATH. Load the octo-tools profile or add the octo-cli build output to PATH."
}
Write-Info "octo-cli:            $((Get-Command octo-cli).Source)"
Write-Info "Branch root:         $BranchRoot"
Write-Info "Tenant / database:   $TenantId / $Database"
Write-Info "Contexts:            system=$SystemContext tenant=$TenantContext"
Write-Info "CK configuration:    $Configuration"
if ($DryRun) { Write-Warn "Dry run - no command is executed." }

if (-not (Test-Path $ConstructionKitSourceDir)) {
    throw "octo-construction-kit not found at '$ConstructionKitRepo'. Pass -BranchRoot <…/branches/<branch>>."
}

$systemEntry = Get-OctoContextEntry $SystemContext
if (-not $systemEntry) {
    throw "octo-cli context '$SystemContext' does not exist. Create it first, e.g. Register-OctoCliContext (octo-tools) or octo-cli -c AddContext -n $SystemContext …"
}

$serviceUrls = @{}
foreach ($key in $LocalServiceDefaults.Keys) {
    $value = Get-ContextOption $systemEntry $key
    if (-not $value) { $value = $LocalServiceDefaults[$key] }
    $serviceUrls[$key] = $value
}

foreach ($required in @('IdentityServiceUrl', 'AssetServiceUrl')) {
    if (-not (Test-ServiceReachable $serviceUrls[$required])) {
        $message = "$required ($($serviceUrls[$required])) is not reachable. Start the local services first (Start-Octo)."
        if ($DryRun) { Write-Warn $message } else { throw $message }
    }
}

$platformReachable = Test-ServiceReachable 'https://localhost:5025/'
$reportingReachable = Test-ServiceReachable $serviceUrls.ReportingServiceUrl
$aiReachable = Test-ServiceReachable $serviceUrls.AiServiceUrl
$enableReporting = -not $SkipReporting -and $reportingReachable
$enableAi = -not $SkipAi -and $aiReachable

if ($SkipReporting) { $skippedModels['System.Reporting'] = 'skipped (-SkipReporting)' }
elseif (-not $reportingReachable) {
    $skippedModels['System.Reporting'] = "reporting service not reachable at $($serviceUrls.ReportingServiceUrl) (Start-Octo -reportingService `$true)"
    Write-Warn $skippedModels['System.Reporting']
}
if ($SkipAi) { $skippedModels['System.Ai'] = 'skipped (-SkipAi)' }
elseif (-not $aiReachable) {
    $skippedModels['System.Ai'] = "AI service not reachable at $($serviceUrls.AiServiceUrl) (Start-Octo -aiService `$true)"
    Write-Warn $skippedModels['System.Ai']
}
if (-not $platformReachable) {
    $skippedModels['System.UI'] = 'platform services not reachable at https://localhost:5025/ (System.UI is installed by platform services)'
    Write-Warn $skippedModels['System.UI']
}

Write-Step "Ensure octo-cli context '$TenantContext'"
$tenantEntry = Get-OctoContextEntry $TenantContext
$requiredKeys = @('IdentityServiceUrl', 'AssetServiceUrl', 'BotServiceUrl', 'CommunicationServiceUrl')
if ($enableReporting) { $requiredKeys += 'ReportingServiceUrl' }
if ($enableAi) { $requiredKeys += 'AiServiceUrl' }

$contextNeedsUpdate = $null -eq $tenantEntry -or (Get-ContextOption $tenantEntry 'TenantId') -ne $TenantId
foreach ($key in $requiredKeys) {
    if (-not (Get-ContextOption $tenantEntry $key)) { $contextNeedsUpdate = $true }
}

if ($contextNeedsUpdate) {
    if ($tenantEntry) { Write-Warn "Context '$TenantContext' lacks required service URLs and is re-created; a device log-in will be required once." }
    $arguments = @('-c', 'AddContext', '-n', $TenantContext, '-tid', $TenantId,
        '-isu', $serviceUrls.IdentityServiceUrl,
        '-asu', $serviceUrls.AssetServiceUrl,
        '-bsu', $serviceUrls.BotServiceUrl,
        '-csu', $serviceUrls.CommunicationServiceUrl,
        '-rsu', $serviceUrls.ReportingServiceUrl,
        '-aisu', $serviceUrls.AiServiceUrl)
    # AddContext writes the named context; --context only selects the context the command runs under.
    Invoke-OctoCli -Arguments $arguments -Context $SystemContext -Quiet | Out-Null
    Write-Ok "Context '$TenantContext' written."
}
else {
    Write-Ok "Context '$TenantContext' is complete."
}

Write-Step "Log in to system tenant context '$SystemContext'"
Invoke-OctoCli -Arguments @('-c', 'LogIn', '-i', '-in') -Context $SystemContext -Stream | Out-Null

Write-Step "Ensure tenant '$TenantId'"
$tenantsResult = Invoke-OctoCli -Arguments @('-c', 'GetTenants') -Context $SystemContext -Quiet
$tenantsJson = $tenantsResult.Output -join "`n"
$jsonStart = $tenantsJson.IndexOf('[')
$existingTenants = @()
if ($jsonStart -ge 0) { $existingTenants = @($tenantsJson.Substring($jsonStart) | ConvertFrom-Json) }
$tenantExists = $null -ne ($existingTenants | Where-Object { $_.tenantId -eq $TenantId })

if ($tenantExists) {
    Write-Ok "Tenant '$TenantId' already exists."
}
else {
    Write-Info "Creating tenant '$TenantId' (database '$Database') and provisioning the current user as admin."
    Invoke-OctoCli -Arguments @('-c', 'Create', '-tid', $TenantId, '-db', $Database) -Context $SystemContext | Out-Null
    Write-Ok "Tenant '$TenantId' created."
}

Write-Step "Log in to tenant context '$TenantContext'"
Invoke-OctoCli -Arguments @('-c', 'LogIn', '-i', '-in') -Context $TenantContext -Stream | Out-Null

Write-Step "Wait for service-managed CK models"
$expectedServiceManaged = @($ServiceManagedModels | Where-Object { -not $skippedModels.ContainsKey($_) })
$installed = Wait-ForCkModels -Context $TenantContext -Names $expectedServiceManaged -TimeoutSeconds $ServiceManagedWaitSeconds
if ($null -eq $installed) { $installed = @{} }
foreach ($name in $expectedServiceManaged) {
    if ($installed.ContainsKey($name)) { Write-Ok "$name $($installed[$name])" } else { Write-Warn "$name not installed yet" }
}

Write-Step "Enable tenant features"
$features = @{}
$featuresResult = Invoke-OctoCli -Arguments @('-c', 'GetTenantFeatures') -Context $TenantContext -Quiet
foreach ($line in $featuresResult.Output) {
    if ($line -match '^\s*(?<name>Stream Data|Communication|Reporting|AI Services)\s+(?<state>Enabled|Disabled)') {
        $features[$Matches.name] = $Matches.state -eq 'Enabled'
    }
}

$featurePlan = @(
    [pscustomobject]@{ Name = 'Stream Data';   Command = 'EnableStreamData';   Enable = $true }
    [pscustomobject]@{ Name = 'Communication'; Command = 'EnableCommunication'; Enable = $true }
    [pscustomobject]@{ Name = 'Reporting';     Command = 'EnableReporting';     Enable = $enableReporting }
    [pscustomobject]@{ Name = 'AI Services';   Command = 'EnableAi';            Enable = $enableAi }
)
foreach ($feature in $featurePlan) {
    $model = $FeatureModels[$feature.Name]
    if (-not $feature.Enable) {
        Write-Info "$($feature.Name): skipped ($model)"
        continue
    }
    if ($features.ContainsKey($feature.Name) -and $features[$feature.Name]) {
        Write-Ok "$($feature.Name): already enabled ($model)"
        continue
    }
    $result = Invoke-OctoCli -Arguments @('-c', $feature.Command) -Context $TenantContext -AllowFailure
    if ($result.ExitCode -eq 0) {
        Write-Ok "$($feature.Name): enabled ($model)"
    }
    else {
        Write-Warn "$($feature.Command) failed (exit code $($result.ExitCode)); $model will be missing."
    }
}

Write-Step "Resolve compiled construction kits ($Configuration)"
$constructionKits = @($ConstructionKitProjects | ForEach-Object { Resolve-ConstructionKit $_ })
$missingOutputs = @($constructionKits | Where-Object { -not (Test-Path $_.Path) })
foreach ($ck in $constructionKits) {
    $state = if (Test-Path $ck.Path) { 'ok' } else { 'MISSING' }
    Write-Info ("{0,-24} {1,-8} {2,-8} {3}" -f $ck.Name, $ck.Version, $state, $ck.Path.Replace($BranchRoot, '.'))
}

$needsBuild = $BuildConstructionKits -eq 'Always' -or ($BuildConstructionKits -eq 'Auto' -and $missingOutputs.Count -gt 0)
if ($needsBuild) {
    Write-Step "Build octo-construction-kit ($Configuration)"
    Invoke-ConstructionKitBuild
    $missingOutputs = @($constructionKits | Where-Object { -not (Test-Path $_.Path) })
}
if ($missingOutputs.Count -gt 0 -and -not $DryRun) {
    throw "Compiled construction kit(s) missing after build: $(($missingOutputs | ForEach-Object { $_.Path }) -join ', ')"
}

Write-Step "Import construction kits into '$TenantId'"
$installed = Get-InstalledCkModels -Context $TenantContext
if ($null -eq $installed) { $installed = @{} }
foreach ($ck in $constructionKits) {
    if (-not $Force -and $installed.ContainsKey($ck.Name) -and $installed[$ck.Name] -eq $ck.Version) {
        Write-Ok "$($ck.Name) $($ck.Version) already installed"
        continue
    }
    $previous = if ($installed.ContainsKey($ck.Name)) { " (installed: $($installed[$ck.Name]))" } else { '' }
    Write-Info "Importing $($ck.Name) $($ck.Version)$previous"
    Invoke-OctoCli -Arguments @('-c', 'ImportCk', '-f', $ck.Path, '-w') -Context $TenantContext -Quiet | Out-Null
    Write-Ok "$($ck.Name) $($ck.Version) imported"
}

if ($ImportSampleData) {
    Write-Step "Import runtime sample data (optional)"
    # Single source of truth are the sample scripts; only the ImportRt lines are taken from them
    # because the feature toggles they contain (EnableCommunication / EnableStreamData) were handled above.
    $sampleScripts = @('om_importrt_sample_general.ps1', 'om_importrt_sample_simulation.ps1')
    Push-Location $SamplesDir
    try {
        foreach ($script in $sampleScripts) {
            $scriptPath = Join-Path $SamplesDir $script
            if (-not (Test-Path $scriptPath)) { Write-Warn "Sample script not found: $scriptPath"; continue }
            $files = Select-String -Path $scriptPath -Pattern 'ImportRt\s+-f\s+(?<file>\S+)' | ForEach-Object { $_.Matches[0].Groups['file'].Value }
            foreach ($file in $files) {
                Invoke-OctoCli -Arguments @('-c', 'ImportRt', '-f', $file, '-w', '-r') -Context $TenantContext -Quiet | Out-Null
                Write-Ok "$file imported"
            }
        }
    }
    finally {
        Pop-Location
    }
}

Write-Step "Verify CK models required by codegen"
$expectedModels = @($ServiceManagedModels) + @($featurePlan | ForEach-Object { $FeatureModels[$_.Name] }) + @($constructionKits | ForEach-Object { $_.Name })
$installed = Get-InstalledCkModels -Context $TenantContext
if ($null -eq $installed) { $installed = @{} }

$missing = @()
$rows = foreach ($name in $expectedModels) {
    $state = if ($installed.ContainsKey($name)) { 'installed' }
    elseif ($skippedModels.ContainsKey($name)) { 'skipped' }
    else { $missing += $name; 'MISSING' }
    [pscustomobject]@{
        Model   = $name
        Version = if ($installed.ContainsKey($name)) { $installed[$name] } else { '-' }
        State   = $state
        Note    = if ($skippedModels.ContainsKey($name) -and -not $installed.ContainsKey($name)) { $skippedModels[$name] } else { '' }
    }
}
$rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

if ($DryRun) {
    Write-Warn "Dry run finished - nothing was changed."
    exit 0
}

if ($missing.Count -gt 0) {
    Write-Host "Tenant '$TenantId' is NOT complete. Missing: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

$skippedNames = @($skippedModels.Keys | Where-Object { -not $installed.ContainsKey($_) })
if ($skippedNames.Count -gt 0) {
    Write-Warn "Skipped models (types of these models will be absent from the schema): $($skippedNames -join ', ')"
}

Write-Host ""
Write-Host "Tenant '$TenantId' is ready for codegen." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Refresh schema.graphql via the IDE GraphQL plugin (graphql.config.yml, endpoint"
Write-Host "     $($serviceUrls.AssetServiceUrl)tenants/$TenantId/graphQL, bearer token = Authentication.AccessToken"
Write-Host "     of context '$TenantContext' in $ContextsFile)."
Write-Host "  2. Run 'npm run codegen' in src/frontend-libraries and src/octo-mesh-refinery-studio."
exit 0
