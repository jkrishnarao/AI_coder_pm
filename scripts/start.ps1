$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot
try {
    docker compose up --build -d
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed to start the application (exit code $LASTEXITCODE)."
    }
    $port = if ($env:PM_PORT) { $env:PM_PORT } else { "8000" }
    Write-Output "Project Management MVP is starting at http://localhost:$port"
}
finally {
    Pop-Location
}