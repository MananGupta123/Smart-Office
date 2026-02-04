const API_URL = '/api/documents';
let currentDocId = null;
let saveTimeout = null;

const docListEl = document.getElementById('docList');
const editorEl = document.getElementById('editor');
const titleInput = document.getElementById('docTitle');
const saveStatusEl = document.getElementById('saveStatus');
const saveBtn = document.getElementById('saveBtn');
const newDocBtn = document.getElementById('newDocBtn');

async function init() {
    await loadDocumentList();
    
    editorEl.addEventListener('input', scheduleAutoSave);
    titleInput.addEventListener('input', scheduleAutoSave);
    saveBtn.addEventListener('click', () => saveDocument(true));
    newDocBtn.addEventListener('click', createNewDocument);
}

window.format = (command) => {
    document.execCommand(command, false, null);
    editorEl.focus();
};

window.execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    editorEl.focus();
};

window.insertTemplate = () => {
    const templateHtml = `
        <div class="template-block">
            <p><strong>From:</strong> [Sender Name]</p>
            <p><strong>To:</strong> [Receiver Name]</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <h2>Subject: [Type Subject Here]</h2>
        <p>Dear [Name],</p>
        <p>Start typing content here...</p>
    `;
    document.execCommand('insertHTML', false, templateHtml);
};

async function loadDocumentList() {
    docListEl.innerHTML = '<div class="loading">Loading...</div>';
    try {
        const res = await fetch(API_URL);
        const docs = await res.json();
        renderDocList(docs);
    } catch (e) {
        docListEl.innerHTML = '<div class="error">Offline / Server Error</div>';
        console.error(e);
    }
}

function renderDocList(docs) {
    docListEl.innerHTML = '';
    docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    docs.forEach(doc => {
        const div = document.createElement('div');
        div.className = `doc-item ${doc.id === currentDocId ? 'active' : ''}`;
        div.textContent = doc.title || 'Untitled';
        div.onclick = () => loadDocument(doc.id);
        docListEl.appendChild(div);
    });
}

async function createNewDocument() {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const doc = await res.json();
        await loadDocumentList();
        loadDocument(doc.id);
    } catch (e) {
        alert('Failed to create document');
    }
}

async function loadDocument(id) {
    if (currentDocId === id) return;
    
    currentDocId = id;
    saveStatusEl.textContent = 'Loading...';
    
    document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
    loadDocumentList();

    try {
        const res = await fetch(`${API_URL}/${id}`);
        const doc = await res.json();
        
        titleInput.value = doc.title;
        editorEl.innerHTML = doc.content.html || doc.content || '<p>Start typing...</p>'; 
        saveStatusEl.textContent = 'Loaded';
    } catch (e) {
        editorEl.innerHTML = '<p>Error loading document</p>';
    }
}

function scheduleAutoSave() {
    saveStatusEl.textContent = 'Unsaved changes...';
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDocument, 2000);
}

async function saveDocument(force = false) {
    if (!currentDocId) return;

    saveStatusEl.textContent = 'Saving...';
    
    const data = {
        title: titleInput.value,
        content: { html: editorEl.innerHTML }
    };

    try {
        await fetch(`${API_URL}/${currentDocId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        saveStatusEl.textContent = 'All changes saved';
        
    } catch (e) {
        saveStatusEl.textContent = 'Error saving!';
    }
}

window.exportToPDF = () => {
    window.print();
};

window.exportToWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
        "xmlns:w='urn:schemas-microsoft-com:office:word' " +
        "xmlns='http://www.w3.org/TR/REC-html40'> " +
        "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + document.getElementById("editor").innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = (titleInput.value || 'document') + '.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
};

init();
