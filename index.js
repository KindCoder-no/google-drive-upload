// Import dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});

// In-memory token storage (use Redis or database in production)
const tokenStore = new Map();

// OAuth2 Client Configuration
const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
    );
};

// Get Drive client with user's access token
const getGoogleDriveClient = (accessToken) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
};

// Middleware to verify access token
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authorization header with Bearer token is required',
        });
    }

    const accessToken = authHeader.substring(7);
    req.accessToken = accessToken;
    next();
};

// ============== AUTH ENDPOINTS ==============

// Generate OAuth URL for user to authenticate
app.get('/api/auth/url', (req, res) => {
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force consent to get refresh token
    });

    res.json({
        success: true,
        authUrl: authUrl,
    });
});

// OAuth callback - exchange code for tokens
app.get('/api/auth/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return res.redirect('/?error=No authorization code provided');
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        
        // Get user info
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Store tokens (in production, use a database)
        const userId = userInfo.data.id;
        tokenStore.set(userId, {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            email: userInfo.data.email,
        });

        // Redirect to frontend with token
        res.redirect(`/?access_token=${tokens.access_token}&email=${encodeURIComponent(userInfo.data.email)}`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent(error.message)}`);
    }
});

// Exchange authorization code for tokens (for API clients)
app.post('/api/auth/token', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'Authorization code is required',
        });
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Get user info
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        res.json({
            success: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
            user: {
                id: userInfo.data.id,
                email: userInfo.data.email,
                name: userInfo.data.name,
                picture: userInfo.data.picture,
            },
        });
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to exchange authorization code',
        });
    }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            error: 'Refresh token is required',
        });
    }

    try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        
        const { credentials } = await oauth2Client.refreshAccessToken();

        res.json({
            success: true,
            accessToken: credentials.access_token,
            expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to refresh token',
        });
    }
});

// Get current user info
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ access_token: req.accessToken });
        
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        res.json({
            success: true,
            user: {
                id: userInfo.data.id,
                email: userInfo.data.email,
                name: userInfo.data.name,
                picture: userInfo.data.picture,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid or expired access token',
        });
    }
});

// ============== FILE ENDPOINTS ==============

// Upload file to Google Drive
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file provided' 
            });
        }

        const drive = getGoogleDriveClient(req.accessToken);
        const folderId = req.body.folderId;

        // Create a readable stream from buffer
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        const fileMetadata = {
            name: req.body.fileName || req.file.originalname,
            ...(folderId && { parents: [folderId] }),
        };

        const media = {
            mimeType: req.file.mimetype,
            body: bufferStream,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, size, webViewLink, webContentLink',
        });

        res.json({
            success: true,
            file: {
                id: response.data.id,
                name: response.data.name,
                mimeType: response.data.mimeType,
                size: response.data.size,
                webViewLink: response.data.webViewLink,
                webContentLink: response.data.webContentLink,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload file',
        });
    }
});

// Upload multiple files to Google Drive
app.post('/api/upload/multiple', requireAuth, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No files provided' 
            });
        }

        const drive = getGoogleDriveClient(req.accessToken);
        const folderId = req.body.folderId;

        const uploadPromises = req.files.map(async (file) => {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(file.buffer);

            const fileMetadata = {
                name: file.originalname,
                ...(folderId && { parents: [folderId] }),
            };

            const media = {
                mimeType: file.mimetype,
                body: bufferStream,
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, mimeType, size, webViewLink, webContentLink',
            });

            return {
                id: response.data.id,
                name: response.data.name,
                mimeType: response.data.mimeType,
                size: response.data.size,
                webViewLink: response.data.webViewLink,
                webContentLink: response.data.webContentLink,
            };
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        res.json({
            success: true,
            files: uploadedFiles,
        });
    } catch (error) {
        console.error('Multiple upload error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload files',
        });
    }
});

// List files in user's Drive
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const drive = getGoogleDriveClient(req.accessToken);
        const folderId = req.query.folderId;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const pageToken = req.query.pageToken;

        let query = 'trashed = false';
        if (folderId) {
            query += ` and '${folderId}' in parents`;
        }

        const response = await drive.files.list({
            q: query,
            pageSize: pageSize,
            pageToken: pageToken,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink)',
            orderBy: 'createdTime desc',
        });

        res.json({
            success: true,
            files: response.data.files,
            nextPageToken: response.data.nextPageToken,
        });
    } catch (error) {
        console.error('List files error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list files',
        });
    }
});

// Get file details
app.get('/api/files/:fileId', requireAuth, async (req, res) => {
    try {
        const drive = getGoogleDriveClient(req.accessToken);
        const { fileId } = req.params;

        const response = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents',
        });

        res.json({
            success: true,
            file: response.data,
        });
    } catch (error) {
        console.error('Get file error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get file details',
        });
    }
});

// Delete file
app.delete('/api/files/:fileId', requireAuth, async (req, res) => {
    try {
        const drive = getGoogleDriveClient(req.accessToken);
        const { fileId } = req.params;

        await drive.files.delete({
            fileId: fileId,
        });

        res.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        console.error('Delete file error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete file',
        });
    }
});

// Create folder
app.post('/api/folders', requireAuth, async (req, res) => {
    try {
        const drive = getGoogleDriveClient(req.accessToken);
        const { folderName, parentFolderId } = req.body;

        if (!folderName) {
            return res.status(400).json({
                success: false,
                error: 'Folder name is required',
            });
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentFolderId && { parents: [parentFolderId] }),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, mimeType, webViewLink',
        });

        res.json({
            success: true,
            folder: {
                id: response.data.id,
                name: response.data.name,
                mimeType: response.data.mimeType,
                webViewLink: response.data.webViewLink,
            },
        });
    } catch (error) {
        console.error('Create folder error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create folder',
        });
    }
});

// Make file public (share with anyone)
app.post('/api/files/:fileId/share', requireAuth, async (req, res) => {
    try {
        const drive = getGoogleDriveClient(req.accessToken);
        const { fileId } = req.params;
        const { role = 'reader' } = req.body;

        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: role,
                type: 'anyone',
            },
        });

        // Get updated file info with sharing link
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, webViewLink, webContentLink',
        });

        res.json({
            success: true,
            file: file.data,
            message: 'File shared successfully',
        });
    } catch (error) {
        console.error('Share file error:', error);
        
        if (error.code === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired access token',
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to share file',
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Google Drive Upload API (OAuth 2.0) is running',
        timestamp: new Date().toISOString(),
    });
});

// Define Port
const port = process.env.PORT || 3000;

// Listen on defined port
app.listen(port, () => {
    console.log(`Google Drive Upload API (OAuth 2.0) started on port ${port}`);
});
