# Google Sheets to YAML Data Sync

This directory contains scripts to automatically sync data from Google Sheets to YAML files for the Hugo website.

## 📋 Overview

The sync system fetches data from Google Sheets and Google Drive, converting it to YAML format and downloading images for use in the static site. This allows non-technical board members to update website content through familiar Google Sheets.

## 🏗️ Architecture

```
Google Sheets → GitHub Actions → Node.js Scripts → YAML Files → Hugo Site
                     ↓
Google Drive   → Download Images → static/img/
```

## 📦 Components

### Scripts

- **`sync-data.js`** - Fetches data from Google Sheets and converts to YAML
- **`download-images.js`** - Downloads and optimizes images from Google Drive
- **`sheets-config.json`** - Configuration file with Sheet IDs and field mappings

### GitHub Actions Workflow

- **`.github/workflows/sync-data.yml`** - Automated sync workflow
  - Runs twice daily (2 AM and 2 PM PT)
  - Can be triggered manually
  - Can be triggered by webhook from Google Sheets
  - Commits changes and triggers Hugo rebuild

## 🚀 Setup Instructions

### Step 1: Create Google Cloud Project & API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the following APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Create an API Key:
   - Navigate to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Copy the API key (you'll need it later)
   - (Optional but recommended) Restrict the API key to only Sheets and Drive APIs

### Step 2: Configure Google Sheets

Each Google Sheet should have:

1. **First row as headers** - Column names matching field names in config
2. **Proper permissions** - Set to "Anyone with the link can view" OR share with your Google account
3. **Consistent data types** - Boolean values should be "true"/"false" or "yes"/"no"

#### Board Members Sheet Structure

| name | position | email | photo | bio | elected | election_date | term |
|------|----------|-------|-------|-----|---------|---------------|------|
| John Doe | President | president@... | john-doe.jpg | Bio text... | true | May 2024 | 2024-2025 |

#### Events Sheet Structure

| title | date | end_date | time | location | description | category | multi_day | volunteers_needed | volunteer_link | zoom_meeting | zoom_link |
|-------|------|----------|------|----------|-------------|----------|-----------|-------------------|----------------|--------------|-----------|
| PTSA Meeting | 2025-10-30 | | 18:00-20:00 | Library | Monthly meeting | meeting | false | false | | true | https://zoom.us/... |

#### Staff Favorites Sheet Structure

| name | amazon_link | favorite_snacks | favorite_restaurants | favorite_beverages | favorite_stores | favorite_colors | favorite_flowers | hobbies | favorite_things | classroom_needs | appreciation |
|------|-------------|-----------------|---------------------|-------------------|----------------|----------------|-----------------|---------|----------------|----------------|--------------|
| Jane Smith | https://... | Chocolate | Chipotle | Coffee | Target | Blue | Roses | Reading | Books | Pencils | Notes |

### Step 3: Get Sheet IDs and Folder IDs

#### Getting Google Sheet IDs

1. Open the Google Sheet
2. Look at the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
3. Copy the `{SHEET_ID}` portion

#### Getting Google Drive Folder IDs

1. Open the Google Drive folder
2. Look at the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
3. Copy the `{FOLDER_ID}` portion

### Step 4: Update Configuration

Edit `scripts/sheets-config.json` and replace the placeholder values:

```json
{
  "sheets": {
    "board": {
      "sheetId": "YOUR_ACTUAL_BOARD_SHEET_ID_HERE",
      ...
    },
    "events": {
      "sheetId": "YOUR_ACTUAL_EVENTS_SHEET_ID_HERE",
      ...
    },
    "staff": {
      "sheetId": "YOUR_ACTUAL_STAFF_SHEET_ID_HERE",
      ...
    }
  },
  "drive": {
    "board_photos": {
      "folderId": "YOUR_ACTUAL_FOLDER_ID_HERE",
      ...
    }
  }
}
```

### Step 5: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add the following secret:
   - Name: `GOOGLE_API_KEY`
   - Value: (paste your API key from Step 1)

### Step 6: Install Dependencies

```bash
npm install
```

This installs:
- `googleapis` - Google APIs client
- `yaml` - YAML parser/stringifier
- `sharp` - Image optimization

### Step 7: Test Locally (Optional)

Before running in GitHub Actions, test locally:

```bash
# Set your API key
export GOOGLE_API_KEY="your-api-key-here"

# Test data sync
npm run sync:data

# Test image download
npm run sync:images

# Or run both
npm run sync:all
```

### Step 8: Deploy

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Add Google Sheets sync automation"
   git push
   ```

2. The workflow will run automatically:
   - Twice daily at 2 AM and 2 PM PT
   - Or trigger manually from the Actions tab

## 🔧 Usage

### Manual Trigger via GitHub Actions

1. Go to **Actions** tab in GitHub
2. Select **"Sync Data from Google Sheets"** workflow
3. Click **"Run workflow"**
4. Select branch and click **"Run workflow"**

### Manual Trigger via Command Line

```bash
# Sync all data
npm run sync:data

# Sync specific sheet
node scripts/sync-data.js board
node scripts/sync-data.js events
node scripts/sync-data.js staff

# Download all images
npm run sync:images

# Download specific folder
node scripts/download-images.js board_photos
```

## 🔔 Notifications

### Success Notifications

When sync completes successfully:
- Workflow logs show success message
- If changes were detected, they're committed and pushed
- Hugo build workflow is triggered automatically

### Failure Notifications

When sync fails:
- Workflow fails and shows error in logs
- GitHub issue is automatically created with details
- Email notification sent to repository watchers (if enabled)

### Adding Custom Notifications

Edit `.github/workflows/sync-data.yml` and add notification steps:

```yaml
# Example: Slack notification
- name: Notify Slack
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"❌ Data sync failed!"}' \
      ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 🔗 Webhook Integration (Advanced)

To enable instant updates when Google Sheets change, you can set up a webhook using Google Apps Script.

### Google Apps Script

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Replace the code with the script from `webhook-trigger.gs` (see below)
4. Update `GITHUB_TOKEN` and `REPO` in the script
5. Set up a trigger: **Triggers → Add Trigger → On change**

### Creating GitHub Personal Access Token

1. Go to **GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Select scopes: `repo` (full control of private repositories)
4. Copy the token and add to Apps Script

### Apps Script Code

Create `scripts/webhook-trigger.gs`:

```javascript
function onSheetChange(e) {
  const GITHUB_TOKEN = 'your_github_token_here';
  const REPO = 'username/repo-name';

  const url = `https://api.github.com/repos/${REPO}/dispatches`;

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      event_type: 'sheets-updated',
      client_payload: {
        sheet: e.source.getName(),
        timestamp: new Date().toISOString()
      }
    })
  };

  try {
    UrlFetchApp.fetch(url, options);
    console.log('✅ Triggered GitHub Actions workflow');
  } catch (error) {
    console.error('❌ Failed to trigger workflow:', error);
  }
}
```

## 🐛 Troubleshooting

### "GOOGLE_API_KEY environment variable not set"

**Solution**: Ensure the `GOOGLE_API_KEY` secret is set in GitHub repository settings.

### "Failed to fetch sheet data: 403 Forbidden"

**Solution**:
- Verify API key has access to Sheets API
- Check sheet permissions (should be viewable)
- Ensure sheet ID is correct

### "No data found in sheet"

**Solution**:
- Verify sheet has data in rows below header
- Check the `range` setting in config matches your sheet structure

### "Error downloading image: 404"

**Solution**:
- Verify Drive folder ID is correct
- Check folder permissions (should be viewable)
- Ensure API key has access to Drive API

### Sync runs but no changes committed

This is normal if the data hasn't changed. The workflow only commits when changes are detected.

## 📝 Maintenance

### Updating Sheet Structure

If you add/remove columns:

1. Update `scripts/sheets-config.json` with new fields
2. Update corresponding YAML data structure in Hugo templates
3. Test locally before pushing

### Adding New Sheets

1. Add new sheet configuration to `sheets-config.json`
2. Create output directory (e.g., `data/sponsors/`)
3. Test sync locally
4. Update Hugo templates to use new data

## 📚 Additional Resources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Hugo Data Templates](https://gohugo.io/templates/data-templates/)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review workflow logs in GitHub Actions
3. Open an issue in the repository
