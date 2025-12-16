// Import dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const fs = require('fs');
const path = require('path');

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

// Token storage file path (for local development)
const TOKEN_FILE = path.join(__dirname, '.tokens.json');

// Load stored tokens from file OR environment variable
const loadStoredTokens = () => {
    // First, check for refresh token in environment variable (for Vercel/serverless)
    if (process.env.GOOGLE_REFRESH_TOKEN) {
        console.log('Loading tokens from environment variable');
        return {
            refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
            email: process.env.ADMIN_EMAIL || 'admin@configured.com',
            name: process.env.ADMIN_NAME || 'Admin',
        };
    }
    
    // Fall back to file storage (for local development)
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = fs.readFileSync(TOKEN_FILE, 'utf8');
            console.log('Loading tokens from file');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading tokens:', error);
    }
    return null;
};

// Save tokens to file (for local development)
const saveTokens = (tokens) => {
    try {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
        console.log('Tokens saved to file');
        console.log('');
        console.log('='.repeat(60));
        console.log('IMPORTANT: For Vercel deployment, add this environment variable:');
        console.log('='.repeat(60));
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refreshToken}`);
        console.log(`ADMIN_EMAIL=${tokens.email}`);
        console.log(`ADMIN_NAME=${tokens.name}`);
        console.log('='.repeat(60));
        console.log('');
    } catch (error) {
        console.error('Error saving tokens:', error);
    }
};

// Admin tokens (loaded from file or environment)
let adminTokens = loadStoredTokens();

// OAuth2 Client Configuration
const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
    );
};

// Get authenticated Drive client using admin's refresh token
const getAuthenticatedDriveClient = async () => {
    if (!adminTokens || !adminTokens.refreshToken) {
        throw new Error('Admin not authenticated. Please set up the API first.');
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
        refresh_token: adminTokens.refreshToken,
    });

    // Get fresh access token
    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        
        // Update stored tokens with new access token
        adminTokens.accessToken = credentials.access_token;
        adminTokens.expiryDate = credentials.expiry_date;
        saveTokens(adminTokens);
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error('Failed to refresh access token. Admin may need to re-authenticate.');
    }

    return google.drive({ version: 'v3', auth: oauth2Client });
};

// Check if API is configured
const isConfigured = () => {
    return adminTokens && adminTokens.refreshToken;
};

// ============== ADMIN SETUP ENDPOINTS ==============

// Check if API is set up
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        configured: isConfigured(),
        admin: adminTokens ? {
            email: adminTokens.email,
            name: adminTokens.name,
        } : null,
    });
});

// Generate OAuth URL for admin to authenticate (one-time setup)
app.get('/api/admin/auth/url', (req, res) => {
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

// OAuth callback - exchange code for tokens and store as admin
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

        // Store as admin tokens
        adminTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            email: userInfo.data.email,
            name: userInfo.data.name,
            picture: userInfo.data.picture,
            setupDate: new Date().toISOString(),
        };
        
        // Save to file for persistence (local dev)
        saveTokens(adminTokens);

        // For Vercel: redirect with refresh token so user can copy it
        // In production, you'd want a more secure way to handle this
        const params = new URLSearchParams({
            setup: 'success',
            refresh_token: tokens.refresh_token,
            email: userInfo.data.email,
        });
        res.redirect(`/?${params.toString()}`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent(error.message)}`);
    }
});

// Disconnect admin account (protected by admin key)
app.post('/api/admin/disconnect', (req, res) => {
    const { adminKey } = req.body;
    
    // Require admin key from environment for security
    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({
            success: false,
            error: 'Invalid admin key',
        });
    }

    adminTokens = null;
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            fs.unlinkSync(TOKEN_FILE);
        }
    } catch (error) {
        console.error('Error deleting token file:', error);
    }

    res.json({
        success: true,
        message: 'Admin account disconnected',
    });
});

// ============== PUBLIC FILE ENDPOINTS ==============

// Upload file to admin's Google Drive (public endpoint)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'API not configured. Admin needs to set up the connection first.',
            });
        }

        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file provided' 
            });
        }

        const drive = await getAuthenticatedDriveClient();
        const folderId = req.body.folderId || process.env.DEFAULT_FOLDER_ID;

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
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload file',
        });
    }
});

// Upload multiple files to admin's Google Drive (public endpoint)
app.post('/api/upload/multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'API not configured. Admin needs to set up the connection first.',
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No files provided' 
            });
        }

        const drive = await getAuthenticatedDriveClient();
        const folderId = req.body.folderId || process.env.DEFAULT_FOLDER_ID;

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
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload files',
        });
    }
});

// Create folder in admin's Google Drive (public endpoint)
app.post('/api/folders', async (req, res) => {
    try {
        if (!isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'API not configured. Admin needs to set up the connection first.',
            });
        }

        const drive = await getAuthenticatedDriveClient();
        const { folderName, parentFolderId } = req.body;
        const defaultParent = process.env.DEFAULT_FOLDER_ID;

        if (!folderName) {
            return res.status(400).json({
                success: false,
                error: 'Folder name is required',
            });
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentFolderId || defaultParent ? { parents: [parentFolderId || defaultParent] } : {}),
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
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create folder',
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Google Drive Upload API is running',
        configured: isConfigured(),
        timestamp: new Date().toISOString(),
    });
});

// Define Port
const port = process.env.PORT || 3000;

// Listen on defined port
app.listen(port, () => {
    console.log(`Google Drive Upload API started on port ${port}`);
    console.log(`API configured: ${isConfigured()}`);
    if (isConfigured()) {
        console.log(`Connected to: ${adminTokens.email}`);
    } else {
        console.log('Visit the web interface to set up admin authentication');
    }
});
