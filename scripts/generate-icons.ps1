Add-Type -AssemblyName System.Drawing
$rootDir = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $rootDir 'src-tauri\icons'
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
}

$srcPath = 'C:\Users\athul\.gemini\antigravity-ide\brain\efd80307-1427-499c-8cf0-66dd01af4e72\splitit_app_icon_1791991835078.jpg'
if (Test-Path $srcPath) {
    $img = [System.Drawing.Image]::FromFile($srcPath)

    function Save-Resized-Png($image, $width, $height, $outPath) {
        $bmp = New-Object System.Drawing.Bitmap $width, $height
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($image, 0, 0, $width, $height)
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
    }

    # 32x32, 128x128, 256x256, 512x512
    Save-Resized-Png $img 32 32 (Join-Path $assetsDir '32x32.png')
    Save-Resized-Png $img 128 128 (Join-Path $assetsDir '128x128.png')
    Save-Resized-Png $img 256 256 (Join-Path $assetsDir '128x128@2x.png')
    Save-Resized-Png $img 512 512 (Join-Path $assetsDir 'icon.png')

    # 256x256 ICO
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

    Write-Output "Successfully generated Tauri icons in $assetsDir"
}
