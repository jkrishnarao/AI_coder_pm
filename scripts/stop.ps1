$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot
try {
    docker compose down
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed to stop the application (exit code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}