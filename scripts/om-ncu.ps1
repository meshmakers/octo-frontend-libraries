# Check for npm updates in frontend libraries and library projects
param(
    [switch]$u
)

$repoRoot = Split-Path -Parent $PSScriptRoot

# frontend-libraries (root)
Write-Host "Checking frontend-libraries..." -ForegroundColor Cyan
Push-Location "$repoRoot\src\frontend-libraries"
if ($u) { ncu -u } else { ncu }
Pop-Location

# frontend-libraries sub-projects
$libraryProjects = @(
    "octo-services",
    "octo-ui",
    "octo-meshboard",
    "octo-process-diagrams",
    "shared-auth",
    "shared-services",
    "shared-ui"
)

foreach ($project in $libraryProjects) {
    Write-Host "Checking frontend-libraries/projects/meshmakers/$project..." -ForegroundColor Cyan
    Push-Location "$repoRoot\src\frontend-libraries\projects\meshmakers\$project"
    if ($u) { ncu -u } else { ncu }
    Pop-Location
}
