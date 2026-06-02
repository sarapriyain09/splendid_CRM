# Deploy changed source files to Pi and rebuild
$PI = "sarapriyain@192.168.0.64"
$REMOTE = "/home/sarapriyain/Projects/CRM/splendid_CRM"

$files = @(
  "src/app/(app)/leads/page.tsx",
  "src/app/(app)/leads/[id]/page.tsx",
  "src/app/(app)/pipeline/page.tsx",
  "src/app/(app)/prospects/page.tsx",
  "src/app/(app)/prospect-finder/page.tsx",
  "src/app/api/leads/route.ts",
  "src/app/api/prospect-finder/search/route.ts",
  "src/lib/db.ts",
  "src/lib/types.ts",
  "src/lib/prospect-scorer.ts"
)

Write-Host "Deploying files..." -ForegroundColor Cyan
foreach ($file in $files) {
  if (Test-Path $file) {
    $dest = "$PI`:$REMOTE/$($file -replace '\\','/')"
    Write-Host "  -> $file" -ForegroundColor Gray
    scp $file $dest
  }
}

Write-Host "Building on Pi..." -ForegroundColor Cyan
ssh $PI "cd $REMOTE && npm run build && pm2 restart splendid-crm"
Write-Host "Done! CRM is live." -ForegroundColor Green
