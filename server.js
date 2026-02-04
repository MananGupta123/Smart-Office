const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helpers
const getFilePath = (id) => path.join(DATA_DIR, `${id}.json`);

// Routes

// GET /api/documents - List all documents
app.get('/api/documents', (req, res) => {
    fs.readdir(DATA_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read directory' });
        
        const docs = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const id = file.replace('.json', '');
                // Try to peek at content for title, else use ID
                try {
                    const content = JSON.parse(fs.readFileSync(getFilePath(id), 'utf8'));
                    return { id, title: content.title || 'Untitled Document', updatedAt: content.updatedAt };
                } catch (e) {
                    return { id, title: 'Corrupted File' };
                }
            });
            
        res.json(docs);
    });
});

// GET /api/documents/:id - Get specific document
app.get('/api/documents/:id', (req, res) => {
    const { id } = req.params;
    const filePath = getFilePath(id);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document not found' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });
        res.json(JSON.parse(data));
    });
});

// POST /api/documents - Create new document
app.post('/api/documents', (req, res) => {
    const id = Date.now().toString();
    const newDoc = {
        id,
        title: 'Untitled Document',
        content: {}, // TipTap JSON content
        updatedAt: new Date().toISOString()
    };

    fs.writeFile(getFilePath(id), JSON.stringify(newDoc, null, 2), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save file' });
        res.json(newDoc);
    });
});

// PUT /api/documents/:id - Update document
app.put('/api/documents/:id', (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const filePath = getFilePath(id);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document not found' });
    }

    const updatedDoc = {
        id,
        title: title || 'Untitled Document',
        content: content || {},
        updatedAt: new Date().toISOString()
    };

    fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save file' });
        res.json(updatedDoc);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Storage: ${DATA_DIR}`);
});
