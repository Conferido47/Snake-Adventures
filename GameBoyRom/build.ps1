param(
    [string]$GbdkHome = $env:GBDK_HOME
)

$ErrorActionPreference = 'Stop'
$gbdkVersion = '4.5.0'
$gbdkSha256 = '266854ce92e3064871c5b28cd3436cc2a6cb136af9e7cf617140108f8c1c5890'
$projectRoot = $PSScriptRoot
$buildRoot = Join-Path $projectRoot 'build'

if ([string]::IsNullOrWhiteSpace($GbdkHome)) {
    $toolRoot = Join-Path $env:LOCALAPPDATA "SnakeAdventuresGB\gbdk-$gbdkVersion"
    $GbdkHome = Join-Path $toolRoot 'gbdk'
    $lcc = Join-Path $GbdkHome 'bin\lcc.exe'

    if (!(Test-Path -LiteralPath $lcc)) {
        New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
        $archive = Join-Path $toolRoot 'gbdk-win64.zip'
        & curl.exe -L --fail --output $archive "https://github.com/gbdk-2020/gbdk-2020/releases/download/$gbdkVersion/gbdk-win64.zip"
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to download GBDK $gbdkVersion."
        }

        $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
        if ($actualHash -ne $gbdkSha256) {
            throw "GBDK checksum mismatch. Expected $gbdkSha256 but received $actualHash."
        }

        & tar.exe -xf $archive -C $toolRoot
        if ($LASTEXITCODE -ne 0) {
            throw 'Unable to extract GBDK.'
        }
    }
}

$lcc = Join-Path $GbdkHome 'bin\lcc.exe'
if (!(Test-Path -LiteralPath $lcc)) {
    throw "GBDK lcc was not found at $lcc. Set GBDK_HOME to the extracted GBDK folder."
}

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
Push-Location -LiteralPath $projectRoot
try {
    & $lcc `
        '-Wm-yC' `
        '-Wm-yj' `
        '-Wm-yS' `
        '-Wm-ynSNAKEADV' `
        '-Wl-yt0x1B' `
        '-Wm-ya1' `
        '-Wm-yo4' `
        '-Wl-m' `
        '-Wl-j' `
        '-Isrc' `
        '-o' 'build\SnakeAdventures.gb' `
        'src\main.c' `
        'src\game.c' `
        'src\render.c' `
        'src\audio.c' `
        'src\assets.c'

    if ($LASTEXITCODE -ne 0) {
        throw "GBDK build failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$rom = Join-Path $buildRoot 'SnakeAdventures.gb'
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $rom).Hash.ToLowerInvariant()
Write-Host "Built $rom"
Write-Host "SHA-256 $hash"
