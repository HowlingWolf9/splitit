Add-Type -AssemblyName System.Drawing
$rootDir = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $rootDir 'electron\assets'
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
}

$srcPath = 'C:\Users\athul\.gemini\antigravity-ide\brain\efd80307-1427-499c-8cf0-66dd01af4e72\splitit_app_icon_1791991835078.jpg'
$img = [System.Drawing.Image]::FromFile($srcPath)

# 1. Save 512x512 PNG
$bmp512 = New-Object System.Drawing.Bitmap 512, 512
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.DrawImage($img, 0, 0, 512, 512)
$pngPath = Join-Path $assetsDir 'icon.png'
$bmp512.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g512.Dispose()
$bmp512.Dispose()

# 2. Save 256x256 ICO
$bmp256 = New-Object System.Drawing.Bitmap 256, 256
$g256 = [System.Drawing.Graphics]::FromImage($bmp256)
$g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g256.DrawImage($img, 0, 0, 256, 256)
$hIcon = $bmp256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = Join-Path $assetsDir 'icon.ico'
$fs = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$g256.Dispose()
$bmp256.Dispose()
$img.Dispose()

Write-Output "Successfully generated: $pngPath and $icoPath"
