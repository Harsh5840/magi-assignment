import { TipTapNode } from "../../types/index";
import { sanitizeNode } from "../../lib/tiptap-builder";

export class JsonlNodeParser {
  private buffer = "";
  private readonly nodeTagPattern = /<node>([\s\S]*?)<\/node>/g;
  private inContentArray = false;

  push(chunk: string): TipTapNode[] {
    if (!chunk) return [];
    this.buffer += chunk;

    const nodes: TipTapNode[] = [];
    nodes.push(...this.consumeTaggedNodes());
    nodes.push(...this.consumeContentArrayNodes());
    nodes.push(...this.consumeRawObjects());

    return nodes;
  }

  flush(): TipTapNode[] {
    const nodes: TipTapNode[] = [];
    nodes.push(...this.consumeTaggedNodes());
    nodes.push(...this.consumeContentArrayNodes());
    nodes.push(...this.consumeRawObjects());

    const trailing = this.parseNodesFromCandidate(this.buffer.trim());
    this.buffer = "";
    this.inContentArray = false;

    nodes.push(...trailing);
    return nodes;
  }

  private consumeTaggedNodes(): TipTapNode[] {
    const nodes: TipTapNode[] = [];
    let lastConsumed = -1;

    this.nodeTagPattern.lastIndex = 0;

    let match = this.nodeTagPattern.exec(this.buffer);
    while (match) {
      const candidate = this.extractJsonObject(match[1]?.trim() ?? "");
      if (candidate) {
        nodes.push(...this.parseNodesFromCandidate(candidate));
      }

      lastConsumed = match.index + match[0].length;
      match = this.nodeTagPattern.exec(this.buffer);
    }

    if (lastConsumed >= 0) {
      this.buffer = this.buffer.slice(lastConsumed);
    }

    return nodes;
  }

  private consumeContentArrayNodes(): TipTapNode[] {
    const nodes: TipTapNode[] = [];

    if (!this.inContentArray) {
      const contentKeyIndex = this.buffer.indexOf('"content"');
      if (contentKeyIndex !== -1) {
        const arrayStart = this.buffer.indexOf("[", contentKeyIndex);
        if (arrayStart !== -1) {
          this.inContentArray = true;
          this.buffer = this.buffer.slice(arrayStart + 1);
        }
      }
    }

    if (!this.inContentArray) return nodes;

    let inString = false;
    let escaping = false;
    let objectDepth = 0;
    let nodeStart = -1;
    let consumedUpto = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (objectDepth === 0 && ch === "]") {
        this.inContentArray = false;
        consumedUpto = i + 1;
        break;
      }

      if (ch === "{") {
        if (objectDepth === 0) nodeStart = i;
        objectDepth += 1;
        continue;
      }

      if (ch === "}") {
        if (objectDepth > 0) objectDepth -= 1;

        if (objectDepth === 0 && nodeStart !== -1) {
          const candidate = this.buffer.slice(nodeStart, i + 1);
          nodes.push(...this.parseNodesFromCandidate(candidate));
          consumedUpto = i + 1;
          nodeStart = -1;
        }
      }
    }

    if (objectDepth > 0 && nodeStart >= 0) {
      this.buffer = this.buffer.slice(nodeStart);
      return nodes;
    }

    this.buffer = this.buffer.slice(consumedUpto);
    return nodes;
  }

  private consumeRawObjects(): TipTapNode[] {
    // Fallback for model outputs that stream one JSON object after another
    // without doc wrapper or node tags.
    const nodes: TipTapNode[] = [];
    let inString = false;
    let escaping = false;
    let depth = 0;
    let start = -1;
    let consumedUpto = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === "}") {
        if (depth > 0) depth -= 1;
        if (depth === 0 && start !== -1) {
          const candidate = this.buffer.slice(start, i + 1);
          const parsedNodes = this.parseNodesFromCandidate(candidate);
          if (parsedNodes.length) {
            nodes.push(...parsedNodes);
            consumedUpto = i + 1;
          }
          start = -1;
        }
      }
    }

    if (depth > 0 && start >= 0) {
      this.buffer = this.buffer.slice(start);
      return nodes;
    }

    this.buffer = this.buffer.slice(consumedUpto);
    return nodes;
  }

  private parseNodesFromCandidate(candidate: string): TipTapNode[] {
    if (!candidate) return [];

    const jsonCandidate = this.extractJsonObject(candidate);
    if (!jsonCandidate) return [];

    try {
      const parsed = JSON.parse(jsonCandidate);
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { type?: string }).type === "doc" &&
        Array.isArray((parsed as { content?: unknown[] }).content)
      ) {
        return ((parsed as { content: unknown[] }).content ?? [])
          .map((node) => sanitizeNode(node))
          .filter((node): node is TipTapNode => node !== null);
      }

      const node = sanitizeNode(parsed);
      return node ? [node] : [];
    } catch {
      return [];
    }
  }

  private extractJsonObject(line: string): string | null {
    const start = line.indexOf("{");
    const end = line.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return line.slice(start, end + 1);
  }
}
