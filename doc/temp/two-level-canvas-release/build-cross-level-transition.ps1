Add-Type -AssemblyName System.Drawing

$sourceRoot = 'C:\Users\13067\River\projectWorkPlace\odysseyDesign\odyssey-architecture\doc\samples\two-level-canvas\assets'
$outputPath = 'C:\Users\13067\River\projectWorkPlace\odyssey\doc\temp\two-level-canvas-release\cross-level-transition.png'

$journey = [System.Drawing.Image]::FromFile((Join-Path $sourceRoot 'journey-canvas.png'))
$workflow = [System.Drawing.Image]::FromFile((Join-Path $sourceRoot 'agent-workflow-canvas.png'))
$canvas = New-Object System.Drawing.Bitmap 1200,440
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.Clear([System.Drawing.Color]::FromArgb(248,250,255))

$border = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(74,111,245)),3
$arrow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(74,111,245)),5
$arrow.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 6,7
$badgeFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(74,111,245))
$badgeText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$font = [System.Drawing.Font]::new('Arial',18,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)

function Draw-Crop($image, $sourceRect, $targetRect, $number) {
    $graphics.DrawImage($image, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawRectangle($border, $targetRect)
    $badgeRect = New-Object System.Drawing.RectangleF ($targetRect.X + 12),($targetRect.Y + 12),38,38
    $graphics.FillEllipse($badgeFill, $badgeRect)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString([string]$number, $font, $badgeText, $badgeRect, $format)
    $format.Dispose()
}

Draw-Crop $journey (New-Object System.Drawing.Rectangle 748,267,378,255) (New-Object System.Drawing.Rectangle 30,70,300,260) 1
Draw-Crop $journey (New-Object System.Drawing.Rectangle 1135,675,245,178) (New-Object System.Drawing.Rectangle 450,105,270,196) 2
Draw-Crop $workflow (New-Object System.Drawing.Rectangle 225,88,1178,790) (New-Object System.Drawing.Rectangle 840,50,330,330) 3

$graphics.DrawLine($arrow,350,200,425,200)
$graphics.DrawLine($arrow,740,200,815,200)

$canvas.Save($outputPath,[System.Drawing.Imaging.ImageFormat]::Png)

$font.Dispose()
$badgeText.Dispose()
$badgeFill.Dispose()
$arrow.Dispose()
$border.Dispose()
$graphics.Dispose()
$canvas.Dispose()
$workflow.Dispose()
$journey.Dispose()
