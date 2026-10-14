#requires -Version 5.1
Set-StrictMode -Version Latest

function Resolve-FimelRclone {
    param([string]$RclonePath)
    if ($RclonePath) {
        $command = Get-Command -Name $RclonePath -CommandType Application -ErrorAction Stop
        return $command.Source
    }
    $command = Get-Command rclone.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    # A newly installed application may not yet be on this terminal's PATH.
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\rclone\rclone.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    throw 'rclone.exe was not found. Supply -RclonePath with its executable path; do not supply credentials.'
}

function Assert-FimelR2FileSize {
    param([long]$Size, [string]$WorkId, [switch]$SmokeTest)
    if ($SmokeTest) {
        if (-not $WorkId.StartsWith('r2-smoke-') -or $Size -lt 1 -or $Size -gt 1MB) {
            throw 'SmokeTest requires an r2-smoke-* WorkId and a ZIP no larger than 1 MiB.'
        }
    } elseif ($Size -lt 1 -or $Size -gt 1GB) {
        throw 'Release file size must be between 1 byte and 1 GiB.'
    }
}

function New-FimelR2UploadPlan {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][ValidateSet('bedrock', 'java', 'datapacks', 'tools', 'mods')][string]$WorkType,
        [Parameter(Mandatory = $true)][string]$WorkId,
        [Parameter(Mandatory = $true)][string]$Version,
        [switch]$SmokeTest
    )
    if ($WorkId -cnotmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' -or $WorkId.Length -gt 100) {
        throw 'WorkId must be a lowercase catalogue slug, e.g. fimel-card. Paths are not accepted.'
    }
    if ($Version -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$') {
        throw 'Version must be one path segment, e.g. 1.0.0 or 1.0.0-beta.1.'
    }
    $file = Get-Item -LiteralPath $FilePath -ErrorAction Stop
    $extension = $file.Extension.ToLowerInvariant()
    if ($file.PSIsContainer -or $extension -notin @('.zip', '.jar', '.exe', '.mcworld', '.mcpack', '.mctemplate')) {
        throw 'FilePath must identify a release ZIP, JAR, EXE, MCWORLD, MCPACK or MCTEMPLATE file.'
    }
    if ($file.Name -match '[\x00-\x1f]') { throw 'Control characters are not allowed in the filename.' }
    Assert-FimelR2FileSize -Size $file.Length -WorkId $WorkId -SmokeTest:$SmokeTest
    if ($extension -eq '.exe') {
        $reader = [IO.BinaryReader]::new([IO.File]::OpenRead($file.FullName))
        try {
            if ($reader.BaseStream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5A4D) { throw 'Invalid executable header.' }
            $reader.BaseStream.Position = 60
            $peOffset = $reader.ReadInt32()
            if ($peOffset -lt 64 -or $peOffset -gt ($reader.BaseStream.Length - 4)) { throw 'Invalid PE offset.' }
            $reader.BaseStream.Position = $peOffset
            if ($reader.ReadUInt32() -ne 0x00004550) { throw 'Invalid PE signature.' }
        } finally { $reader.Dispose() }
    } else {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = $null
        try {
            $archive = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
            if ($archive.Entries.Count -eq 0) { throw 'The ZIP archive is empty.' }
        } catch {
            throw 'The file is not a readable, non-empty ZIP-compatible archive.'
        } finally {
            if ($archive) { $archive.Dispose() }
        }
    }
    $key = 'works/{0}/{1}/{2}/{3}' -f $WorkType.ToLowerInvariant(), $WorkId, $Version, $file.Name
    $encodedKey = ($key.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    [pscustomobject]@{
        FilePath = $file.FullName
        FileName = $file.Name
        Size = [long]$file.Length
        Bucket = 'fimel-downloads'
        Remote = 'fimel-r2'
        Key = $key
        RemotePath = 'fimel-r2:fimel-downloads/' + $key
        DownloadUrl = 'https://download.studiofimel.com/' + $encodedKey
        ContentType = $(if ($extension -eq '.exe') { 'application/octet-stream' } elseif ($extension -eq '.jar') { 'application/java-archive' } else { 'application/zip' })
    }
}

function Invoke-FimelRclone {
    param([string]$Executable, [string[]]$Arguments, [switch]$ShowProgress)
    # Never use config show/dump, debug logging, eval, or credential arguments.
    $previousEncoding = [Console]::OutputEncoding
    $previousPreference = $ErrorActionPreference
    $lines = [System.Collections.Generic.List[string]]::new()
    try {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | ForEach-Object {
            $line = $_.ToString()
            if ($ShowProgress) { Write-Host $line }
            else { $lines.Add($line) }
        }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
        [Console]::OutputEncoding = $previousEncoding
    }
    [pscustomobject]@{ ExitCode = $code; Output = ($lines -join "`n") }
}

function Get-FimelR2Object {
    param([string]$Executable, [string]$RemotePath, [string[]]$CommonFlags)
    $response = Invoke-FimelRclone $Executable (@('lsjson', $RemotePath, '--stat', '--hash') + $CommonFlags)
    if ($response.ExitCode -in @(3, 4)) { return $null }
    if ($response.ExitCode -ne 0) {
        # Permission/network failures must not be mistaken for a missing file.
        throw "Cannot check target object (rclone exit $($response.ExitCode)). Upload cancelled."
    }
    try { $item = $response.Output | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Invalid target metadata; upload cancelled.' }
    if ($null -eq $item -or -not ($item.PSObject.Properties.Name -contains 'IsDir')) {
        throw 'Incomplete target metadata; upload cancelled.'
    }
    if ($item.IsDir) {
        # Missing S3 keys return an empty pseudo-directory, not exit 4.
        if ($item.Name -eq '' -and $item.Size -eq -1) { return $null }
        throw 'The target is a directory/prefix, not an unused object key.'
    }
    return $item
}

function Invoke-FimelR2Upload {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][ValidateSet('bedrock', 'java', 'datapacks', 'tools', 'mods')][string]$WorkType,
        [Parameter(Mandatory = $true)][string]$WorkId,
        [Parameter(Mandatory = $true)][string]$Version,
        [string]$RclonePath,
        [ValidateRange(1, 10)][int]$Retries = 3,
        [switch]$FullVerification,
        [switch]$SmokeTest
    )
    $ErrorActionPreference = 'Stop'
    if ($env:RCLONE_DUMP) { throw 'Unset RCLONE_DUMP before running; diagnostic dumps can expose credentials.' }
    $plan = New-FimelR2UploadPlan -FilePath $FilePath -WorkType $WorkType -WorkId $WorkId -Version $Version -SmokeTest:$SmokeTest
    $executable = Resolve-FimelRclone $RclonePath
    $commonFlags = @('--s3-provider', 'Cloudflare', '--ask-password=false', '--log-level', 'ERROR',
        '--retries', "$Retries", '--low-level-retries', '10', '--retries-sleep', '5s', '--contimeout', '15s', '--timeout', '2m')
    $fileLock = $null
    $mutex = $null
    $acquired = $false
    try {
        # Prevent parallel invocations on this machine from targeting the same key.
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $keyHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($plan.RemotePath))).Replace('-', '') }
        finally { $sha.Dispose() }
        $mutex = [Threading.Mutex]::new($false, ('Local\FimelR2Upload-' + $keyHash))
        try { $acquired = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired = $true }
        if (-not $acquired) { throw 'Another upload to this object is running on this machine.' }
        # Freeze source contents during hashing and transfer; another writer must wait.
        $fileLock = [IO.File]::Open($plan.FilePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        if ($fileLock.Length -ne $plan.Size) { throw 'Source size changed after validation; upload cancelled.' }
        $root = Invoke-FimelRclone $executable (@('lsjson', 'fimel-r2:fimel-downloads', '--max-depth', '1') + $commonFlags)
        if ($root.ExitCode -ne 0) { throw "Cannot list fimel-downloads (rclone exit $($root.ExitCode)); upload cancelled." }
        # Parsing confirms that the remote really returned a list, not an error page.
        try { $null = $root.Output | ConvertFrom-Json -ErrorAction Stop } catch { throw 'Invalid bucket listing; upload cancelled.' }
        $existing = Get-FimelR2Object $executable $plan.RemotePath $commonFlags
        if ($null -ne $existing) { throw "Target already exists. No overwrite performed: $($plan.Key). Choose a new version or filename." }
        Write-Host "Source: $($plan.FilePath)"
        Write-Host ('Size: {0:N2} MiB' -f ($plan.Size / 1MB))
        Write-Host "Target: $($plan.RemotePath)"
        if (-not $PSCmdlet.ShouldProcess($plan.RemotePath, 'Upload a NEW release file and verify its contents')) {
            return [pscustomobject]@{ Uploaded = $false; Key = $plan.Key; PlannedDownloadUrl = $plan.DownloadUrl }
        }
        $localMd5 = (Get-FileHash -LiteralPath $plan.FilePath -Algorithm MD5).Hash.ToLowerInvariant()
        $localSha256 = (Get-FileHash -LiteralPath $plan.FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
        # Recheck after confirmation/hash computation; refuse even identical objects.
        if ($null -ne (Get-FimelR2Object $executable $plan.RemotePath $commonFlags)) { throw 'Target appeared during preflight. Upload cancelled.' }
        $uploadFlags = @('--immutable', '--ignore-existing', '--checksum', '--ignore-times=false', '--no-check-dest=false',
            '--s3-no-check-bucket', '--s3-disable-checksum=false', '--s3-upload-cutoff', '32M', '--s3-chunk-size', '16M',
            '--s3-upload-concurrency', '4', '--transfers', '1', '--progress', '--stats', '2s', '--stats-one-line',
            '--metadata', '--metadata-set', 'content-disposition=attachment', '--metadata-set', ('content-type=' + $plan.ContentType),
            '--metadata-set', 'cache-control=public,max-age=31536000,immutable',
            '--log-level', 'NOTICE')
        $upload = Invoke-FimelRclone $executable (@('copyto', $plan.FilePath, $plan.RemotePath) + $commonFlags + $uploadFlags) -ShowProgress
        if ($upload.ExitCode -ne 0) {
            throw "Upload failed (rclone exit $($upload.ExitCode)). No automatic deletion or overwrite will be attempted; inspect the target before retrying."
        }
        $remote = Get-FimelR2Object $executable $plan.RemotePath $commonFlags
        if ($null -eq $remote -or [long]$remote.Size -ne $plan.Size) { throw 'Remote size verification failed. No success URL issued; remote object retained.' }
        $remoteMd5 = $null
        if ($remote.PSObject.Properties.Name -contains 'Hashes' -and $remote.Hashes) {
            $md5Property = $remote.Hashes.PSObject.Properties | Where-Object { $_.Name -ieq 'MD5' } | Select-Object -First 1
            if ($md5Property) { $remoteMd5 = [string]$md5Property.Value }
        }
        if ($remoteMd5 -and $remoteMd5.ToLowerInvariant() -ne $localMd5) { throw 'Remote MD5 mismatch. Object retained for manual inspection; no success URL issued.' }
        $verification = 'size+MD5'
        if ($FullVerification -or -not $remoteMd5) {
            Write-Host 'Verifying SHA-256 by streaming the complete remote file (an additional download).'
            $hash = Invoke-FimelRclone $executable (@('hashsum', 'SHA256', $plan.RemotePath, '--download') + $commonFlags) -ShowProgress:$false
            if ($hash.ExitCode -ne 0 -or $hash.Output -notmatch '(?m)^([a-fA-F0-9]{64})\s{2}') { throw 'Remote SHA-256 readback failed. Object retained; no success URL issued.' }
            if ($Matches[1].ToLowerInvariant() -ne $localSha256) { throw 'Remote SHA-256 mismatch. Object retained; no success URL issued.' }
            $verification = 'size+SHA256-download'
        }
        Write-Host "Upload verified ($verification)."
        Write-Host "Download URL: $($plan.DownloadUrl)"
        [pscustomobject]@{
            Uploaded = $true
            Key = $plan.Key
            Size = $plan.Size
            MD5 = $localMd5
            SHA256 = $localSha256
            Verification = $verification
            DownloadUrl = $plan.DownloadUrl
            CompletedUtc = [DateTime]::UtcNow.ToString('o')
        }
    } finally {
        if ($fileLock) { $fileLock.Dispose() }
        if ($acquired) { $mutex.ReleaseMutex() }
        if ($mutex) { $mutex.Dispose() }
    }
}

Export-ModuleMember -Function Resolve-FimelRclone, New-FimelR2UploadPlan, Invoke-FimelR2Upload
