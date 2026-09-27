# Compare actual screen pixels outside the native contour with the hidden widget.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class GymContourCheck {
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr region,int x,int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr value);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr window,IntPtr region);
}
'@
$before = [Drawing.Bitmap]::new($env:GYM_BEFORE_PATH)
$after = [Drawing.Bitmap]::new($env:GYM_AFTER_PATH)
$region = [GymContourCheck]::CreateRectRgn(0,0,0,0)
try {
  $kind = [GymContourCheck]::GetWindowRgn([IntPtr]::new([long]$env:GYM_WIDGET_HANDLE), $region)
  if ($kind -eq 0) { throw 'No native window contour' }
  $padding = [int]$env:GYM_CAPTURE_PADDING
  $checked = 0; $changed = 0
  # This desktop has animated tiles in its lower area. Compare the static upper
  # area; retain the complete surrounding screenshot for visual inspection.
  $compareHeight = [int][Math]::Floor($after.Height * 0.65)
  for ($y = 0; $y -lt $compareHeight; $y += 2) {
    for ($x = 0; $x -lt $after.Width; $x += 2) {
      if ([GymContourCheck]::PtInRegion($region, $x-$padding, $y-$padding)) { continue }
      $checked++
      if ($before.GetPixel($x,$y).ToArgb() -ne $after.GetPixel($x,$y).ToArgb()) { $changed++ }
    }
  }
  @{comparedTopFraction=0.65;outsideSamples=$checked;changedOutside=$changed;changedFraction=$changed/[Math]::Max(1,$checked)} | ConvertTo-Json -Compress
} finally { [void][GymContourCheck]::DeleteObject($region); $before.Dispose(); $after.Dispose() }
