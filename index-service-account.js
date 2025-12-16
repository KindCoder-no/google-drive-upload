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

// Google Drive Authentication
const getGoogleDriveClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
};

// Upload file to Google Drive
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file provided' 
            });
        }

        const drive = getGoogleDriveClient();
        const folderId = req.body.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

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
            supportsAllDrives: true, // Support Shared Drives
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

// Upload multiple files to Google Drive
app.post('/api/upload/multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No files provided' 
            });
        }

        const drive = getGoogleDriveClient();
        const folderId = req.body.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

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
                supportsAllDrives: true,
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

// List files in a folder
app.get('/api/files', async (req, res) => {
    try {
        const drive = getGoogleDriveClient();
        const folderId = req.query.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
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
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        res.json({
            success: true,
            files: response.data.files,
            nextPageToken: response.data.nextPageToken,
        });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list files',
        });
    }
});

// Get file details
app.get('/api/files/:fileId', async (req, res) => {
    try {
        const drive = getGoogleDriveClient();
        const { fileId } = req.params;

        const response = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents',
            supportsAllDrives: true,
        });

        res.json({
            success: true,
            file: response.data,
        });
    } catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get file details',
        });
    }
});

// Delete file
app.delete('/api/files/:fileId', async (req, res) => {
    try {
        const drive = getGoogleDriveClient();
        const { fileId } = req.params;

        await drive.files.delete({
            fileId: fileId,
            supportsAllDrives: true,
        });

        res.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete file',
        });
    }
});

// Create folder
app.post('/api/folders', async (req, res) => {
    try {
        const drive = getGoogleDriveClient();
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
            supportsAllDrives: true,
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

// Make file public (share with anyone)
app.post('/api/files/:fileId/share', async (req, res) => {
    try {
        const drive = getGoogleDriveClient();
        const { fileId } = req.params;
        const { role = 'reader' } = req.body;

        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: role,
                type: 'anyone',
            },
            supportsAllDrives: true,
        });

        // Get updated file info with sharing link
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, webViewLink, webContentLink',
            supportsAllDrives: true,
        });

        res.json({
            success: true,
            file: file.data,
            message: 'File shared successfully',
        });
    } catch (error) {
        console.error('Share file error:', error);
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
        message: 'Google Drive Upload API is running',
        timestamp: new Date().toISOString(),
    });
});

// Define Port
const port = process.env.PORT || 3000;

// Listen on defined port
app.listen(port, () => {
    console.log(`Google Drive Upload API started on port ${port}`);
});