# Smart Office - Offline POC

This is a proof-of-concept for an offline-first, LAN-based document editing system.

## Setup & Running

**Prerequisites:** Node.js installed.

1.  **Navigate to the server directory:**
    ```bash
    cd server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the server:**
    ```bash
    node server.js
    ```
4.  **Open the application:**
    Open your browser and navigate to `http://localhost:3001`

    *Note: The frontend is served statically by the Node server to simulate a single deployment unit.*

## Features Implemented (Option A)
*   **Offline Server:** Node.js + Express serving static assets and API.
*   **Storage:** File-system based JSON storage in `server/data/`.
*   **Editor:** Custom HTML5 `contenteditable` implementation with toolbar.
    *   Bold, Italic, Underline, Alignment.
    *   **Templates:** "Insert Template" button adds a sender/receiver block.
*   **Document Management:**
    *   Create new documents.
    *   Auto-save functionality (debounced).
    *   List view sorted by most recent.

## Part 1: Design & Approach

### 1. System Design

**Goal:** An offline-first, LAN-based document creation system.

#### Architecture
I propose a **Client-Server Architecture** deployed on a local LAN.

*   **Server (The Hub):** A Node.js server running on a designated machine in the office. It acts as the central source of truth for documents.
    *   **Runtime:** Node.js (for lightweight, efficient concurrent handling).
    *   **Database:** SQLite (file-based, zero-configuration, perfect for embedded/offline setups backup is just copying a file) or plain JSON files for simplicity in v1.
    *   **Network:** Serves the app over HTTP on the local network (e.g., `http://192.168.1.100:3000`).
*   **Client:** A React-based Single Page Application (SPA).
    *   **Logic:** Runs entirely in the user's browser.
    *   **Communication:** REST API for CRUD operations; WebSockets (Socket.io) for real-time status (e.g., "User B is editing this file") and streaming voice data.

#### Communication Flow
1.  **Load:** Browser requests `index.html` from Node server.
2.  **Data:** React app fetches document list/content via `GET /api/documents`.
3.  **Voice:** Audio is captured by the browser and streamed to the server via WebSockets for processing (since generic cloud APIs are blocked).
4.  **Save:** Client auto-saves via `PUT /api/documents/:id` every few seconds or on manual trigger.

### 2. Document Editing

#### Editor Choice
I would choose **TipTap** (based on ProseMirror).
*   **Why?** It is headless and stores data as **JSON**, not raw HTML. This is critical for robust saving/loading and future-proofing (e.g., transforming to PDF/DOCX, applying templates programmatically). `contenteditable` is too fragile for a standardized "Smart Office".
*   **Consistency:** TipTap ensures that "Bold" means the same JSON mark everywhere, ensuring highly standardized output.

#### Implementation
*   **Saving:** The editor state (JSON) is serialized and sent to the server.
*   **Loading:** The JSON is fetched and hydrated back into the editor.
*   **Formatting:** Standard Toolbar features (Bold, Tables, etc.) modify the internal JSON model, which React renders to the DOM.
*   **Structuring:** Specific "Blocks" (Sender Address, Receiver Block) would be custom Node types in ProseMirror/TipTap. This allows us to enforce constraints (e.g., "Subject" must always be H2).

### 3. Voice Input (Speech-to-Text)

Since we are **offline**, we cannot use the native Chrome Web Speech API reliably (as it often offloads to Google's cloud).

#### Approach: Server-Side Processing
1.  **Frontend:** capture audio using the `MediaRecorder API` or a library like `RecordRTC`.
2.  **Streaming:** Stream binary audio chunks over **Socket.io** to the Node.js server.
3.  **Backend AI:** Run a lightweight, offline STT model like **Vosk** or a quantized version of **OpenAI Whisper (cpp version)** on the server.
    *   *Why Server?* Browser-based WASM models exist but are heavy to download on every session and can lag the UI. A central LAN server usually has more stable power/compute.
4.  **Insertion:** The server sends back partial transcripts in real-time. The Frontend inserts text at the current cursor position.

### 4. Templates & Standardization

#### Storage
Templates are just **readonly JSON documents**.
*   Stored in a `templates/` directory or distinct database collection.

#### Workflow
1.  **Creation:** Admin creates a doc, creates placeholders (e.g., `{{SenderName}}`), and saves as "Template".
2.  **Usage:** User selects "Deep Dive Template". Backend clones the JSON of the template into a *new* document ID and returns it.
3.  **Enforcement:** We can use the Schema capabilities of ProseMirror to *lock* certain regions. For example, the "Header" area could be un-editable, ensuring the company logo and address format are never broken.

### 5. Key Trade-offs

#### What Not to Build in v1
*   **Real-time Collaborative Editing (Google Docs style):** Implementing Operational Transformation (OT) or CRDTs is overkill for v1. We will use a **"Locking"** mechanism (Check-in/Check-out) to prevent overwrites.
*   **Native Word Export:** We will rely on HTML-to-PDF or simple text export. Generating perfect `.docx` is complex.

#### Technical Shortcuts to Avoid
*   **Saving HTML directly:** Relying on `innerHTML` leads to messy, broken markup. We must store structured JSON.
*   **Browser-based AI:** Avoid relying on client hardware for voice recognition; it's too variable.

#### Future Complexity
*   **Conflict Resolution:** If we move away from locking, handling merge conflicts will be the hardest part.
*   **Large Documents:** Loading massive JSON blobs can be slow; we'd eventually need lazy loading or virtualization.

## Part 2: Answers to Bonus Questions

### 1. How would you scale this to multiple users?
**Concurrency:** The current file-system storage is okay for <10 users. For 50+ users, I would replace `fs.writeFile` with SQLite. SQLite is still serverless (file-based) but handles concurrent reads/writes much better than raw JSON files.
**Network:** Deploy the Node app on a central PC with a static IP (e.g., `192.168.1.50`). Other users on the LAN access it via that IP.

### 2. How would you add approvals and document locking?
**Locking:**
*   Add a `lockedBy: userId` field to the document JSON.
*   When a user opens a doc, API sends `POST /lock/:id`.
*   If locked, other users get "Read Only" mode.
*   Lock expires after 5 mins of inactivity (heartbeat).
**Approvals:**
*   Add `status: 'draft' | 'pending' | 'approved'` to the JSON.
*   "Submit" button changes status to `pending`.
*   Admin users see a "Review" queue.

### 3. How would you add AI later without breaking determinism?
**Determinism:** AI models can be non-deterministic. To fix this for legal docs:
*   **Human in the Loop:** AI *suggests* text (acting as a super-powered clipboard), but the human must "Accept" it. The *accepted* text is saved, not the prompt.
*   **Version Control:** Save the AI propmt + output version in the document metadata, so we can trace *why* it generated that text.
*   **Local Models:** Run quantized Llama/Whisper models on the server. They are slower but ensure data never leaves the room (crucial for this product).
