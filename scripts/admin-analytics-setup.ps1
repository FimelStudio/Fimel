[CmdletBinding()]
param([switch]$StageSecretVersion)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $StageSecretVersion) {
    Write-Host 'Readiness only: no credentials requested or production changes made.'
    Write-Host 'Target: fimel-admin / studiofimel.com. Permission: Zone > Analytics > Read, this zone only.'
    Write-Host 'After approval and token creation in Cloudflare, rerun with -StageSecretVersion.'
    return
}
Push-Location -LiteralPath $taskRoot
try {
    if (-not (Test-Path -LiteralPath '.artifacts/admin-deploy.json')) { throw 'Admin deployment target is not prepared.' }
    $analyticsSecure = Read-Host 'Paste the read-only Analytics Token here (hidden; never paste it into chat)' -AsSecureString
    $analyticsPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($analyticsSecure)
    try {
        $analyticsPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($analyticsPointer)
        $analyticsPayload = @{ token = $analyticsPlain } | ConvertTo-Json -Compress
        $analyticsPayload | & node --use-env-proxy --import tsx scripts/admin-analytics-secret.ts
        if ($LASTEXITCODE -ne 0) { throw 'Analytics setup failed; no version was intentionally activated.' }
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($analyticsPointer)
        $analyticsPlain = $null
        $analyticsPayload = $null
        $analyticsSecure.Dispose()
    }
} finally { Pop-Location }
