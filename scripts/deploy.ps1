# Deploy changed source files to Pi and rebuild
$PI = "sarapriyain@192.168.0.64"
$REMOTE = "/home/sarapriyain/Projects/CRM/splendid_CRM"

$files = @(
  # Core lib
  "src/lib/db.ts",
  "src/lib/types.ts",
  "src/lib/prospect-scorer.ts",
  "src/lib/linkedin.ts",
  "src/lib/sic-codes.ts",
  "src/lib/eng-scorer.ts",

  # App pages
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/(app)/layout.tsx",
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/leads/page.tsx",
  "src/app/(app)/leads/[id]/page.tsx",
  "src/app/(app)/leads/new/page.tsx",
  "src/app/(app)/pipeline/page.tsx",
  "src/app/(app)/prospects/page.tsx",
  "src/app/(app)/prospect-finder/page.tsx",
  "src/app/(app)/linkedin/page.tsx",
  "src/app/(app)/settings/page.tsx",

  # Components
  "src/components/Sidebar.tsx",

  # API routes — leads
  "src/app/api/leads/route.ts",
  "src/app/api/leads/[id]/route.ts",

  # API routes — CH
  "src/app/api/ch/check-website/route.ts",
  "src/app/api/ch/existing-companies/route.ts",
  "src/app/api/ch/guess-email/route.ts",
  "src/app/api/ch/new-companies/route.ts",
  "src/app/api/ch/officers/route.ts",
  "src/app/api/ch/scrape-email/route.ts",
  "src/app/api/ch/scrape-company/route.ts",

  # API routes — LinkedIn
  "src/app/api/linkedin/connect/route.ts",
  "src/app/api/linkedin/callback/route.ts",
  "src/app/api/linkedin/disconnect/route.ts",
  "src/app/api/linkedin/status/route.ts",
  "src/app/api/linkedin/forms/route.ts",
  "src/app/api/linkedin/sync/route.ts"
)

Write-Host "Deploying files..." -ForegroundColor Cyan
foreach ($file in $files) {
  if (Test-Path -LiteralPath $file) {
    $dest = "$PI`:$REMOTE/$($file -replace '\\','/')"
    Write-Host "  -> $file" -ForegroundColor Gray
    scp $file $dest
  } else {
    Write-Host "  SKIP (not found): $file" -ForegroundColor Yellow
  }
}

Write-Host "Building on Pi..." -ForegroundColor Cyan
ssh $PI "cd $REMOTE && npm run build && pm2 restart splendid-crm"
Write-Host "Done! CRM is live." -ForegroundColor Green
