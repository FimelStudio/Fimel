#requires -Version 5.1
# Offline regression tests. No Cloudflare/rclone credentials or network needed.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'R2Upload.psm1') -Force
$module = Get-Module R2Upload
$repository = Split-Path $PSScriptRoot -Parent
$testDirectory = Join-Path $repository ('.artifacts\r2-script-tests\' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $testDirectory -Force
$zip = Join-Path $testDirectory 'sample file.zip'
Compress-Archive -LiteralPath (Join-Path $repository 'tests\fixtures\r2-upload\smoke.txt') -DestinationPath $zip
$size = (Get-Item -LiteralPath $zip).Length
$md5 = (Get-FileHash -LiteralPath $zip -Algorithm MD5).Hash.ToLowerInvariant()
$sha256 = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()

# Replace only the module's command boundary with an in-memory double.
& $module {
    param($size, $md5, $sha256)
    $script:TestSize = $size
    $script:TestMd5 = $md5
    $script:TestSha256 = $sha256
    function script:Resolve-FimelRclone { return 'offline-double' }
    function script:Invoke-FimelRclone {
        param([string]$Executable, [string[]]$Arguments, [switch]$ShowProgress)
        $script:Calls.Add($Arguments)
        $response = @{ ExitCode = 0; Output = '' }
        switch ($Arguments[0]) {
            'lsjson' {
                if ($Arguments[1] -eq 'fimel-r2:fimel-downloads') {
                    if ($script:Scenario -eq 'RootFailure') { $response.ExitCode = 7 }
                    $response.Output = '[]'
                } else {
                    $script:StatCount++
                    if ($script:Scenario -eq 'PermissionFailure') { $response.ExitCode = 7; break }
                    if ($script:Scenario -eq 'BadJson') { $response.Output = 'not JSON'; break }
                    $present = $script:StatCount -ge 3 -or $script:Scenario -eq 'Existing' -or
                        ($script:Scenario -eq 'Appeared' -and $script:StatCount -eq 2)
                    if ($present) {
                        $object = @{ IsDir = $false; Name = 'sample file.zip'; Size = $script:TestSize; Hashes = @{ MD5 = $script:TestMd5 } }
                        if ($script:Scenario -eq 'WrongSize') { $object.Size++ }
                        if ($script:Scenario -eq 'WrongMd5') { $object.Hashes.MD5 = '00000000000000000000000000000000' }
                        if ($script:Scenario -eq 'NoHash') { $object.Hashes = @{} }
                        $response.Output = $object | ConvertTo-Json -Compress
                    } elseif ($script:Scenario -eq 'NotFoundExit') {
                        $response.ExitCode = 4
                    } else {
                        $response.Output = '{"IsDir":true,"Name":"","Size":-1}'
                    }
                }
            }
            'copyto' { if ($script:Scenario -eq 'UploadFailure') { $response.ExitCode = 5 } }
            'hashsum' {
                $remoteHash = $script:TestSha256
                if ($script:Scenario -eq 'WrongSha256') { $remoteHash = '0' * 64 }
                $response.Output = "$remoteHash  sample file.zip"
            }
            default { throw 'Unexpected command in offline test.' }
        }
        return [pscustomobject]$response
    }
} $size $md5 $sha256

$script:passed = 0
function Assert-True { param([bool]$Condition, [string]$Message); if (-not $Condition) { throw $Message } }
function Expect-Failure {
    param([scriptblock]$Action, [string]$Pattern)
    $caught = $false
    try { $null = & $Action } catch { $caught = $true; if ($_.Exception.Message -notmatch $Pattern) { throw } }
    if (-not $caught) { throw "Expected failure matching: $Pattern" }
}
function Test-Case {
    param([string]$Name, [scriptblock]$Action)
    & $module {
        $script:Scenario = 'Success'
        $script:StatCount = 0
        $script:Calls = [System.Collections.Generic.List[object]]::new()
    }
    & $Action
    $script:passed++
    Write-Host "PASS: $Name"
}
$parameters = @{ FilePath = $zip; WorkType = 'tools'; WorkId = 'r2-smoke-offline'; Version = '1.0.0'; SmokeTest = $true; Confirm = $false }

Test-Case 'key layout, escaped URL and all catalogue categories' {
    foreach ($type in @('bedrock', 'java', 'datapacks', 'tools', 'mods')) {
        $plan = New-FimelR2UploadPlan -FilePath $zip -WorkType $type -WorkId r2-smoke-offline -Version 1.0.0 -SmokeTest
        Assert-True ($plan.Key -eq "works/$type/r2-smoke-offline/1.0.0/sample file.zip") 'Incorrect object key'
        Assert-True ($plan.DownloadUrl.EndsWith('/sample%20file.zip')) 'URL was not escaped'
    }
}
Test-Case 'reject path traversal, invalid type, and fake ZIP' {
    Expect-Failure { New-FimelR2UploadPlan -FilePath $zip -WorkType tools -WorkId '../escape' -Version 1 -SmokeTest } 'WorkId'
    Expect-Failure { New-FimelR2UploadPlan -FilePath $zip -WorkType tools -WorkId r2-smoke-offline -Version '../1' -SmokeTest } 'Version'
    Expect-Failure { New-FimelR2UploadPlan -FilePath $zip -WorkType unknown -WorkId r2-smoke-offline -Version 1 -SmokeTest } 'ValidateSet|argument|parameter'
    $fakeZip = Join-Path $testDirectory 'fake.zip'
    Copy-Item -LiteralPath (Join-Path $repository 'tests\fixtures\r2-upload\smoke.txt') -Destination $fakeZip
    Expect-Failure { New-FimelR2UploadPlan -FilePath $fakeZip -WorkType tools -WorkId r2-smoke-offline -Version 1 -SmokeTest } 'readable'
}
Test-Case 'small release, 100 MB and 1 GiB bounds without allocating giant files' {
    & $module {
        Assert-FimelR2FileSize -Size 100000000 -WorkId sample
        Assert-FimelR2FileSize -Size 53731 -WorkId sample
        Assert-FimelR2FileSize -Size 1GB -WorkId sample
    }
    Expect-Failure { & $module { Assert-FimelR2FileSize -Size 0 -WorkId sample } } 'size'
    Expect-Failure { & $module { Assert-FimelR2FileSize -Size (1GB + 1) -WorkId sample } } 'size'
    Expect-Failure { & $module { Assert-FimelR2FileSize -Size 10 -WorkId real-project -SmokeTest } } 'SmokeTest'
    Expect-Failure { & $module { Assert-FimelR2FileSize -Size (1MB + 1) -WorkId r2-smoke-test -SmokeTest } } 'SmokeTest'
}
Test-Case 'JAR/map archives and PE executable formats are supported without execution' {
    foreach ($extension in @('.jar', '.mcworld', '.mcpack', '.mctemplate')) {
        $archivePath = Join-Path $testDirectory ('release' + $extension)
        Copy-Item -LiteralPath $zip -Destination $archivePath
        $plan = New-FimelR2UploadPlan -FilePath $archivePath -WorkType mods -WorkId example -Version 1.21.11-v1.0
        Assert-True ($plan.Size -eq $size) 'Archive size changed'
        Assert-True ($plan.Key.Contains('/1.21.11-v1.0/')) 'Minecraft release folder was lost'
    }
    $executablePath = Join-Path $testDirectory 'header-only-test.exe'
    $peBytes = [byte[]]::new(68)
    $peBytes[0] = 0x4D; $peBytes[1] = 0x5A; $peBytes[60] = 64; $peBytes[64] = 0x50; $peBytes[65] = 0x45
    [IO.File]::WriteAllBytes($executablePath, $peBytes)
    $exePlan = New-FimelR2UploadPlan -FilePath $executablePath -WorkType tools -WorkId example -Version 1.0.2
    Assert-True ($exePlan.ContentType -eq 'application/octet-stream') 'Incorrect EXE download type'
    $invalidExe = Join-Path $testDirectory 'invalid.exe'
    Copy-Item -LiteralPath $zip -Destination $invalidExe
    Expect-Failure { New-FimelR2UploadPlan -FilePath $invalidExe -WorkType tools -WorkId example -Version 1.0.2 } 'header'
}
Test-Case 'existing file is rejected, even if its hash matches' {
    & $module { $script:Scenario = 'Existing' }
    Expect-Failure { Invoke-FimelR2Upload @parameters } 'already exists'
    Assert-True ((& $module { @($script:Calls | Where-Object { $_[0] -eq 'copyto' }).Count }) -eq 0) 'Existing object was uploaded'
}
Test-Case 'network/permission failure and invalid metadata fail closed' {
    foreach ($scenario in @('RootFailure', 'PermissionFailure', 'BadJson')) {
        & $module { param($scenario); $script:Scenario = $scenario } $scenario
        Expect-Failure { Invoke-FimelR2Upload @parameters } 'cancelled|metadata|list'
    }
    Assert-True ((& $module { @($script:Calls | Where-Object { $_[0] -eq 'copyto' }).Count }) -eq 0) 'Failure triggered upload'
}
Test-Case 'WhatIf performs reads only' {
    $result = Invoke-FimelR2Upload @parameters -WhatIf
    Assert-True (-not $result.Uploaded) 'Dry run reported success'
    Assert-True ((& $module { @($script:Calls | Where-Object { $_[0] -eq 'copyto' }).Count }) -eq 0) 'Dry run wrote a file'
}
Test-Case 'target appearing after confirmation cancels upload' {
    & $module { $script:Scenario = 'Appeared' }
    Expect-Failure { Invoke-FimelR2Upload @parameters } 'appeared'
}
Test-Case 'successful upload has progress, retries, multipart and immutable protections' {
    $result = Invoke-FimelR2Upload @parameters
    Assert-True ($result.Uploaded -and $result.Verification -eq 'size+MD5') 'Expected verified upload'
    Assert-True ($result.SHA256 -eq $sha256) 'Incorrect local SHA-256'
    $arguments = & $module { $script:Calls | Where-Object { $_[0] -eq 'copyto' } | ForEach-Object { ,$_ } }
    foreach ($flag in @('--progress', '--immutable', '--ignore-existing', '--checksum', '--retries', '--low-level-retries', '--s3-chunk-size', '--s3-upload-concurrency', '--s3-disable-checksum=false', '--metadata', 'content-disposition=attachment')) {
        Assert-True ($arguments -contains $flag) "Missing safety/upload flag: $flag"
    }
}
Test-Case 'missing object exit 4 can upload after bucket connectivity was checked' {
    & $module { $script:Scenario = 'NotFoundExit' }
    Assert-True ((Invoke-FimelR2Upload @parameters).Uploaded) 'Missing object was mistaken for failure'
}
Test-Case 'failed transfer never deletes or reports success' {
    & $module { $script:Scenario = 'UploadFailure' }
    Expect-Failure { Invoke-FimelR2Upload @parameters } 'Upload failed'
    Assert-True ((& $module { @($script:Calls | Where-Object { $_[0] -match 'delete|purge|sync|move|cleanup' }).Count }) -eq 0) 'Destructive command was attempted'
}
Test-Case 'incorrect size and MD5 reject success URL' {
    foreach ($scenario in @('WrongSize', 'WrongMd5')) {
        & $module { param($scenario); $script:Scenario = $scenario; $script:StatCount = 0 } $scenario
        Expect-Failure { Invoke-FimelR2Upload @parameters } 'verification failed|mismatch'
    }
}
Test-Case 'missing MD5 falls back to full streamed SHA-256 verification' {
    & $module { $script:Scenario = 'NoHash' }
    Assert-True ((Invoke-FimelR2Upload @parameters).Verification -eq 'size+SHA256-download') 'Expected readback fallback'
}
Test-Case 'optional full verification and incorrect SHA-256' {
    Assert-True ((Invoke-FimelR2Upload @parameters -FullVerification).Verification -eq 'size+SHA256-download') 'Full verification not used'
    & $module { $script:Scenario = 'WrongSha256'; $script:StatCount = 0 }
    Expect-Failure { Invoke-FimelR2Upload @parameters -FullVerification } 'SHA-256 mismatch'
}
Write-Host "$script:passed offline R2 upload tests passed. No remote writes or credential access."
