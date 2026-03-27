"use client";

/**
 * AISidebar.tsx
 *
 * The right-hand panel where users:
 *  1. Pick a content type (social post, blog post, landing page)
 *  2. Describe what they want
 *  3. Hit Generate (or Stop if already generating)
 *  4. See generation status / node count
 *
 * Also handles the "iterate on selection" flow — if the editor has selected
 * text, the sidebar shows a refine mode instead of a full generation.
 */

import { useState } from "react";
import {
  Sparkles,
  Square,
  Briefcase,
  FileText,
  Layout,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ContentType } from "../../types/index";
import { GenerationStatus } from "../../lib/useStreamGeneration";

interface ContentTypeOption {
  value: ContentType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CONTENT_TYPES: ContentTypeOption[] = [
  {
    value: "social_post",
    label: "Social Post",
    description: "LinkedIn, Twitter",
    icon: <Briefcase size={14} />,
  },
  {
    value: "blog_post",
    label: "Blog Post",
    description: "Long-form article",
    icon: <FileText size={14} />,
  },
  {
    value: "landing_page",
    label: "Landing Page",
    description: "Marketing page",
    icon: <Layout size={14} />,
  },
];

const EXAMPLE_PROMPTS: Record<ContentType, string[]> = {
  social_post: [
    "Why most SaaS companies fail at content marketing (and how we fixed it)",
    "3 lessons from launching our AI product to 10k users in 30 days",
    "Hot take: async work doesn't work for early-stage startups",
  ],
  blog_post: [
    "A deep dive into progressive rendering for AI-generated content",
    "How we cut our LLM costs by 60% without sacrificing quality",
    "The complete guide to building AI-native marketing workflows",
  ],
  landing_page: [
    "AI-powered marketing platform for B2B SaaS companies",
    "The fastest way to create on-brand content at scale",
    "Turn your product updates into engaging marketing campaigns",
  ],
};

interface AISidebarProps {
  status: GenerationStatus;
  error: string | null;
  nodeCount: number;
  selectedText?: string;
  onGenerate: (
    prompt: string,
    contentType: ContentType,
    referenceContext?: string
  ) => Promise<void> | void;
  onStop: () => void;
  onReset: () => void;
}

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_CHARS = 20000;
const MAX_REFERENCE_CONTEXT_CHARS = 20000;

function isTextExtractable(file: File): boolean {
  const lower = file.name.toLowerCase();

  if (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/xml" ||
    file.type === "text/csv"
  ) {
    return true;
  }

  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json") ||
    lower.endsWith(".xml")
  );
}

async function buildAttachmentContext(files: File[]): Promise<string> {
  if (files.length === 0) return "";

  let remaining = MAX_ATTACHMENT_CHARS;
  const blocks: string[] = [];

  for (const file of files) {
    if (!isTextExtractable(file)) continue;

    const raw = await file.text();
    const cleaned = raw.replace(/\u0000/g, "").trim();
    if (!cleaned) continue;

    if (remaining <= 0) break;

    const excerpt = cleaned.slice(0, remaining);
    remaining -= excerpt.length;

    blocks.push(
      `Source file: ${file.name}\n---\n${excerpt}${excerpt.length < cleaned.length ? "\n[truncated]" : ""}`
    );
  }

  if (blocks.length === 0) return "";
  return `Attached reference material:\n\n${blocks.join("\n\n")}`;
}

export function AISidebar({
  status,
  error,
  nodeCount,
  selectedText,
  onGenerate,
  onStop,
  onReset,
}: AISidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog_post");
  const [referenceContext, setReferenceContext] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const isGenerating = status === "generating" || isPreparing;
  const isDone = status === "done";
  const hasError = status === "error";

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      setIsPreparing(true);
      setAttachmentError(null);

      const attachmentContext = await buildAttachmentContext(attachments);

      const mergedReference = [referenceContext.trim(), attachmentContext]
        .filter(Boolean)
        .join("\n\n");

      const safeReference = mergedReference.slice(0, MAX_REFERENCE_CONTEXT_CHARS);
      if (safeReference.length < mergedReference.length) {
        setAttachmentError(
          `Reference context exceeded ${MAX_REFERENCE_CONTEXT_CHARS} chars and was truncated.`
        );
      }

      await onGenerate(
        prompt.trim(),
        contentType,
        safeReference || undefined
      );
    } catch {
      setAttachmentError("Could not process one or more attachments.");
    } finally {
      setIsPreparing(false);
    }
  };

  const handleAttachments = (files: FileList | null) => {
    if (!files) return;

    const incoming = Array.from(files);
    const next = [...attachments, ...incoming].slice(0, MAX_ATTACHMENTS);

    const oversized = next.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setAttachmentError(
        `${oversized.name} is larger than ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`
      );
      return;
    }

    const unsupported = next.find((file) => !isTextExtractable(file));
    if (unsupported) {
      setAttachmentError(
        `${unsupported.name} is not supported yet. Use txt, md, csv, json, or xml.`
      );
      return;
    }

    setAttachmentError(null);
    setAttachments(next);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExample = (example: string) => {
    setPrompt(example);
    setShowExamples(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isGenerating) {
      handleGenerate();
    }
  };

  return (
    <aside className="w-full lg:w-92 xl:w-96 shrink-0 bg-zinc-950/90 border-t border-white/10 lg:border-t-0 lg:border-l lg:border-white/10 flex flex-col h-[42vh] lg:h-full overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute top-1/3 -left-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>
      {/* Header */}
      <div className="relative z-10 px-5 py-4 border-b border-white/10 bg-linear-to-b from-zinc-900/80 to-transparent">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-300/20 flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.2)]">
            <Sparkles size={14} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">AI Generate</h2>
            <p className="text-xs text-zinc-400">Assistant for structured drafts</p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-2 uppercase tracking-[0.16em]">
            Reference material (optional)
          </label>
          <textarea
            value={referenceContext}
            onChange={(e) => setReferenceContext(e.target.value)}
            placeholder="Paste notes, source facts, brand voice guidance, or constraints..."
            disabled={isGenerating}
            rows={4}
            maxLength={MAX_REFERENCE_CONTEXT_CHARS}
            className="
              w-full bg-zinc-900/80 border border-white/10 rounded-xl px-3 py-2.5
              text-xs text-zinc-300 placeholder-zinc-500 resize-none
              focus:outline-none focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/10
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            {referenceContext.length}/{MAX_REFERENCE_CONTEXT_CHARS} chars
          </p>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Selection mode banner */}
        {selectedText && (
          <div className="bg-linear-to-r from-amber-400/12 to-orange-300/6 border border-amber-300/25 rounded-xl p-3.5">
            <p className="text-xs text-amber-400 font-medium mb-1">
              Refine selection
            </p>
            <p className="text-xs text-zinc-400 line-clamp-2 font-mono">
              &quot;{selectedText}&quot;
            </p>
            <p className="text-[11px] text-zinc-500 mt-2">
              Add an instruction below and click Rewrite selection.
            </p>
          </div>
        )}

        {/* Content type selector */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-2 uppercase tracking-[0.16em]">
            Content Type
          </label>
          <div className="space-y-2">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                disabled={isGenerating}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                  ${
                    contentType === ct.value
                      ? "bg-linear-to-r from-amber-400/15 to-orange-300/10 border border-amber-300/35 text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                      : "bg-zinc-900/70 border border-white/8 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                  }
                  ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <span
                  className={
                    contentType === ct.value ? "text-amber-400" : "text-zinc-500"
                  }
                >
                  {ct.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{ct.label}</div>
                  <div className="text-[11px] text-zinc-500">{ct.description}</div>
                </div>
                {contentType === ct.value && (
                  <ChevronRight size={12} className="text-amber-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.16em]">
              {selectedText ? "Instruction" : "Describe your content"}
            </label>
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs px-2 py-1 rounded-md border border-amber-300/20 text-amber-300/80 hover:text-amber-200 hover:border-amber-300/40 transition-colors"
            >
              Examples
            </button>
          </div>

          <div className="mb-3 bg-zinc-900/75 border border-white/8 rounded-xl p-3">
            <label className="block text-[11px] font-medium text-zinc-400 mb-1 uppercase tracking-[0.16em]">
              Attach files (optional)
            </label>
            <input
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.xml,text/*,application/json,application/xml"
              disabled={isGenerating}
              onChange={(e) => handleAttachments(e.target.files)}
              className="w-full text-xs text-zinc-500 file:mr-2 file:px-2.5 file:py-1.5 file:rounded-lg file:border file:border-white/10 file:bg-zinc-800 file:text-zinc-200 file:cursor-pointer"
            />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between text-[11px] text-zinc-300 bg-zinc-800/50 border border-white/10 px-2 py-1.5 rounded-lg"
                  >
                    <span className="truncate mr-2">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-zinc-500 hover:text-zinc-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachmentError && (
              <p className="mt-1 text-[11px] text-red-400">{attachmentError}</p>
            )}
          </div>

          {showExamples && (
            <div className="mb-2 space-y-1 rounded-xl border border-white/8 bg-zinc-900/70 p-2">
              {EXAMPLE_PROMPTS[contentType].map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleExample(ex)}
                  className="w-full text-left text-xs text-zinc-400 hover:text-zinc-100 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-all line-clamp-2"
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedText
                ? "e.g. Make this more concise and punchy..."
                : `Describe the ${CONTENT_TYPES.find((c) => c.value === contentType)?.label.toLowerCase()} you want to create...`
            }
            disabled={isGenerating}
            rows={5}
            className="
              w-full bg-zinc-900/80 border border-white/10 rounded-xl px-3 py-2.5
              text-sm text-zinc-100 placeholder-zinc-500 resize-none
              focus:outline-none focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/10 focus:bg-zinc-900
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            Ctrl/Cmd + Enter to generate
          </p>
        </div>

        {/* Status display */}
        {isGenerating && (
          <div className="bg-zinc-900/85 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">
                {isPreparing ? "Preparing context..." : "Generating..."}
              </span>
              <span className="text-xs text-amber-400 font-mono">
                {nodeCount} nodes
              </span>
            </div>
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400/60 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {isDone && !hasError && (
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-300/25 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={13} />
            <span>Generated {nodeCount} content blocks</span>
          </div>
        )}

        {hasError && (
          <div className="bg-red-400/10 border border-red-300/25 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-red-400 mb-1">
              <AlertCircle size={13} />
              <span className="font-medium">Generation failed</span>
            </div>
            <p className="text-xs text-zinc-500">{error}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="relative z-10 px-5 py-4 border-t border-white/10 bg-zinc-950/90 space-y-2">
        {isGenerating ? (
          <button
            onClick={onStop}
            className="
              w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              bg-zinc-900 border border-white/10 text-zinc-300
              hover:bg-zinc-800 hover:text-white
              transition-all text-sm font-medium
            "
          >
            <Square size={13} />
            Stop generating
          </button>
        ) : (
          <>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                bg-linear-to-r from-amber-300 to-orange-300 text-zinc-950 font-semibold text-sm
                hover:from-amber-200 hover:to-orange-200 active:from-amber-400 active:to-orange-400
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all shadow-[0_8px_28px_rgba(251,191,36,0.22)]
              "
            >
              <Sparkles size={14} />
              {selectedText
                ? "Rewrite selection"
                : isDone
                ? "Regenerate"
                : "Generate"}
            </button>

            {isDone && (
              <button
                onClick={onReset}
                className="
                  w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-transparent border border-white/10 text-zinc-400
                  hover:text-zinc-200 hover:border-white/20
                  transition-all text-sm
                "
              >
                <RefreshCw size={13} />
                Clear & start over
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
