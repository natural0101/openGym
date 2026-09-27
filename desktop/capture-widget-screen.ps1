# Test helper: real screen pixels, never PrintWindow or Chromium capturePage.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$rect = $env:GYM_CAPTURE_RECT.Split(',') | ForEach-Object { [int]$_ }
$bitmap = [Drawing.Bitmap]::new($rect[2], $rect[3])
$graphics = [Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($rect[0], $rect[1], 0, 0, $bitmap.Size)
  $bitmap.Save($env:GYM_CAPTURE_PATH, [Drawing.Imaging.ImageFormat]::Png)
  $violet = 0; $yellow = 0; $samples = 0
  for ($y = 0; $y -lt $bitmap.Height; $y += 3) {
    for ($x = 0; $x -lt $bitmap.Width; $x += 3) {
      $pixel = $bitmap.GetPixel($x, $y); $samples++
      if ([Math]::Abs($pixel.R - 198) -lt 8 -and [Math]::Abs($pixel.G - 178) -lt 8 -and [Math]::Abs($pixel.B - 255) -lt 8) { $violet++ }
      if ([Math]::Abs($pixel.R - 255) -lt 8 -and [Math]::Abs($pixel.G - 220) -lt 8 -and [Math]::Abs($pixel.B - 66) -lt 8) { $yellow++ }
    }
  }
  @{violetFraction=$violet/$samples;yellowFraction=$yellow/$samples} | ConvertTo-Json -Compress
} finally { $graphics.Dispose(); $bitmap.Dispose() }
