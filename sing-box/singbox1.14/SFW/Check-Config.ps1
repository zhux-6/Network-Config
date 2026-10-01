param(
    [Parameter(Mandatory = $true)][string]$Core,
    [Parameter(Mandatory = $true)][string]$Config
)
$ErrorActionPreference = 'Stop'
$corePath = (Resolve-Path -LiteralPath $Core).Path
$configPath = (Resolve-Path -LiteralPath $Config).Path
$versionText = (& $corePath version | Out-String)
if ($LASTEXITCODE -ne 0 -or $versionText -notmatch '(?m)^sing-box version 1\.14\.2\s*$') {
    throw 'This check requires the official sing-box 1.14.2 core.'
}
$configData = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$nodes = @{}
foreach ($node in @($configData.outbounds) + @($configData.endpoints)) {
    if (-not $node.tag) { throw 'An outbound/endpoint is missing its tag.' }
    if ($nodes.ContainsKey($node.tag)) { throw "Duplicate tag: $($node.tag)" }
    $nodes[$node.tag] = $node
    if ($node.type -in @('selector', 'urltest') -and @($node.outbounds).Count -eq 0) {
        throw "Empty group: $($node.tag). Inject subscription nodes first."
    }
    if ($node.tag -eq 'COMPATIBLE' -and $node.type -eq 'direct') {
        throw 'The subscription script inserted COMPATIBLE/direct. Fix missing subscription groups instead of silently using direct access.'
    }
}
$states = @{}
function Test-OutboundGraph([string]$Tag) {
    if ($states[$Tag] -eq 1) { throw "Outbound loop detected at: $Tag" }
    if ($states[$Tag] -eq 2) { return }
    if (-not $nodes.ContainsKey($Tag)) { throw "Missing outbound/endpoint: $Tag" }
    $states[$Tag] = 1
    $node = $nodes[$Tag]
    $edges = @()
    if ($node.type -in @('selector', 'urltest')) { $edges += @($node.outbounds) }
    if ($node.detour) { $edges += $node.detour }
    foreach ($edge in $edges) { Test-OutboundGraph $edge }
    $states[$Tag] = 2
}
foreach ($tag in @($nodes.Keys)) { Test-OutboundGraph $tag }
& $corePath check -c $configPath
if ($LASTEXITCODE -ne 0) { throw 'sing-box check failed.' }
Write-Output 'PASS: 1.14.2 core check, populated groups, outbound references, and no outbound loops.'
Write-Output 'This does not start or test TUN, Bridge, remote DNS, or subscription servers.'
