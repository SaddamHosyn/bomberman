#!/usr/bin/env node

/**
 * Simple HTTP server for development - Pure Node.js (no external dependencies)
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
    try {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        
        // Remove query parameters
        filePath = filePath.split('?')[0];
        
        // Security: prevent directory traversal
        if (filePath.includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        // Handle favicon.ico
        if (filePath === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
        }
        
        const fullPath = join(__dirname, filePath);
        const ext = extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        const data = await readFile(fullPath);
        
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(data);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404);
            res.end('File not found');
        } else if (error.code === 'EISDIR') {
            // Handle directory requests by returning index.html
            try {
                const indexPath = join(__dirname, 'index.html');
                const data = await readFile(indexPath);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            } catch {
                res.writeHead(404);
                res.end('File not found');
            }
        } else {
            res.writeHead(500);
            res.end('Server error');
        }
    }
});

server.listen(PORT, () => {
    console.log(`JS development server running at http://localhost:${PORT}`);
    console.log('Using only the mini-framework - no external dependencies!');
    console.log('Serving files from:', __dirname);
});

process.on('SIGINT', () => {
    console.log('\nShutting down development server...');
    server.close(() => {
        console.log('Development server closed');
        process.exit(0);
    });
});
