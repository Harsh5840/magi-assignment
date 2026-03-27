# Magi AI Content Editor

> An AI-powered content editor with progressive streaming, built with Next.js, TipTap, and GPT-4o.

---

## Demo

> Record a 2–3 min Loom showing: sidebar → type prompt → Generate → nodes appear live → toolbar edit → Export JSON.

---

## Quick Start

### Prerequisites
- Node.js 18+
- An OpenAI API key

### 1. Clone & install

```bash
git clone <your-repo>
cd magi-editor

# Backend
cd backend
cp .env.example .env
# Fill in OPENAI_API_KEY in .env
npm install

# Frontend
cd ../frontend
cp .env.local.example .env.local
npm install
```

### 2. Run

Open two terminals:

```bash
# Terminal 1 — backend (port 3001)
cd backend
npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend
npm run dev
```

Open `http://localhost:3000`. Pick a content type, describe what you want, hit **Generate**.

---

## Project Structure

```
magi-editor/
├── backend/
│   ├── src/
│   │   ├── server.ts                  # Express entry point
│   │   ├── routes/
│   │   │   └── generate.route.ts      # POST /api/generate + /api/generate/stream
│   │   ├── services/
│   │   │   └── openai.service.ts      # All LLM calls (generate + stream)
│   │   ├── lib/
│   │   │   ├── tiptap-builder.ts      # Node constructors + sanitizer
│   │   │   └── prompts.ts             # System/user prompt templates
│   │   └── types/
│   │       └── index.ts               # Shared types
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── app/
    │   ├── page.tsx                   # Root page — wires editor + sidebar + hook
    │   ├── layout.tsx
    │   └── globals.css                # TipTap prose styles + base
    ├── components/
    │   ├── editor/
    │   │   ├── MagiEditor.tsx         # Editor shell (toolbar + content + footer)
    │   │   ├── EditorToolbar.tsx      # All formatting buttons
    │   │   ├── editorConfig.ts        # TipTap extension list (single source of truth)
    │   │   └── extensions/
    │   │       └── TwoColumnLayout.ts # Custom two-column layout extension
    │   ├── sidebar/
    │   │   └── AISidebar.tsx          # Content type picker + prompt input + status
    │   └── ui/
    │       └── Header.tsx             # Top nav bar
    ├── lib/
    │   ├── api.ts                     # All fetch calls (generateContent, streamContent)
    │   └── useStreamGeneration.ts     # Generation state machine hook
    ├── types/
    │   └── index.ts                   # Mirrored types (matches backend)
    └── .env.local.example
```

**One rule**: if you're looking for where something happens, the folder name tells you.
- AI calls → `services/`
- Prompt text → `lib/prompts.ts`
- Node shapes → `lib/tiptap-builder.ts`
- API contract → `types/index.ts`
- All fetch → `frontend/lib/api.ts`
- All state → `frontend/lib/useStreamGeneration.ts`

---

## Architecture

```
Browser                          Backend                        OpenAI
──────────────────────────────────────────────────────────────────────
[AISidebar]
   │ prompt + contentType
   ▼
[useStreamGeneration hook]
   │
   │  POST /api/generate/stream (SSE)
   ├──────────────────────────────► [generate.route.ts]
   │                                       │
   │                                       │ streamDocument()
   │                                       ├──────────────────► GPT-4o (stream: true)
   │                                       │
   │                    SSE: node_append ◄─┤ (node-boundary parsing)
   │ ◄────────────────────────────────────┘
   │
   │ onNode(tiptapNode)
   ▼
[MagiEditor]
   │ editor.chain().insertContentAt()
   ▼
[TipTap renders node live]
```

### Backend modularization (OOP-focused)

The backend generation layer is now split into class-based modules so responsibilities are explicit and swappable:

- `OpenAIProvider` (`backend/src/services/providers/openai.provider.ts`): provider adapter implementing `LLMProvider`.
- `PromptFactory` (`backend/src/services/prompt/prompt-factory.ts`): prompt strategy builder per content type and mode.
- `JsonlNodeParser` (`backend/src/services/streaming/jsonl-node-parser.ts`): incremental stream parser that converts JSONL chunks into sanitized TipTap nodes.
- `GenerationService` (`backend/src/services/generation.service.ts`): application orchestrator for full generation and streaming.
- `openai.service.ts` (`backend/src/services/openai.service.ts`): compatibility facade for route handlers while internals are now modular.

This keeps routes thin and makes it straightforward to swap LLM providers or parsing strategy without touching HTTP handlers.

### System design principles used

1. Separation of concerns: transport (`routes`) is isolated from orchestration (`GenerationService`) and provider integration (`OpenAIProvider`).
2. Single responsibility: each class owns one axis of change (prompts, provider calls, parsing, orchestration).
3. Dependency inversion: `GenerationService` depends on `LLMProvider` abstraction, not OpenAI SDK directly.
4. Explicit contracts: stream event flow is stable (`start -> node_append* -> done/error`) and parser contract is JSONL node lines.
5. Fail-safe boundaries: model output is sanitized before editor insertion; malformed chunks are ignored rather than crashing generation.
6. Incremental evolution: compatibility facade preserved public API while internal architecture was upgraded.

## Assignment Coverage

1. TipTap editor (open-source extensions only): Complete.
2. AI generation for social + blog: Complete.
3. Structured rendering (including custom layout nodes): Complete.
4. Reasonable architecture across frontend/backend/AI layer: Complete.
5. Streaming progressive rendering: Complete for blog and landing page via SSE node streaming.
6. Additional content type (landing page): Complete.
7. Reference material as input context: Complete via optional sidebar reference block (text context).
8. WYSIWYG fidelity: Implemented with styled TipTap surface and custom layout nodes.
9. AI-assisted iteration on selected text: Complete (rewrite selection in place).
10. UX polish (progress, stop, status): Complete.

### Why SSE over WebSockets?

SSE is unidirectional (server → client), which is all we need. It's simpler to implement, works over HTTP/1.1, survives proxies/load balancers without configuration, and has native `EventSource` support in browsers. WebSockets are the right call if we add collaborative editing — not needed here.

### Streaming strategy: node-boundary parsing

The naive approach to streaming structured JSON is to wait for the full response, then parse it. That defeats the purpose.

The implementation here streams the model output and incrementally parses node objects from the `content` array using JSON brace-depth scanning (tracking strings/escapes so braces inside text don't break parsing). As soon as a complete top-level node object closes, it is sanitized and emitted to the client as `node_append`.

This gives us:
- Sub-second time-to-first-content on blog posts and landing pages
- Progressive rendering even while later nodes are still being generated
- Resilience to partial chunks and mid-sentence output

Tradeoff: this is still a custom parser tailored to the TipTap document shape. In production, I'd consider a dedicated streaming JSON parser package for broader edge-case coverage.

### AI-assisted iteration (selected text rewrite)

When the user highlights text in the editor, the sidebar switches to refine mode and shows the selected snippet. Submitting an instruction in this mode sends `selectedText` to the backend prompt builder, generates only replacement nodes, and splices those nodes back into the selected range rather than regenerating the whole document.

Demo flow:
1. Generate a blog post.
2. Highlight one paragraph or section.
3. In the sidebar, enter an instruction like "Make this shorter and more persuasive".
4. Optionally add source facts in "Reference material".
5. Click **Rewrite selection**.
6. Only the highlighted range is replaced.

### Why the `sanitizeNode()` function exists

LLMs occasionally hallucinate node types that don't exist in our schema, or produce nodes with missing required fields. If we naively pass these to TipTap, the editor crashes. `sanitizeNode()` walks the tree and drops anything malformed before it ever reaches the editor. Partial content > crash.

---

## Key Design Decisions & Tradeoffs

### 1. Social posts use full generation, not streaming

Social posts are 150–300 words — the full generation takes ~2 seconds. Streaming this would add complexity (SSE connection setup, state machine) for minimal perceived benefit. More importantly, GPT-4o's JSON mode (`response_format: { type: "json_object" }`) produces significantly more reliable structured output than the streaming path, which relies on prompt instructions to format correctly. Worth the 2-second wait.

### 2. Custom TwoColumnLayout extension vs. CSS tricks

We could fake multi-column with CSS on paragraphs, but that's a display hack — the document JSON wouldn't actually encode the layout structure, making it impossible to reliably export or re-render. The custom TipTap node extension means the layout is first-class in the document model. Any consumer of the exported JSON knows exactly what they're rendering.

### 3. Prompts are code, not strings

`lib/prompts.ts` treats prompts as versioned, named artifacts — not ad-hoc strings scattered through service files. Changing a prompt is as impactful as changing application logic, and should be reviewed the same way. The system prompt for each content type encodes the TipTap schema, layout expectations, and content guidelines in one readable place.

### 4. `sanitizeDocument()` as a trust boundary

We treat everything that comes back from the LLM as untrusted. Even with strict prompting and JSON mode, the model can hallucinate node types, omit required fields, or produce deeply nested structures that exceed TipTap's schema. Sanitization at the service boundary means components never have to defensively check node shapes.

### 5. Types duplicated between frontend and backend (intentional, for now)

In a Turborepo/Nx monorepo, `types/index.ts` would live in a shared package consumed by both apps. Here they're duplicated to keep the setup simple — a reviewer can run the project without any monorepo tooling. This is the first thing to fix before going to production.

---

## Extending This

### Adding a new content type

1. Add the type to `ContentType` in `backend/src/types/index.ts` (and mirror in `frontend/types/index.ts`)
2. Add a system prompt in `backend/src/lib/prompts.ts`
3. Add example prompts in `frontend/components/sidebar/AISidebar.tsx`
4. Done — the generation pipeline handles it automatically

### Swapping the LLM provider

All OpenAI calls are in `backend/src/services/openai.service.ts`. Replace the `openai` client with any other provider that supports streaming chat completions. The rest of the codebase doesn't touch the LLM.

### Adding collaborative editing

TipTap has a Y.js-based collaboration extension. The main changes needed:
- Backend: add a Y.js WebSocket server (e.g. `y-websocket`)
- Frontend: replace `useStreamGeneration`'s direct editor mutations with Y.js transactions so they're broadcast to all connected clients
- The SSE streaming endpoint stays the same — the "AI" would become another user applying changes via Y.js

### Deploying

- Backend: any Node.js host (Railway, Render, Fly.io). Set `OPENAI_API_KEY` and `FRONTEND_URL` env vars.
- Frontend: Vercel (zero config with Next.js). Set `NEXT_PUBLIC_API_URL` to your backend URL.

---

## What I'd Improve With More Time

1. **Streaming JSON parser** — Replace the newline-heuristic approach with `@streamparser/json` for more robust partial-document handling. Lower error rate, handles GPT outputting nodes with internal newlines.

2. **Optimistic UI** — Show a skeleton/shimmer in the editor while waiting for the first node (currently there's a small gap between "Generate" click and first content appearing).

3. **Selection streaming refinement** — Selected-text iteration currently runs as a targeted non-streaming rewrite for predictable range replacement. A next step is streaming the replacement into the selected range with cursor-safe position mapping while users keep editing elsewhere.

4. **Shared types package** — Move `types/index.ts` to a shared `packages/types` package in a Turborepo monorepo. One source of truth, TypeScript enforces the contract at build time.

5. **Prompt versioning** — Store prompt versions in the database and A/B test them. Quality of generated content is directly tied to prompt quality; you want to iterate on prompts like you iterate on code.

6. **Rate limiting + auth** — The `/api/generate` endpoint has no auth. For production, add JWT verification and per-user rate limiting (Redis + sliding window).

7. **Document persistence** — Add a simple CRUD API (`/api/documents`) backed by PostgreSQL. The TipTap JSON is already serialisable — it just needs somewhere to live.
