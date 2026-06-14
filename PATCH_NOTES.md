# Evolve v3.31 privacy/data-safety polish — rebuilt package

Changes applied from the review list:

1. Removed Google Fonts from the runtime and preview build. The app now uses local system font stacks only, with no external font request.
2. Changed Reset all data so it removes only Evolve storage keys: `evolve_v1`, `evolve_profile_photo_v1`, `evolve_progress_photos_v1`, and `evolve_live_v1`. It no longer uses a global storage-wipe call.
3. Aligned version metadata: `manifest.json` is `3.31`; service-worker cache is `evolve-v3-31-finalfix3`.
4. Removed old Google Drive OAuth metadata from default data and migration; backup cleanup still strips any old keys from older users.
5. Fixed CSV save/share messages so CSV exports no longer say “Backup shared/saved”.
6. Added stronger restore validation before imported/encrypted backup data is merged with defaults.
7. Tightened backup-code wording to say plain codes are not encrypted.
8. Tightened backup-reminder wording so it says Evolve checks when the app opens/returns, not true background scheduling.
9. Removed the viewport zoom lock for accessibility.
10. Regenerated the single-file preview and combined source snapshot from the current runtime files.
11. Rebuilt and verified the complete ZIP package contents.

Checks run:

- `node --check app.js`
- `node --check data.js`
- `node --check sw.js`
- `python3 -m json.tool manifest.json`
- Static scan confirmed no external hosted-font URLs, old hosted display-font references, or global storage-wipe calls remain in the runtime files or preview build.
- Static check confirmed the service-worker shell files exist.

Still needs real-device testing:

- iPhone Safari/PWA install and update refresh.
- Android Chrome/PWA install and update refresh.
- Encrypted backup save/share sheet on iOS and Android.
- Restore encrypted backup with correct password and verify wrong password fails.
- Test notification permission and Send test notification on installed PWAs.
- Visual review of the new local font stack, because it will look slightly different from the previous hosted-font styling.
