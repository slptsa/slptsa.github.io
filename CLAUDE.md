# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hugo-based website for Serene Lake Elementary PTSA (Parent Teacher Student Association) in Mukilteo, WA. The site is built using the [dot-org Hugo theme](https://github.com/cncf/dot-org-hugo-theme) as a git submodule and is deployed to GitHub Pages.

## Key Commands

### Development
```bash
npm run start       # Start local dev server with verbose logging
npm run dev         # Alias for dev:start
npm run dev:start   # Start Hugo server with all debug flags enabled
```

### Building
```bash
npm run build                   # Build site with dot-org theme
npm run dev:build              # Build for local development
npm run build:production       # Build for production (requires --url config)
```

### Search Index
```bash
npm run dev:start:with-pagefind  # Build site, generate Pagefind index, then start server
npx -y pagefind --site public    # Manually rebuild search index after content changes
```

### Dependencies
```bash
npm install   # Install Hugo Extended, Netlify CLI, PostCSS, SASS, and other dependencies
npm ci        # Clean install (used in CI/CD)
```

### Data Sync (Google Sheets)
```bash
npm run sync:data      # Sync data from Google Sheets to YAML
npm run sync:images    # Download images from Google Drive
npm run sync:all       # Run both data and image sync
```

## Architecture

### Theme Structure
- **Base theme**: `themes/dot-org/` (git submodule from CNCF dot-org-hugo-theme)
- **Custom overrides**: `layouts/` directory overrides theme templates
  - `layouts/_default/` - Custom page templates (home.html, board.html, staff_favorites.html)
  - `layouts/partials/` - Custom partial overrides (header.html, footer.html, page-header.html)
  - `layouts/board/` and `layouts/events/` - Section-specific layouts

### Configuration Approach
The site uses Hugo's config directory structure instead of a single config file:
- `config/_default/hugo.yaml` - Main site configuration, theme settings, organization details
- `config/_default/params.yaml` - Custom theme parameters, logos, colors, social links
- `config/_default/menus.yaml` - Site navigation menu structure
- `config/_default/languages.yaml` - i18n configuration
- `config/development/` and `config/production/` - Environment-specific overrides
- `hugo.toml` - Root config (minimal, defers to config directory)

### Content Organization
- `content/en/` - Primary English content directory
  - Sections: about, board, events, join, news, our-school, school-info, sponsors, volunteer
  - Content uses Hugo's page bundles pattern (_index.md for list pages)

- `data/` - YAML data files for structured content
  - `data/board/members.yaml` - Board member information (elected/appointed, photos, bios)
  - `data/events/upcoming.yaml` - Event listings with categories (meeting, fundraiser, social)
  - `data/staff/favorites.yaml` - Staff favorite things
  - `data/news/posts.yaml` - News posts

### Static Assets
- `static/img/` - Images (logo, banner, photos)
- `assets/css/` - Custom CSS files (referenced in params.yaml)

### Data File Patterns

**Board members** (`data/board/members.yaml`):
- Fields: name, position, email, photo, bio, elected (true/false), election_date, term
- Rendered using custom `layouts/_default/board.html` template

**Events** (`data/events/upcoming.yaml`):
- Fields: title, date, end_date, time, location, description, category, multi_day, volunteers_needed, volunteer_link, zoom_meeting, zoom_link
- Categories: meeting, fundraiser, social
- Used to generate event calendar displays

**News posts** (`data/news/posts.yaml`):
- Fields: title, date, expiry_date, author, summary, content, featured (true/false)
- Date filtering: Posts display only if `date <= today AND (expiry_date >= today OR expiry_date is empty)`
- Featured posts get special highlighted styling
- Rendered using custom `layouts/news/list.html` template

## Important Development Notes

### Hugo Server Flags
The `start` and `dev:start` commands use extensive debug flags:
- `--buildDrafts --buildFuture` - Show draft and future-dated content
- `--ignoreCache --disableFastRender --gc` - Force clean rebuilds
- `--printI18nWarnings --printMemoryUsage --printPathWarnings --printUnusedTemplates` - Verbose debugging
- `--templateMetrics --templateMetricsHints` - Performance insights

### Theme Customization Pattern
To override theme templates:
1. Copy template from `themes/dot-org/layouts/` to project `layouts/`
2. Modify the local copy (keeps originals in .original or .simple suffix if needed)
3. Hugo will use project layouts/ files over theme files

### Search Integration
- Uses Pagefind for static site search
- Search index must be rebuilt after content changes
- Index generated from `public/` directory after build
- Search UI available via `{{< search_form >}}` shortcode or dedicated search.md page

### Multi-language Support
- Default language: English (en)
- Spanish content in `content/es/` (currently minimal)
- `defaultContentLanguageInSubdir: false` - English content served at root path

## CI/CD Pipeline

### Hugo Build & Deploy (`.github/workflows/hugo.yml`)
1. Installs Hugo Extended v0.128.0 and Dart Sass
2. Checks out repository with submodules
3. Runs `npm ci` to install dependencies
4. Builds with `hugo --gc --minify`
5. Deploys to GitHub Pages

**Note**: The workflow installs a specific Hugo version (0.128.0), but package.json specifies hugo-extended ^0.148.1. Consider aligning these versions.

### Google Sheets Data Sync (`.github/workflows/sync-data.yml`)
Automatically syncs data from Google Sheets to YAML files:
1. **Schedule**: Runs twice daily at 2 AM and 2 PM PT
2. **Manual Trigger**: Can be triggered from Actions tab
3. **Webhook**: Can be triggered by Google Sheets changes (via Apps Script)
4. **Process**:
   - Fetches data from Google Sheets (Board, Events, Staff)
   - Converts to YAML format
   - Downloads images from Google Drive
   - Commits changes if data updated
   - Triggers Hugo rebuild automatically
5. **Notifications**: Creates GitHub issue on failure

**Setup**: Requires `GOOGLE_API_KEY` secret with Sheets & Drive API access.
**Configuration**: `scripts/sheets-config.json` contains Sheet IDs and field mappings.
**Documentation**: See `scripts/README.md` for detailed setup instructions.

## Common Tasks

### Adding Board Members
**Option 1** (Recommended): Update the Google Sheet directly - changes sync automatically twice daily or via webhook.
**Option 2**: Edit `data/board/members.yaml` manually - set `elected: true` for elected officials, `elected: false` for appointed positions.

### Adding Events
**Option 1** (Recommended): Update the Google Sheet directly - changes sync automatically.
**Option 2**: Add entries to `data/events/upcoming.yaml` manually following the established schema.

### Adding Staff Favorites
**Option 1** (Recommended): Update the Google Sheet directly - changes sync automatically.
**Option 2**: Edit `data/staff/favorites.yaml` manually.

### Adding News Posts
**Option 1** (Recommended): Update the Google Sheet directly - changes sync automatically twice daily or via webhook.
**Option 2**: Add entries to `data/news/posts.yaml` manually following the established schema.

**Fields:**
- `title` - Headline of the news post
- `date` - Publish date (YYYY-MM-DD) - post won't display until this date
- `expiry_date` - Optional expiration date (YYYY-MM-DD) - post stops displaying after this date (leave empty for permanent posts)
- `author` - Who wrote the post (e.g., "PTSA Board")
- `summary` - Short summary displayed in bold
- `content` - Full article content (supports markdown)
- `featured` - Set to `true` to highlight the post with special styling

**Note**: When using Google Sheets, the automated sync will overwrite any manual edits to YAML files. Choose one approach and stick with it.

### Updating Menus
Edit `config/_default/menus.yaml` - use `parent` field to create dropdown menus.

### Adding Custom Styles
Create CSS in `assets/css/` and reference in `config/_default/params.yaml` under `custom_css` array.

### Updating Theme
```bash
cd themes/dot-org
git pull
cd ../..
git add themes/dot-org
git commit -m "Updated dot-org theme"
```

## Site-Specific Branding

Organization colors (from logo):
- Primary: `#2B9B9E` (Teal)
- Secondary: `#0D5C75` (Dark teal)
- Accent: `#FFFFFF` (White)
- Text: `#2D2D2D` (Dark gray)
- Background: `#FFFFFF`
- Light Gray: `#E8E8E8`

These are configured in `config/_default/hugo.yaml` under `params.colors`.
