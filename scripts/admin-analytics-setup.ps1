[CmdletBinding()]
param([switch]$StageSecretVersion, [switch]$FromClipboard)
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
    & node scripts/admin-deploy-target.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Admin deployment target is not prepared.' }
    $analyticsSecure = $null
    $analyticsPointer = [IntPtr]::Zero
    try {
        if ($FromClipboard) {
            $analyticsPlain = Get-Clipboard -Raw -ErrorAction Stop
            if ([string]::IsNullOrWhiteSpace($analyticsPlain)) { throw 'Clipboard is empty. Copy the complete Token from Cloudflare, then rerun.' }
            Write-Host 'Reading clipboard privately; its contents will not be displayed or saved.'
        } else {
            $analyticsSecure = Read-Host 'Paste the complete Token (right-click or Ctrl+Shift+V if Ctrl+V fails)' -AsSecureString
            $analyticsPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($analyticsSecure)
            $analyticsPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($analyticsPointer)
        }
        $analyticsPayload = @{ token = $analyticsPlain } | ConvertTo-Json -Compress
        $analyticsPayload | & node --use-env-proxy --import tsx scripts/admin-analytics-secret.ts
        if ($LASTEXITCODE -ne 0) { throw 'Analytics setup failed; no version was intentionally activated.' }
    } finally {
        if ($analyticsPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($analyticsPointer) }
        $analyticsPlain = $null
        $analyticsPayload = $null
        if ($null -ne $analyticsSecure) { $analyticsSecure.Dispose() }
    }
} finally { Pop-Location }
