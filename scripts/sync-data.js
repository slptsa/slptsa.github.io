#!/usr/bin/env node

/**
 * Sync data from Google Sheets JSON exports to YAML files
 *
 * This script fetches JSON data from Google Sheets (exported via Apps Script extension)
 * and converts it to YAML format for use in the Hugo static site.
 *
 * NO API KEY REQUIRED - Uses direct JSON export URLs from sheets
 *
 * Usage:
 * node scripts/sync-data.js [sheet-name]
 *
 * Examples:
 * node scripts/sync-data.js          # Sync all sheets
 * node scripts/sync-data.js board    # Sync only board members
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Load configuration
const configPath = path.join(__dirname, 'sheets-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Fetch JSON data from a URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return fetchJson(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Returns the max valid day for a given year/month (1-indexed)
 */
function getMaxDay(year, month) {
  const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return maxDays[month] || 31;
}

/**
 * Normalize a date string to YYYY-MM-DD.
 * Handles MM/DD/YYYY and MM-DD-YYYY from Google Sheets locale exports.
 * Caps invalid days (e.g. Sep 31 → Sep 30) rather than crashing the build.
 */
function normalizeDate(value) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD — validate/fix the day
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
  if (isoMatch) {
    if (isoMatch[4]) return trimmed; // keep datetime strings as-is
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const maxDay = getMaxDay(year, month);
    if (month < 1 || month > 12) return '';
    const safeDay = Math.min(Math.max(day, 1), maxDay);
    return `${isoMatch[1]}-${isoMatch[2]}-${String(safeDay).padStart(2, '0')}`;
  }

  // MM/DD/YYYY or MM-DD-YYYY (Google Sheets US locale export)
  const usMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    if (month < 1 || month > 12) return '';
    const maxDay = getMaxDay(year, month);
    const safeDay = Math.min(Math.max(day, 1), maxDay);
    return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  }

  return trimmed; // unrecognised format — pass through unchanged
}

/**
 * Normalize boolean values
 */
function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;

  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

/**
 * Normalize and clean data object
 */
function normalizeData(data) {
  if (Array.isArray(data)) {
    return data.map(item => normalizeData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const normalized = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip empty values
      if (value === null || value === undefined || value === '') {
        normalized[key] = '';
        continue;
      }

      // Normalize date fields (any key containing "date")
      if (typeof value === 'string' && /date/i.test(key)) {
        normalized[key] = normalizeDate(value);
      }
      // Trim strings
      else if (typeof value === 'string') {
        normalized[key] = value.trim();
      }
      // Handle boolean-looking strings
      else if (typeof value === 'string' &&
               (value.toLowerCase() === 'true' ||
                value.toLowerCase() === 'false' ||
                value.toLowerCase() === 'yes' ||
                value.toLowerCase() === 'no')) {
        normalized[key] = normalizeBoolean(value);
      }
      // Recursively normalize objects
      else if (typeof value === 'object') {
        normalized[key] = normalizeData(value);
      }
      // Keep other values as-is
      else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  return data;
}

/**
 * Validate data structure
 */
function validateData(sheetName, data) {
  if (!Array.isArray(data)) {
    throw new Error(`Data for ${sheetName} is not an array`);
  }

  if (data.length === 0) {
    console.log(`⚠️  Warning: ${sheetName} has no data`);
    return true;
  }

  // Basic validation - ensure all items are objects
  const invalidItems = data.filter(item => typeof item !== 'object' || item === null);
  if (invalidItems.length > 0) {
    throw new Error(`${sheetName} contains ${invalidItems.length} invalid items`);
  }

  return true;
}

/**
 * Write data to YAML file
 */
function writeYamlFile(data, outputPath) {
  try {
    const fullPath = path.join(process.cwd(), outputPath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create backup if file exists
    if (fs.existsSync(fullPath) && config.options?.backupBeforeSync) {
      const backupPath = `${fullPath}.backup`;
      fs.copyFileSync(fullPath, backupPath);
      console.log(`  💾 Created backup: ${path.basename(backupPath)}`);
    }

    // Convert to YAML
    const yamlOptions = {
      indent: 2,
      lineWidth: 0, // Disable line wrapping
      minContentWidth: 0,
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN',
    };

    const yamlContent = YAML.stringify(data, yamlOptions);

    // Write to file
    fs.writeFileSync(fullPath, yamlContent, 'utf8');
    console.log(`  ✅ Wrote ${data.length} records to ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`  ❌ Error writing YAML file:`, error.message);
    throw error;
  }
}

/**
 * Fetch data from a Google Sheet JSON export
 */
async function fetchSheetData(sheetConfig) {
  try {
    console.log(`  📊 Fetching JSON from URL...`);

    const data = await fetchJson(sheetConfig.jsonUrl);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log('  ⚠️  No data found');
      return [];
    }

    console.log(`  ✅ Fetched ${Array.isArray(data) ? data.length : 1} record(s)`);
    return data;

  } catch (error) {
    console.error(`  ❌ Error fetching data:`, error.message);
    throw error;
  }
}

/**
 * Sync a single sheet
 */
async function syncSheet(sheetName, sheetConfig) {
  console.log(`\n🔄 Syncing ${sheetName}...`);
  console.log(`   ${sheetConfig.description}`);

  try {
    // Fetch data
    const rawData = await fetchSheetData(sheetConfig);

    // Normalize data
    const normalizedData = normalizeData(rawData);

    // Validate data
    if (config.options?.validateData) {
      validateData(sheetName, normalizedData);
    }

    // Write to YAML
    writeYamlFile(normalizedData, sheetConfig.outputPath);

    return {
      success: true,
      count: Array.isArray(normalizedData) ? normalizedData.length : 1
    };

  } catch (error) {
    console.error(`  ❌ Failed to sync ${sheetName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Google Sheets JSON to YAML sync...\n');

  // Get sheet name from command line args (optional)
  const targetSheet = process.argv[2];

  // Determine which sheets to sync
  const sheetsToSync = targetSheet
    ? { [targetSheet]: config.sheets[targetSheet] }
    : config.sheets;

  if (!sheetsToSync || Object.keys(sheetsToSync).length === 0) {
    console.error(`❌ Error: Sheet "${targetSheet}" not found in config`);
    console.error(`Available sheets: ${Object.keys(config.sheets).join(', ')}`);
    process.exit(1);
  }

  // Validate URLs are configured
  for (const [name, sheetConfig] of Object.entries(sheetsToSync)) {
    if (!sheetConfig.jsonUrl || sheetConfig.jsonUrl.includes('YOUR_')) {
      console.error(`❌ Error: JSON URL not configured for "${name}"`);
      console.error(`   Please update scripts/sheets-config.json with your actual JSON export URL`);
      process.exit(1);
    }
  }

  // Sync each sheet
  const results = {};
  for (const [sheetName, sheetConfig] of Object.entries(sheetsToSync)) {
    results[sheetName] = await syncSheet(sheetName, sheetConfig);
  }

  // Print summary
  console.log('\n📊 Sync Summary:');
  console.log('═══════════════════════════════════════');

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalRecords = 0;

  for (const [sheetName, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`✅ ${sheetName}: ${result.count} records synced`);
      totalSuccess++;
      totalRecords += result.count;
    } else {
      console.log(`❌ ${sheetName}: Failed - ${result.error}`);
      totalFailed++;
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Total: ${totalRecords} records, ${totalSuccess} succeeded, ${totalFailed} failed\n`);

  // Exit with error code if any sync failed
  if (totalFailed > 0) {
    process.exit(1);
  }

  console.log('🎉 Sync completed successfully!\n');
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
