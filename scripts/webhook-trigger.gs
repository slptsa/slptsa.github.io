/**
 * Google Apps Script - Webhook Trigger for GitHub Actions
 *
 * This script triggers the GitHub Actions workflow whenever the Google Sheet is edited.
 * This enables instant updates instead of waiting for the scheduled sync.
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this script
 * 4. Update the configuration variables below:
 *    - GITHUB_TOKEN: Your GitHub Personal Access Token
 *    - REPO_OWNER: Your GitHub username or organization
 *    - REPO_NAME: Your repository name
 * 5. Save the script (Ctrl+S or Cmd+S)
 * 6. Set up a trigger:
 *    - Click the clock icon (Triggers)
 *    - Click "Add Trigger"
 *    - Choose function: onEdit or onChange
 *    - Event type: "On edit" or "On change"
 *    - Save
 *
 * CREATING A GITHUB PERSONAL ACCESS TOKEN:
 *
 * 1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
 * 2. Click "Generate new token (classic)"
 * 3. Give it a descriptive name (e.g., "PTSA Sheets Webhook")
 * 4. Select scopes:
 *    - repo (Full control of private repositories)
 * 5. Click "Generate token"
 * 6. Copy the token and paste it in the GITHUB_TOKEN variable below
 *
 * SECURITY NOTE:
 * Store the token as a Script Property instead of hardcoding it:
 * 1. In Apps Script, go to Project Settings (gear icon)
 * 2. Scroll to "Script Properties"
 * 3. Add property: GITHUB_TOKEN = your_token
 * 4. Use: PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')
 */

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

// OPTION 1: Hardcode token (less secure, easier)
const GITHUB_TOKEN = 'ghp_your_token_here';

// OPTION 2: Use Script Properties (more secure, recommended)
// const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');

const REPO_OWNER = 'your-github-username';  // e.g., 'john-doe'
const REPO_NAME = 'serene-lake-ptsa';       // Repository name

// ============================================================================
// Trigger Functions
// ============================================================================

/**
 * Triggered when a cell is edited in the sheet
 * Use this for immediate updates on every edit
 */
function onEdit(e) {
  // Optional: Only trigger for specific sheets or ranges
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // Uncomment to limit triggers to specific sheets:
  // if (!['Board Members', 'Events', 'Staff Favorites'].includes(sheetName)) {
  //   return;
  // }

  Logger.log(`📝 Sheet edited: ${sheetName}`);
  triggerGitHubAction('edit', sheetName);
}

/**
 * Triggered when the sheet structure changes (rows/columns added, etc.)
 * Use this for less frequent triggers
 */
function onChange(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  Logger.log(`🔄 Sheet changed: ${sheetName}`);
  triggerGitHubAction('change', sheetName);
}

/**
 * Manual trigger function - useful for testing
 * Run this from the Apps Script editor to test the webhook
 */
function manualTrigger() {
  Logger.log('🧪 Manual trigger test');
  triggerGitHubAction('manual', 'Test');
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Trigger the GitHub Actions workflow via repository_dispatch
 */
function triggerGitHubAction(eventType, sheetName) {
  // Validate configuration
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'ghp_your_token_here') {
    Logger.log('❌ Error: GITHUB_TOKEN not configured');
    return;
  }

  if (!REPO_OWNER || REPO_OWNER === 'your-github-username') {
    Logger.log('❌ Error: REPO_OWNER not configured');
    return;
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;

  const payload = {
    event_type: 'sheets-updated',
    client_payload: {
      sheet: sheetName,
      trigger_type: eventType,
      timestamp: new Date().toISOString(),
      editor: Session.getActiveUser().getEmail() || 'unknown'
    }
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Google-Apps-Script'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 204) {
      Logger.log('✅ Successfully triggered GitHub Actions workflow');
      Logger.log(`   Sheet: ${sheetName}`);
      Logger.log(`   Event: ${eventType}`);
    } else {
      Logger.log(`⚠️  Unexpected response code: ${responseCode}`);
      Logger.log(`   Response: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log('❌ Failed to trigger GitHub Actions workflow');
    Logger.log(`   Error: ${error.message}`);

    // Optional: Send email notification on failure
    // MailApp.sendEmail({
    //   to: 'your-email@example.com',
    //   subject: 'Google Sheets Webhook Failed',
    //   body: `Failed to trigger GitHub Actions workflow:\n\n${error.message}`
    // });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Test the GitHub API connection
 * Run this to verify your token and configuration
 */
function testConnection() {
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'ghp_your_token_here') {
    Logger.log('❌ Error: GITHUB_TOKEN not configured');
    return;
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Google-Apps-Script'
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const repo = JSON.parse(response.getContentText());
      Logger.log('✅ Connection successful!');
      Logger.log(`   Repository: ${repo.full_name}`);
      Logger.log(`   Default branch: ${repo.default_branch}`);
      Logger.log(`   Private: ${repo.private}`);
    } else {
      Logger.log(`❌ Connection failed: ${responseCode}`);
      Logger.log(`   Response: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log('❌ Connection test failed');
    Logger.log(`   Error: ${error.message}`);
  }
}

/**
 * Create a menu in Google Sheets for easy access
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 GitHub Sync')
      .addItem('Trigger Sync Now', 'manualTrigger')
      .addItem('Test Connection', 'testConnection')
      .addSeparator()
      .addItem('View Logs', 'viewLogs')
      .addToUi();
}

/**
 * Open the Apps Script logs
 */
function viewLogs() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'View Logs',
    'To view logs:\n\n' +
    '1. Go to Extensions → Apps Script\n' +
    '2. Click "Executions" in the left sidebar\n' +
    '3. Or click "View → Logs" to see recent logs',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// Advanced Configuration
// ============================================================================

/**
 * Debounce function to prevent multiple triggers in quick succession
 * Useful if multiple cells are edited at once
 */
const DEBOUNCE_DELAY = 5000; // 5 seconds
let lastTriggerTime = 0;

function debouncedOnEdit(e) {
  const now = Date.now();

  if (now - lastTriggerTime < DEBOUNCE_DELAY) {
    Logger.log('⏳ Skipping trigger (debounced)');
    return;
  }

  lastTriggerTime = now;
  onEdit(e);
}

/**
 * Scheduled trigger - runs every hour as backup
 * Use this if onChange/onEdit triggers are unreliable
 */
function scheduledSync() {
  Logger.log('⏰ Scheduled sync triggered');
  triggerGitHubAction('scheduled', 'All');
}

// ============================================================================
// Setup Instructions (Copy this to Apps Script)
// ============================================================================

/*

QUICK SETUP CHECKLIST:

☐ 1. Update GITHUB_TOKEN, REPO_OWNER, and REPO_NAME above
☐ 2. Save the script (Ctrl+S / Cmd+S)
☐ 3. Run 'testConnection' function to verify setup
☐ 4. Create a trigger:
     - Click clock icon (Triggers)
     - Add Trigger
     - Function: onEdit (for instant updates) or onChange (for structural changes)
     - Event source: From spreadsheet
     - Event type: On edit / On change
     - Save
☐ 5. Test by editing a cell in the sheet
☐ 6. Check GitHub Actions tab to see if workflow triggered

OPTIONAL:
☐ Use Script Properties for secure token storage
☐ Set up scheduled trigger as backup (hourly)
☐ Customize which sheets trigger the webhook
☐ Add email notifications on failure

*/
