# Google Drive Upload API - Usage Guide (OAuth 2.0)

Base URL: `https://your-api-domain.vercel.app`

## Authentication

This API uses **OAuth 2.0** for authentication. Users must authenticate with their Google account to upload files to their own Google Drive.

### Authentication Flow

1. **Get auth URL** → User visits the URL → User approves access → Redirect with auth code
2. **Exchange auth code for tokens** → Get access token and refresh token
3. **Use access token** in `Authorization: Bearer <token>` header for all API calls

---

## Auth Endpoints

### 1. Get OAuth Authorization URL

**GET** `/api/auth/url`

Returns the Google OAuth consent URL. Redirect users to this URL to authenticate.

**Example Request:**
```bash
curl "https://your-api.vercel.app/api/auth/url"
```

**Success Response (200):**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

---

### 2. Exchange Auth Code for Tokens

**POST** `/api/auth/token`

**Content-Type:** `application/json`

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| code | string | Yes | Authorization code from OAuth callback |

**Example Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"code": "4/0AX4XfWg..."}' \
  https://your-api.vercel.app/api/auth/token
```

**Success Response (200):**
```json
{
  "success": true,
  "accessToken": "ya29.a0AfH6SMB...",
  "refreshToken": "1//0gYC...",
  "expiresIn": 3599,
  "user": {
    "id": "123456789",
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

---

### 3. Refresh Access Token

**POST** `/api/auth/refresh`

**Content-Type:** `application/json`

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| refreshToken | string | Yes | The refresh token from initial auth |

**Example Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "1//0gYC..."}' \
  https://your-api.vercel.app/api/auth/refresh
```

**Success Response (200):**
```json
{
  "success": true,
  "accessToken": "ya29.a0AfH6SMB...",
  "expiresIn": 3599
}
```

---

### 4. Get Current User

**GET** `/api/auth/me`

**Headers:** `Authorization: Bearer <access_token>`

**Example Request:**
```bash
curl -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  https://your-api.vercel.app/api/auth/me
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "123456789",
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

---

## File Endpoints

**All file endpoints require the `Authorization: Bearer <access_token>` header.**

### 1. Upload Single File

**POST** `/api/upload`

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | The file to upload |
| folderId | string | No | Google Drive folder ID to upload to |
| fileName | string | No | Custom filename (defaults to original) |

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  -F "file=@document.pdf" \
  -F "folderId=1abc123def456" \
  https://your-api.vercel.app/api/upload
```

**Success Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": "102400",
    "webViewLink": "https://drive.google.com/file/d/1aBc.../view",
    "webContentLink": "https://drive.google.com/uc?id=1aBc..."
  }
}
```

---

### 2. Upload Multiple Files

**POST** `/api/upload/multiple`

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | File[] | Yes | Array of files (max 10) |
| folderId | string | No | Google Drive folder ID |

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  -F "files=@file1.pdf" \
  -F "files=@file2.jpg" \
  -F "files=@file3.png" \
  https://your-api.vercel.app/api/upload/multiple
```

**Success Response (200):**
```json
{
  "success": true,
  "files": [
    {
      "id": "1aBc...",
      "name": "file1.pdf",
      "mimeType": "application/pdf",
      "size": "102400",
      "webViewLink": "https://drive.google.com/file/d/1aBc.../view",
      "webContentLink": "https://drive.google.com/uc?id=1aBc..."
    }
  ]
}
```

---

### 3. List Files

**GET** `/api/files`

**Headers:** `Authorization: Bearer <access_token>`

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| folderId | string | No | Folder ID to list files from |
| pageSize | number | No | Results per page (default: 20) |
| pageToken | string | No | Token for pagination |

**Example Request:**
```bash
curl -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  "https://your-api.vercel.app/api/files?folderId=1abc123&pageSize=10"
```

**Success Response (200):**
```json
{
  "success": true,
  "files": [
    {
      "id": "1aBc...",
      "name": "document.pdf",
      "mimeType": "application/pdf",
      "size": "102400",
      "createdTime": "2024-01-15T10:30:00.000Z",
      "modifiedTime": "2024-01-15T10:30:00.000Z",
      "webViewLink": "https://drive.google.com/file/d/1aBc.../view",
      "webContentLink": "https://drive.google.com/uc?id=1aBc..."
    }
  ],
  "nextPageToken": "token_for_next_page_or_null"
}
```

---

### 4. Get File Details

**GET** `/api/files/:fileId`

**Headers:** `Authorization: Bearer <access_token>`

**Example Request:**
```bash
curl -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  "https://your-api.vercel.app/api/files/1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
```

**Success Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": "102400",
    "createdTime": "2024-01-15T10:30:00.000Z",
    "modifiedTime": "2024-01-15T10:30:00.000Z",
    "webViewLink": "https://drive.google.com/file/d/1aBc.../view",
    "webContentLink": "https://drive.google.com/uc?id=1aBc...",
    "parents": ["1parentFolderId"]
  }
}
```

---

### 5. Delete File

**DELETE** `/api/files/:fileId`

**Headers:** `Authorization: Bearer <access_token>`

**Example Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  "https://your-api.vercel.app/api/files/1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

### 6. Create Folder

**POST** `/api/folders`

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| folderName | string | Yes | Name for the new folder |
| parentFolderId | string | No | Parent folder ID |

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  -H "Content-Type: application/json" \
  -d '{"folderName": "My New Folder", "parentFolderId": "1abc123"}' \
  https://your-api.vercel.app/api/folders
```

**Success Response (200):**
```json
{
  "success": true,
  "folder": {
    "id": "1NewFolderId123",
    "name": "My New Folder",
    "mimeType": "application/vnd.google-apps.folder",
    "webViewLink": "https://drive.google.com/drive/folders/1NewFolderId123"
  }
}
```

---

### 7. Share File Publicly

**POST** `/api/files/:fileId/share`

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| role | string | No | Permission role: `reader` (default), `writer`, `commenter` |

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer ya29.a0AfH6SMB..." \
  -H "Content-Type: application/json" \
  -d '{"role": "reader"}' \
  https://your-api.vercel.app/api/files/1aBc123/share
```

**Success Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    "name": "document.pdf",
    "webViewLink": "https://drive.google.com/file/d/1aBc.../view",
    "webContentLink": "https://drive.google.com/uc?id=1aBc..."
  },
  "message": "File shared successfully"
}
```

---

### 8. Health Check

**GET** `/api/health`

**Example Request:**
```bash
curl "https://your-api.vercel.app/api/health"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Google Drive Upload API (OAuth 2.0) is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error description message"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (missing or invalid access token)
- `500` - Server Error (Google API error or configuration issue)

---

## Limits

- **Max file size:** 50MB per file
- **Max files per batch:** 10 files
- **Token expiry:** Access tokens expire in ~1 hour (use refresh token)
- **Supported:** All file types

---

## JavaScript/TypeScript Usage Examples

### Complete OAuth Flow:
```javascript
// 1. Get auth URL and redirect user
const authResponse = await fetch('https://your-api.vercel.app/api/auth/url');
const { authUrl } = await authResponse.json();
window.location.href = authUrl;

// 2. After redirect, exchange code for tokens (in callback handler)
const code = new URLSearchParams(window.location.search).get('code');
const tokenResponse = await fetch('https://your-api.vercel.app/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code })
});
const { accessToken, refreshToken, user } = await tokenResponse.json();

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### Upload with access token:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folderId', 'YOUR_FOLDER_ID');

const response = await fetch('https://your-api.vercel.app/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});

const result = await response.json();
console.log(result.file.webViewLink);
```

### Refresh token when expired:
```javascript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('https://your-api.vercel.app/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const { accessToken } = await response.json();
  localStorage.setItem('accessToken', accessToken);
  return accessToken;
}
```

### Create folder and upload workflow:
```javascript
const accessToken = localStorage.getItem('accessToken');

// 1. Create folder
const folderRes = await fetch('https://your-api.vercel.app/api/folders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ folderName: 'Project Files' })
});
const { folder } = await folderRes.json();

// 2. Upload file to folder
const formData = new FormData();
formData.append('file', file);
formData.append('folderId', folder.id);

const uploadRes = await fetch('https://your-api.vercel.app/api/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: formData
});
const { file: uploadedFile } = await uploadRes.json();

// 3. Share file publicly
await fetch(`https://your-api.vercel.app/api/files/${uploadedFile.id}/share`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ role: 'reader' })
});
```
