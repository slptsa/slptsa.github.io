# 🎉 Google Sheets JSON Sync - Refactored & Ready!

## 📦 What Changed

The system has been **simplified** to use your existing JSON export URLs instead of the Google Sheets API!

### New Approach Benefits:
✅ **No API key required** for data sync
✅ **Simpler configuration** - just add your JSON URLs
✅ **Faster** - direct JSON fetch
✅ **More reliable** - no API quotas or rate limits
✅ **You're in control** - your Apps Script handles the JSON export

## 🚀 Quick Setup (3 Steps)

### Step 1: Add Your JSON URLs

Edit `scripts/sheets-config.json` and replace these placeholders with your actual JSON export URLs:

```json
{
  "sheets": {
    "board": {
      "jsonUrl": "PASTE_YOUR_BOARD_JSON_URL_HERE",
      ...
    },
    "events": {
      "jsonUrl": "PASTE_YOUR_EVENTS_JSON_URL_HERE",
      ...
    },
    "staff": {
      "jsonUrl": "PASTE_YOUR_STAFF_JSON_URL_HERE",
      ...
    }
  }
}
```

### Step 2: Test Locally (Optional)

```bash
# Install dependencies if you haven't
npm install

# Test the sync (no API key needed!)
npm run sync:data

# Check the output
cat data/board/members.yaml
```

### Step 3: Commit & Deploy

```bash
git add .
git commit -m "Configure JSON URLs for Google Sheets sync"
git push
```

## ✅ That's It!

The workflow will now:
- Run **twice daily** (2 AM and 2 PM PT)
- Fetch JSON from your URLs
- Convert to YAML
- Commit changes
- Trigger Hugo rebuild

## 📊 JSON Format Expected

Your Apps Script should return an array of objects. Example:

```json
[
  {
    "name": "John Doe",
    "position": "President",
    "email": "president@slptsa.org",
    "photo": "john-doe.jpg",
    "bio": "Board member bio...",
    "elected": true,
    "election_date": "May 2024",
    "term": "2024-2025"
  },
  ...
]
```

The sync script will:
1. Fetch the JSON
2. Normalize the data (trim strings, handle booleans)
3. Convert to YAML
4. Save to `data/` directory

## 🖼️ Image Handling (Optional)

You have three options:

### Option 1: Manual Upload
Upload images to `static/img/board/` manually (simplest)

### Option 2: Google Drive Sync
If you want to auto-sync from Google Drive:
1. Create Google API key (enable Drive API)
2. Add as GitHub secret: `GOOGLE_API_KEY`
3. Update config with folder ID

### Option 3: Direct URLs
Provide direct image download URLs in the config

**For now, you can skip image sync** and manually upload photos.

## 🔔 Webhook Integration (Optional)

To trigger sync when sheets change, add this to your Apps Script:

```javascript
function onSheetChange(e) {
  const GITHUB_TOKEN = 'your_github_personal_access_token';
  const REPO = 'your-username/serene-lake-ptsa';

  UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    payload: JSON.stringify({
      event_type: 'sheets-updated'
    })
  });
}
```

Then set up an "On Edit" or "On Change" trigger in Apps Script.

## 📁 Project Structure

```
scripts/
├── sync-data.js           # Fetches JSON → converts to YAML
├── download-images.js     # Downloads and optimizes images
├── sheets-config.json     # Configuration (URLs, paths)
├── QUICKSTART.md          # Quick setup guide
├── README.md              # Full documentation
└── webhook-trigger.gs     # Optional webhook setup

.github/workflows/
└── sync-data.yml          # GitHub Actions workflow
```

## 🎯 How It Works

```
Google Sheets
     ↓
Apps Script Extension (you built this!)
     ↓
JSON Export URL
     ↓
GitHub Actions (scheduled or webhook)
     ↓
sync-data.js script
     ↓
YAML files (data/board/, data/events/, data/staff/)
     ↓
Hugo Build
     ↓
Website Updated!
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "JSON URL not configured" | Add your actual URLs to `sheets-config.json` |
| "Invalid JSON" | Test your JSON URL in a browser - should return valid JSON |
| "HTTP 403/404" | Make sure JSON URLs are publicly accessible |
| "No changes committed" | Normal - data hasn't changed |

## 📖 Documentation

- **Quick Start**: `scripts/QUICKSTART.md` (3-minute setup)
- **Full Docs**: `scripts/README.md` (comprehensive guide)
- **This File**: Current status and next steps

## 🔄 Next Steps

1. **Add your JSON URLs** to `scripts/sheets-config.json`
2. **Test locally**: `npm run sync:data`
3. **Commit and push**
4. **Verify** in GitHub Actions tab
5. **(Optional)** Set up webhook for instant updates
6. **(Optional)** Configure image sync

## 💡 Tips

- Test each JSON URL in your browser first to verify it works
- Make sure your Apps Script is deployed and publicly accessible
- The sync script normalizes booleans automatically ("true"/"false", "yes"/"no", etc.)
- Empty values become empty strings in YAML
- Dates should be in YYYY-MM-DD format for events

## 🎉 What This Enables

✅ Board members update Google Sheets (familiar interface)
✅ Automatic sync twice daily
✅ Manual trigger available for immediate updates
✅ Optional webhook for instant sync on sheet changes
✅ Version control of all content changes
✅ No API quotas to worry about

---

**Ready?** Add your JSON URLs and push! See `scripts/QUICKSTART.md` for step-by-step instructions.
