#!/usr/bin/env node

/**
 * Download and optimize images for the Hugo site
 *
 * Supports two methods:
 * 1. Google Drive folder sync (requires GOOGLE_API_KEY)
 * 2. Direct URL list (no API key needed)
 *
 * Environment variables (optional):
 * - GOOGLE_API_KEY: Required only for Google Drive method
 *
 * Usage:
 * node scripts/download-images.js [folder-name]
 *
 * Examples:
 * node scripts/download-images.js              # Download all configured folders
 * node scripts/download-images.js board_photos # Download only board photos
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load configuration
const configPath = path.join(__dirname, 'sheets-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Google Drive API (only loaded if needed)
let drive = null;
function initDriveApi() {
  if (!drive) {
    const { google } = require('googleapis');
    drive = google.drive('v3');
  }
  return drive;
}

/**
 * Download a file from URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Optimize an image using Sharp
 */
async function optimizeImage(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // Only optimize if image is larger than reasonable size
    if (metadata.width > 800) {
      const ext = path.extname(imagePath).toLowerCase();
      const tmpPath = imagePath + '.tmp';

      if (ext === '.jpg' || ext === '.jpeg') {
        await image
          .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
          .jpeg({ quality: 85 })
          .toFile(tmpPath);
      } else if (ext === '.png') {
        await image
          .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
          .png({ quality: 85 })
          .toFile(tmpPath);
      } else {
        // For other formats, just resize
        await image
          .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
          .toFile(tmpPath);
      }

      // Replace original with optimized
      fs.renameSync(tmpPath, imagePath);
      console.log(`    🔧 Optimized: ${path.basename(imagePath)}`);
    }
  } catch (error) {
    console.error(`    ⚠️  Failed to optimize ${path.basename(imagePath)}:`, error.message);
  }
}

/**
 * List files in a Google Drive folder
 */
async function listDriveFiles(folderId, apiKey) {
  try {
    const driveApi = initDriveApi();
    console.log(`  📁 Listing files in Drive folder...`);

    const response = await driveApi.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      key: apiKey,
    });

    const files = response.data.files || [];
    console.log(`    Found ${files.length} image(s)`);
    return files;

  } catch (error) {
    console.error(`  ❌ Error listing Drive files:`, error.message);
    throw error;
  }
}

/**
 * Download a file from Google Drive
 */
async function downloadDriveFile(fileId, fileName, outputDir, apiKey) {
  try {
    const driveApi = initDriveApi();
    const outputPath = path.join(outputDir, fileName);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const response = await driveApi.files.get({
      fileId: fileId,
      alt: 'media',
      key: apiKey,
    }, {
      responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
      const dest = fs.createWriteStream(outputPath);
      response.data
        .on('error', reject)
        .pipe(dest)
        .on('error', reject)
        .on('finish', () => resolve(outputPath));
    });

  } catch (error) {
    console.error(`    ❌ Error downloading ${fileName}:`, error.message);
    throw error;
  }
}

/**
 * Sync images from a Google Drive folder
 */
async function syncDriveFolder(folderConfig, apiKey) {
  try {
    const files = await listDriveFiles(folderConfig.folderId, apiKey);

    if (files.length === 0) {
      console.log('  ℹ️  No images to download');
      return { success: true, count: 0 };
    }

    const outputDir = path.join(process.cwd(), folderConfig.outputPath);

    let downloaded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        console.log(`  ⬇️  Downloading: ${file.name}`);
        const outputPath = await downloadDriveFile(
          file.id,
          file.name,
          outputDir,
          apiKey
        );

        // Optimize the image
        await optimizeImage(outputPath);

        downloaded++;
      } catch (error) {
        console.error(`    ❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log(`  ✅ Downloaded ${downloaded} image(s), ${failed} failed`);
    return { success: failed === 0, count: downloaded, failed };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sync images from a list of URLs
 */
async function syncImageUrls(folderConfig) {
  try {
    const imageUrls = folderConfig.imageUrls || [];

    if (imageUrls.length === 0) {
      console.log('  ℹ️  No image URLs configured');
      return { success: true, count: 0 };
    }

    const outputDir = path.join(process.cwd(), folderConfig.outputPath);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let downloaded = 0;
    let failed = 0;

    for (const imageUrl of imageUrls) {
      try {
        const fileName = path.basename(new URL(imageUrl).pathname);
        const outputPath = path.join(outputDir, fileName);

        console.log(`  ⬇️  Downloading: ${fileName}`);
        await downloadFile(imageUrl, outputPath);

        // Optimize the image
        await optimizeImage(outputPath);

        downloaded++;
      } catch (error) {
        console.error(`    ❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log(`  ✅ Downloaded ${downloaded} image(s), ${failed} failed`);
    return { success: failed === 0, count: downloaded, failed };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sync images for a folder
 */
async function syncFolder(folderName, folderConfig, apiKey) {
  console.log(`\n🔄 Syncing ${folderName}...`);

  try {
    // Determine method
    const method = folderConfig.method || 'drive';

    if (method === 'drive') {
      if (!apiKey) {
        console.error('  ❌ GOOGLE_API_KEY required for Drive method');
        return { success: false, error: 'API key not set' };
      }
      return await syncDriveFolder(folderConfig, apiKey);
    } else if (method === 'urls') {
      return await syncImageUrls(folderConfig);
    } else {
      console.error(`  ❌ Unknown method: ${method}`);
      return { success: false, error: `Unknown method: ${method}` };
    }

  } catch (error) {
    console.error(`  ❌ Failed to sync ${folderName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting image download...\n');

  // Check for API key (optional, depends on method)
  const apiKey = process.env.GOOGLE_API_KEY;

  // Get folder name from command line args (optional)
  const targetFolder = process.argv[2];

  // Determine which folders to sync
  const foldersToSync = targetFolder
    ? { [targetFolder]: config.images[targetFolder] }
    : config.images;

  if (!foldersToSync || Object.keys(foldersToSync).length === 0) {
    if (targetFolder) {
      console.error(`❌ Error: Folder "${targetFolder}" not found in config`);
    } else {
      console.log('ℹ️  No image folders configured - skipping image sync');
    }
    process.exit(targetFolder ? 1 : 0);
  }

  // Sync each folder
  const results = {};
  for (const [folderName, folderConfig] of Object.entries(foldersToSync)) {
    results[folderName] = await syncFolder(folderName, folderConfig, apiKey);
  }

  // Print summary
  console.log('\n📊 Download Summary:');
  console.log('═══════════════════════════════════════');

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalImages = 0;

  for (const [folderName, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`✅ ${folderName}: ${result.count} images downloaded`);
      totalSuccess++;
      totalImages += result.count;
    } else {
      console.log(`❌ ${folderName}: Failed - ${result.error || 'Unknown error'}`);
      totalFailed++;
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Total: ${totalImages} images, ${totalSuccess} folders succeeded, ${totalFailed} failed\n`);

  // Exit with error code if any sync failed
  if (totalFailed > 0) {
    process.exit(1);
  }

  console.log('🎉 Image download completed successfully!\n');
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
