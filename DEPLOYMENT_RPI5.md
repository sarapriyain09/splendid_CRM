# Raspberry Pi 5 CRM Deployment Notes

Date: 2026-06-08

## Target Environment
- Host: sarapriyain@192.168.0.64
- Device: Splendid-R1 (Raspberry Pi 5)
- App path: ~/Projects/CRM/splendid_CRM_git
- Public domain: crm.splendidtechnology.co.uk (Cloudflare)

## Pre-Work Checklist
1. Confirm local code state and files to deploy.
2. Confirm remote path exists and is writable.
3. Check PM2 process status before any restart.

## Core Remote Commands
```bash
ssh sarapriyain@192.168.0.64 "cd ~/Projects/CRM/splendid_CRM_git && pm2 status"
ssh sarapriyain@192.168.0.64 "cd ~/Projects/CRM/splendid_CRM_git && pm2 logs --lines 100"
```

## Deployment/Synchronization Options
### Option A: Git pull on Raspberry Pi
```bash
ssh sarapriyain@192.168.0.64 "cd ~/Projects/CRM/splendid_CRM_git && git pull"
```

### Option B: File copy from local machine
Use deploy script or copy selected files to:
- ~/Projects/CRM/splendid_CRM_git

## PM2 App Verification
```bash
ssh sarapriyain@192.168.0.64 "pm2 status"
ssh sarapriyain@192.168.0.64 "pm2 describe splendid-crm"
```

## Notes
- Keep node_modules and .next out of manual file copy unless required.
- After updates, rebuild/restart app process in PM2 if needed.

## Session Log (2026-06-08)
- Verified PM2 before deployment: `splendid-crm` was `online` with uptime around 34h.
- Deployed these files from local workspace:
	- `src/app/globals.css`
	- `src/app/(app)/layout.tsx`
	- `src/app/login/page.tsx`
	- `src/components/Sidebar.tsx`
- Ran remote build successfully in `~/Projects/CRM/splendid_CRM_git` (`next build` passed).
- Restarted PM2 process: `pm2 restart splendid-crm`.
- Verified PM2 after deployment: `splendid-crm` is `online` (new PID, restart count incremented).
