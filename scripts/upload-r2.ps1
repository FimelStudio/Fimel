#requires -Version 5.1
<#
.SYNOPSIS
Uploads a new release file to Fimel R2. Never replaces or deletes an existing object.
.EXAMPLE
.\scripts\upload-r2.ps1 -FilePath 'D:\Releases\my-map.zip' -WorkType java -WorkId my-map -Version 1.0.0 -WhatIf
.EXAMPLE
.\scripts\upload-r2.ps1 -FilePath 'D:\Releases\my-map.zip' -WorkType java -WorkId my-map -Version 1.0.0
#>
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

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'R2Upload.psm1') -Force
# Forward WhatIf/Confirm to the implementation, which confirms after preflight.
Invoke-FimelR2Upload @PSBoundParameters
