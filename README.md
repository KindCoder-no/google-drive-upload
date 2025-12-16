# Google Drive Upload API

A REST API for uploading files to Google Drive using OAuth 2.0 authentication, built with Express.js and deployable on Vercel.

## Features

- 🔐 OAuth 2.0 authentication (users sign in with their Google account)
- 📤 Upload single or multiple files to user's own Drive
- 📁 Create folders
- 📋 List files in a folder
- 🔍 Get file details
- 🗑️ Delete files
- 🔗 Share files publicly
- 🎨 Beautiful web interface with Google Sign-In

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/url` | Get OAuth authorization URL |
| POST | `/api/auth/token` | Exchange auth code for tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |

### Files (require Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a single file |
| POST | `/api/upload/multiple` | Upload multiple files (max 10) |
| GET | `/api/files` | List files in a folder |
| GET | `/api/files/:fileId` | Get file details |
| DELETE | `/api/files/:fileId` | Delete a file |
| POST | `/api/folders` | Create a new folder |
| POST | `/api/files/:fileId/share` | Share a file publicly |
| GET | `/api/health` | API health check |

## Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" for user type
   - Fill in app name, user support email, developer email
   - Add scopes: `drive.file`, `userinfo.email`, `userinfo.profile`
   - Add test users (your email) if in testing mode
4. Select "Web application" as application type
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for local dev)
   - `https://your-domain.vercel.app/api/auth/callback` (for production)
6. Click "Create" and save the Client ID and Client Secret

### 3. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set the following environment variables:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
PORT=3000
```

**For Vercel deployment:** Add these as environment variables in your Vercel project settings. Update `GOOGLE_REDIRECT_URI` to your production URL.

## Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

The API will be available at `http://localhost:3000`

## Usage Examples

### 1. Get OAuth URL and Authenticate

```bash
# Get the authorization URL
curl http://localhost:3000/api/auth/url

# User visits the URL, signs in, and gets redirected back with a code
# Exchange the code for tokens:
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"code": "4/0AX4XfWg..."}' \
  http://localhost:3000/api/auth/token
```

### 2. Upload a File (with access token)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/your/file.pdf" \
  http://localhost:3000/api/upload
```

### 3. Upload Multiple Files

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "files=@/path/to/file1.pdf" \
  -F "files=@/path/to/file2.jpg" \
  http://localhost:3000/api/upload/multiple
```

### 4. List Files

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/files
```

### 5. Create a Folder

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"folderName": "My New Folder"}' \
  http://localhost:3000/api/folders
```

### 6. Share a File Publicly

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/files/FILE_ID/share
```

### 7. Delete a File

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/files/FILE_ID
```

### 8. Refresh Access Token

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}' \
  http://localhost:3000/api/auth/refresh
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KindCoder-no/google-drive-upload)

1. Click the button above or import your repo to Vercel
2. Add the environment variables in the Vercel project settings:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (set to `https://your-domain.vercel.app/api/auth/callback`)
3. Update your Google Cloud OAuth credentials to include the Vercel redirect URI
4. Deploy!

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "file": {
    "id": "file-id",
    "name": "filename.pdf",
    "mimeType": "application/pdf",
    "size": "12345",
    "webViewLink": "https://drive.google.com/...",
    "webContentLink": "https://drive.google.com/..."
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## License

MIT

## Author

Emre Sanden ([@KindCoder-no](https://github.com/KindCoder-no))
