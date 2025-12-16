# Google Drive Upload API

A simple REST API for uploading files to Google Drive, built with Express.js and deployable on Vercel.

## Features

- 📤 Upload single or multiple files
- 📁 Create folders
- 📋 List files in a folder
- 🔍 Get file details
- 🗑️ Delete files
- 🔗 Share files publicly
- 🎨 Beautiful web interface for testing

## API Endpoints

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

### 2. Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details
4. Click "Create and Continue"
5. Grant the service account access (optional)
6. Click "Done"

### 3. Generate Service Account Key

1. Click on the created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" and click "Create"
5. Save the downloaded JSON file securely

### 4. Share Google Drive Folder with Service Account

1. Create a folder in Google Drive (or use an existing one)
2. Right-click the folder and select "Share"
3. Add the service account email (found in the JSON key file as `client_email`)
4. Give it "Editor" access
5. Copy the folder ID from the URL (the long string after `/folders/`)

### 5. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set the following environment variables:

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
PORT=3000
```

**For Vercel deployment:** Add these as environment variables in your Vercel project settings.

## Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

The API will be available at `http://localhost:3000`

## Usage Examples

### Upload a Single File

```bash
curl -X POST \
  -F "file=@/path/to/your/file.pdf" \
  -F "folderId=YOUR_FOLDER_ID" \
  http://localhost:3000/api/upload
```

### Upload Multiple Files

```bash
curl -X POST \
  -F "files=@/path/to/file1.pdf" \
  -F "files=@/path/to/file2.jpg" \
  http://localhost:3000/api/upload/multiple
```

### List Files

```bash
curl http://localhost:3000/api/files?folderId=YOUR_FOLDER_ID
```

### Create a Folder

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"folderName": "My New Folder"}' \
  http://localhost:3000/api/folders
```

### Share a File Publicly

```bash
curl -X POST \
  http://localhost:3000/api/files/FILE_ID/share
```

### Delete a File

```bash
curl -X DELETE http://localhost:3000/api/files/FILE_ID
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KindCoder-no/google-drive-upload)

1. Click the button above or import your repo to Vercel
2. Add the environment variables in the Vercel project settings
3. Deploy!

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
