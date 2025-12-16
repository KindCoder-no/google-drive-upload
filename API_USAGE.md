# Google Drive Upload API - Usage Guide

Base URL: `https://your-api-domain.vercel.app`

## Overview

This API allows **public file uploads** to a pre-configured Google Drive account. No authentication is required for uploading files - the admin has already connected their Google account.

---

## Endpoints

### 1. Check API Status

**GET** `/api/status`

Check if the API is configured and ready to accept uploads.

**Example Request:**
```bash
curl "https://your-api.vercel.app/api/status"
```

**Success Response (200):**
```json
{
  "success": true,
  "configured": true,
  "admin": {
    "email": "admin@gmail.com",
    "name": "Admin Name"
  }
}
```

**Not Configured Response (200):**
```json
{
  "success": true,
  "configured": false,
  "admin": null
}
```

---

### 2. Upload Single File

**POST** `/api/upload`

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | The file to upload (max 50MB) |
| fileName | string | No | Custom filename (defaults to original name) |
| folderId | string | No | Google Drive folder ID to upload to |

**Example Request:**
```bash
curl -X POST \
  -F "file=@/path/to/document.pdf" \
  https://your-api.vercel.app/api/upload
```

**Upload to Specific Folder:**
```bash
curl -X POST \
  -F "file=@/path/to/document.pdf" \
  -F "folderId=1abc123XYZ..." \
  https://your-api.vercel.app/api/upload
```

**With Custom Filename:**
```bash
curl -X POST \
  -F "file=@/path/to/document.pdf" \
  -F "fileName=my-custom-name.pdf" \
  https://your-api.vercel.app/api/upload
```

**Success Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "1abc123XYZ...",
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": "12345",
    "webViewLink": "https://drive.google.com/file/d/1abc123XYZ.../view",
    "webContentLink": "https://drive.google.com/uc?id=1abc123XYZ..."
  }
}
```

---

### 3. Upload Large Files (Resumable Upload)

**POST** `/api/upload/resumable`

For files larger than 4MB, use this endpoint to get an access token and upload directly to Google Drive, bypassing Vercel's body size limits.

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fileName | string | Yes | Name of the file |
| mimeType | string | Yes | MIME type of the file |
| fileSize | number | Yes | Size of the file in bytes |
| folderId | string | No | Google Drive folder ID |

**Example Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"fileName": "large-video.mp4", "mimeType": "video/mp4", "fileSize": 104857600}' \
  https://your-api.vercel.app/api/upload/resumable
```

**Success Response (200):**
```json
{
  "success": true,
  "method": "token",
  "accessToken": "ya29.a0AfH...",
  "folderId": "1abc123XYZ...",
  "expiresIn": 3600
}
```

**Then upload directly to Google Drive:**
```javascript
const metadata = { name: fileName, parents: [folderId] };
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('file', file);

const response = await fetch(
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form
  }
);
```

---

### 4. Upload Multiple Files

**POST** `/api/upload/multiple`

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | files[] | Yes | Array of files to upload (max 10 files, 50MB each) |
| folderId | string | No | Google Drive folder ID to upload to |

**Example Request:**
```bash
curl -X POST \
  -F "files=@/path/to/file1.pdf" \
  -F "files=@/path/to/file2.jpg" \
  -F "files=@/path/to/file3.png" \
  https://your-api.vercel.app/api/upload/multiple
```

**Success Response (200):**
```json
{
  "success": true,
  "files": [
    {
      "id": "1abc...",
      "name": "file1.pdf",
      "mimeType": "application/pdf",
      "size": "12345",
      "webViewLink": "https://drive.google.com/file/d/.../view",
      "webContentLink": "https://drive.google.com/uc?id=..."
    },
    {
      "id": "2def...",
      "name": "file2.jpg",
      "mimeType": "image/jpeg",
      "size": "54321",
      "webViewLink": "https://drive.google.com/file/d/.../view",
      "webContentLink": "https://drive.google.com/uc?id=..."
    }
  ]
}
```

---

### 5. Create Folder

**POST** `/api/folders`

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| folderName | string | Yes | Name of the folder to create |
| parentFolderId | string | No | Parent folder ID (creates at root if not specified) |

**Example Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"folderName": "Uploads"}' \
  https://your-api.vercel.app/api/folders
```

**Create Subfolder:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"folderName": "Images", "parentFolderId": "1abc123..."}' \
  https://your-api.vercel.app/api/folders
```

**Success Response (200):**
```json
{
  "success": true,
  "folder": {
    "id": "1xyz789...",
    "name": "Uploads",
    "mimeType": "application/vnd.google-apps.folder",
    "webViewLink": "https://drive.google.com/drive/folders/1xyz789..."
  }
}
```

---

### 5. Health Check

**GET** `/api/health`

Check if the API server is running.

**Example Request:**
```bash
curl "https://your-api.vercel.app/api/health"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Google Drive Upload API is running",
  "configured": true,
  "timestamp": "2024-12-16T12:00:00.000Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | No file provided | Request missing file attachment |
| 400 | Folder name is required | Missing folderName in request body |
| 500 | Failed to upload file | Google Drive API error |
| 503 | API not configured | Admin has not connected Google account |

---

## JavaScript/TypeScript Examples

### Upload File with Fetch

```javascript
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('https://your-api.vercel.app/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('File uploaded:', result.file.webViewLink);
    return result.file;
  } else {
    throw new Error(result.error);
  }
}
```

### Upload Multiple Files

```javascript
async function uploadMultipleFiles(files) {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await fetch('https://your-api.vercel.app/api/upload/multiple', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}
```

### Upload to Specific Folder

```javascript
async function uploadToFolder(file, folderId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folderId', folderId);
  
  const response = await fetch('https://your-api.vercel.app/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}
```

### Create Folder

```javascript
async function createFolder(folderName, parentFolderId = null) {
  const response = await fetch('https://your-api.vercel.app/api/folders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folderName,
      parentFolderId,
    }),
  });
  
  return response.json();
}
```

---

## Python Examples

### Upload File

```python
import requests

def upload_file(file_path):
    url = "https://your-api.vercel.app/api/upload"
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, files=files)
    
    result = response.json()
    
    if result['success']:
        print(f"Uploaded: {result['file']['webViewLink']}")
        return result['file']
    else:
        raise Exception(result['error'])

# Usage
upload_file('/path/to/document.pdf')
```

### Upload to Folder

```python
import requests

def upload_to_folder(file_path, folder_id):
    url = "https://your-api.vercel.app/api/upload"
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'folderId': folder_id}
        response = requests.post(url, files=files, data=data)
    
    return response.json()

# Usage
upload_to_folder('/path/to/file.pdf', '1abc123XYZ...')
```

### Create Folder

```python
import requests

def create_folder(folder_name, parent_id=None):
    url = "https://your-api.vercel.app/api/folders"
    
    data = {'folderName': folder_name}
    if parent_id:
        data['parentFolderId'] = parent_id
    
    response = requests.post(url, json=data)
    return response.json()

# Usage
create_folder('My Uploads')
```

---

## Rate Limits & Restrictions

- **Max file size:** 50MB per file
- **Max files per request:** 10 files (for `/api/upload/multiple`)
- **Google Drive API limits:** Subject to Google's API quotas

---

## Getting a Folder ID

To upload to a specific folder, you need its folder ID:

1. Open Google Drive in your browser
2. Navigate to the folder
3. Look at the URL: `https://drive.google.com/drive/folders/1abc123XYZ...`
4. The folder ID is the part after `/folders/`: `1abc123XYZ...`

---

## MCP/AI Tool Integration

This API is designed to work seamlessly with AI tools. Simply provide the base URL and the AI can:

1. Check status with `GET /api/status`
2. Upload files with `POST /api/upload`
3. Create folders with `POST /api/folders`

No authentication headers required!
