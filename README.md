# Google Drive Upload API

A REST API that allows anyone to upload files to your Google Drive. Built with Express.js and deployable on Vercel.

## How It Works

1. **You (admin)** connect your Google account once
2. **Anyone** can then upload files to your Drive without signing in
3. Files are uploaded to your Google Drive (optionally to a specific folder)

This is perfect for:
- Receiving files from clients/users
- Building file upload forms
- Creating submission portals
- Integrating with AI tools like MCP/Bolt.new

## Features

- 🔐 One-time admin OAuth 2.0 setup
- 📤 Public file uploads (no user auth required)
- 📁 Create folders
- 📂 Upload to specific folders
- 🚀 Deploy to Vercel (serverless)
- 🎨 Beautiful web interface

## API Endpoints

All file endpoints are **public** (no authentication required after admin setup).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Check if API is configured |
| POST | `/api/upload` | Upload a single file |
| POST | `/api/upload/multiple` | Upload multiple files (max 10) |
| POST | `/api/folders` | Create a new folder |
| GET | `/api/health` | API health check |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/auth/url` | Get OAuth URL for admin setup |
| POST | `/api/admin/disconnect` | Disconnect admin account |

## Quick Start

### 1. Create Google Cloud OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it
4. Configure **OAuth consent screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill in app name, support email
   - Add scopes: `drive.file`, `userinfo.email`, `userinfo.profile`
   - Add yourself as a test user
5. Create **OAuth 2.0 credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add redirect URI: `https://your-domain.vercel.app/api/auth/callback`
   - Save the Client ID and Client Secret

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KindCoder-no/google-drive-upload)

Add these environment variables in Vercel:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
```

### 3. Connect Your Google Account

1. Visit your deployed app
2. Click "Connect Google Account"
3. Sign in with your Google account
4. **Copy the refresh token** shown in the modal
5. Add it to Vercel environment variables:
   ```env
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   ADMIN_EMAIL=your-email@gmail.com
   ```
6. Redeploy

### 4. Done! 

Anyone can now upload files to your Google Drive.

## Usage Examples

### Upload a File

```bash
curl -X POST \
  -F "file=@/path/to/file.pdf" \
  https://your-api.vercel.app/api/upload
```

### Upload to a Specific Folder

```bash
curl -X POST \
  -F "file=@/path/to/file.pdf" \
  -F "folderId=YOUR_FOLDER_ID" \
  https://your-api.vercel.app/api/upload
```

### Upload Multiple Files

```bash
curl -X POST \
  -F "files=@/path/to/file1.pdf" \
  -F "files=@/path/to/file2.jpg" \
  https://your-api.vercel.app/api/upload/multiple
```

### Create a Folder

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"folderName": "Uploads"}' \
  https://your-api.vercel.app/api/folders
```

### Check API Status

```bash
curl https://your-api.vercel.app/api/status
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL |
| `GOOGLE_REFRESH_TOKEN` | Yes* | Admin's refresh token (*required for Vercel) |
| `ADMIN_EMAIL` | No | Admin's email (for display) |
| `DEFAULT_FOLDER_ID` | No | Default folder for uploads |
| `ADMIN_KEY` | No | Key to protect disconnect endpoint |

## Local Development

```bash
# Clone the repo
git clone https://github.com/KindCoder-no/google-drive-upload.git
cd google-drive-upload

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Start the server
npm start
```

Visit `http://localhost:3000` and connect your Google account.

## Response Format

### Success Response

```json
{
  "success": true,
  "file": {
    "id": "1abc123...",
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": "12345",
    "webViewLink": "https://drive.google.com/file/d/...",
    "webContentLink": "https://drive.google.com/uc?id=..."
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

## Security Notes

- The refresh token is stored as an environment variable (secure on Vercel)
- Anyone with the API URL can upload files - consider adding rate limiting for production
- Files are uploaded with the `drive.file` scope (only accesses files created by the app)
- Consider using `DEFAULT_FOLDER_ID` to organize uploads

## License

MIT

## Author

Emre Sanden ([@KindCoder-no](https://github.com/KindCoder-no))
