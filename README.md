# Smart Office

A quick POC for the offline document editor problem. Built with Node.js and vanilla JS.

## How to Run

1. `npm install`
2. `node server.js`
3. Open `http://localhost:3001`

That's it. The server hosts both the API and the frontend.

---

## My Approach (Design Note)

### System Design

The core idea is simple: one Node.js server acts as the "hub" on the LAN. Everyone's browser connects to it. No internet needed.

I went with Express for the backend because it's fast to set up and I'm familiar with it. For storage, I'm just using JSON files on disk. It's not fancy, but for a v1 POC in an air-gapped environment, it's actually ideal – you can literally back up the whole database by copying a folder.

The frontend is vanilla JS. I considered React/Vite, but honestly, for a POC that needs to "just work" without a build step, plain HTML/CSS/JS felt like the right call. Less can go wrong.

### Document Editing

I used the browser's native `contenteditable` for this POC. It's quick and dirty but does the job for demonstrating the flow.

If I were building this for real, I'd swap it out for TipTap (or ProseMirror directly). The big reason is data format – `contenteditable` gives you messy HTML, while TipTap stores everything as clean JSON. That matters a lot when you need to enforce templates or export to different formats.

For now, I'm saving the HTML string inside a JSON wrapper. Not perfect, but it shows the save/load cycle works.

### Voice Input

The prompt mentioned voice dictation. Since we're offline, the usual Web Speech API is a no-go (it secretly calls Google's servers).

My plan for a real implementation:
1. Capture audio in the browser (MediaRecorder API works fine for this)
2. Stream it to the server over WebSocket
3. Run Vosk or Whisper.cpp on the server – both work completely offline

I didn't implement this in the POC because setting up Vosk properly takes a bit of time, but the architecture is straightforward.

### Templates

I added a basic "Insert Template" button that drops in a sender/receiver block. It's a simple `insertHTML` call.

For a production version, I'd store templates as separate JSON files and let users pick from a list. The interesting part would be locking certain sections so people can't accidentally delete the company header or mess up the format.

### Trade-offs & What I'd Skip in v1

**Not building:**
- Real-time collab (Google Docs style). Way too complex for v1. A simple "lock file when editing" approach is enough.
- Perfect .docx export. I added a quick Word export using the HTML-to-doc trick, but it's not going to match MS Word output exactly.

**Avoiding:**
- Storing raw HTML without structure. It gets messy fast.
- Client-side AI for voice. Too unreliable across different machines.

**Future headaches:**
- Merge conflicts if we ever allow simultaneous editing
- Performance on large documents

---

## Bonus Questions

### Scaling to multiple users?

The JSON file approach works fine for maybe 10 users. Beyond that, I'd switch to SQLite – still file-based and zero-config, but handles concurrent writes properly.

For network setup, just run the server on a machine with a static IP and have everyone bookmark that address.

### Approvals and locking?

For locking: add a `lockedBy` field to each document. When someone opens it, they "claim" it. If someone else tries to open, they get read-only mode. Add a heartbeat so abandoned locks expire after 5 minutes.

For approvals: add a `status` field (draft/pending/approved). "Submit for Review" button flips it to pending. Admins see a queue of pending docs.

### Adding AI without breaking determinism?

The key is keeping humans in control. AI suggests text, user explicitly accepts it. What gets saved is the accepted text, not the AI output directly.

Also: log everything. Store the prompt, the model version, the output. That way if something weird shows up in a document months later, you can trace back exactly what happened.

And obviously, for a product like this, the AI has to run locally. No cloud APIs.

---

## What I'd Improve Next

- Swap contenteditable for TipTap
- Add actual template management (create/edit/delete templates)
- Implement the voice input with Vosk
- Better error handling and offline indicators
- Delete document functionality
