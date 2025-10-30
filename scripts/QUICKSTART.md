# Quick Start Guide - Google Sheets JSON Sync

This is a condensed setup guide using the simplified JSON export approach. For detailed documentation, see [README.md](./README.md).

## ⚡ 3-Minute Setup

### Overview

Your Google Sheets export JSON directly via an Apps Script extension. This eliminates the need for Google API keys for data sync! Simply provide the JSON export URLs and you're done.

### Step 1: Get Your JSON Export URLs

Each of your Google Sheets should have an Apps Script extension that exports the sheet as JSON to a public URL.

You mentioned you already have this set up. The URLs should look something like:
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheet=board`
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheet=events`
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheet=staff`

Or they might be served from your own domain/hosting.

### Step 2: Update Configuration

Edit `scripts/sheets-config.json` and replace the placeholder URLs:

```json
{
  "sheets": {
    "board": {
      "jsonUrl": "https://your-actual-board-json-url-here",
      "outputPath": "data/board/members.yaml",
      "description": "Board members data"
    },
    "events": {
      "jsonUrl": "https://your-actual-events-json-url-here",
      "outputPath": "data/events/upcoming.yaml",
      "description": "Upcoming PTSA events"
    },
    "staff": {
      "jsonUrl": "https://your-actual-staff-json-url-here",
      "outputPath": "data/staff/favorites.yaml",
      "description": "Staff favorite things"
    }
  }
}
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Test Locally (Optional)

```bash
# Test data sync (no API key needed!)
npm run sync:data

# View the generated YAML files
cat data/board/members.yaml
cat data/events/upcoming.yaml
cat data/staff/favorites.yaml
```

### Step 5: Commit and Deploy

```bash
git add .
git commit -m "Configure Google Sheets JSON sync"
git push
```

## ✅ You're Done!

The workflow will now run:
- **Automatically**: Twice daily at 2 AM and 2 PM PT
- **Manually**: Actions tab → "Sync Data from Google Sheets" → Run workflow
- **Via Webhook**: Configure your Apps Script to trigger on sheet changes (optional)

## 📊 JSON Format Expected

Your Apps Script should export data as a JSON array of objects. Example:

**Board Members JSON:**
```json
[
  {
    "name": "John Doe",
    "position": "President",
    "email": "president@slptsa.org",
    "photo": "john-doe.jpg",
    "bio": "Champion of connection...",
    "elected": true,
    "election_date": "May 2024",
    "term": "2024-2025"
  },
  ...
]
```

**Events JSON:**
```json
[
  {
    "title": "PTSA Meeting",
    "date": "2025-10-30",
    "end_date": "",
    "time": "18:00-20:00",
    "location": "Library",
    "description": "Monthly meeting",
    "category": "meeting",
    "multi_day": false,
    "volunteers_needed": false,
    "volunteer_link": "",
    "zoom_meeting": true,
    "zoom_link": "https://zoom.us/..."
  },
  ...
]
```

## 🖼️ Image Handling (Optional)

### Option 1: Google Drive API (requires API key)

If you want to auto-download images from Google Drive:

1. Create Google API key (enable Drive API)
2. Add to GitHub Secrets as `GOOGLE_API_KEY`
3. Update `scripts/sheets-config.json`:
   ```json
   "images": {
     "board_photos": {
       "method": "drive",
       "folderId": "YOUR_DRIVE_FOLDER_ID",
       "outputPath": "static/img/board"
     }
   }
   ```

### Option 2: Direct Image URLs (no API key needed)

If you can provide direct download URLs for images:

Update `scripts/sheets-config.json`:
```json
"images": {
  "board_photos": {
    "method": "urls",
    "outputPath": "static/img/board",
    "imageUrls": [
      "https://example.com/images/john-doe.jpg",
      "https://example.com/images/jane-smith.jpg"
    ]
  }
}
```

### Option 3: Manual Upload

Just upload images to `static/img/board/` manually and skip image sync entirely.

## 🔔 Enable Webhook Triggers (Optional)

To trigger sync immediately when Google Sheets change:

1. In your Apps Script that exports JSON, add this function:
   ```javascript
   function onSheetChange(e) {
     const GITHUB_TOKEN = 'your_github_token_here';
     const REPO = 'username/repo-name';

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

2. Set up a trigger in Apps Script: On Edit or On Change

See `scripts/webhook-trigger.gs` for a complete example.

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "JSON URL not configured" | Update `sheets-config.json` with actual URLs |
| "Invalid JSON" | Check your Apps Script returns valid JSON |
| "HTTP 403/404" | Verify JSON URLs are publicly accessible |
| "No changes committed" | Normal if data hasn't changed |

## 📖 What Your Apps Script Should Do

Your Google Sheets Apps Script extension should:

1. **Read the sheet data** (all rows)
2. **Convert to JSON array** of objects
3. **Return as HTTP response** with `Content-Type: application/json`
4. **Handle CORS** if needed
5. **Be publicly accessible** (no authentication required)

Example Apps Script structure:
```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();

  // First row is headers
  const headers = data[0];
  const rows = data.slice(1);

  // Convert to array of objects
  const json = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return ContentService
    .createTextOutput(JSON.stringify(json))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 🎯 Advantages of This Approach

✅ **No API keys needed** for data sync (only for optional Drive images)
✅ **Simpler setup** - just configure URLs
✅ **More reliable** - no API quotas or rate limits to worry about
✅ **Faster** - direct JSON fetch vs. API calls
✅ **Flexible** - you control the JSON structure
✅ **Secure** - Apps Script can add authentication if needed

---

**Need help?** See the full [README.md](./README.md) for detailed documentation.
