import { tool } from "ai";
import { z } from "zod";
import { native } from "../lib/native";
import { checkWritableCanonical } from "../lib/security";
import { resolvePath, type ToolContext } from "./context";

type EditResult =
  | { ok: true; replacements: number; bytesWritten: number; path: string }
  | { error: string; path: string };

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

async function applyEdits(
  abs: string,
  edits: { old_string: string; new_string: string; replace_all?: boolean }[],
  _kind: "edit" | "multi_edit",
  readCache: Map<string, { size: number; hash: number }>,
): Promise<EditResult> {
  const r = await native.readFile(abs);
  if (r.kind === "binary")
    return { error: "binary file refused", path: abs };
  if (r.kind === "toolarge")
    return { error: `file too large (${r.size} bytes)`, path: abs };

  const original = r.content;

  let content = original;
  let totalReplacements = 0;
  for (const { old_string, new_string, replace_all } of edits) {
    if (replace_all) {
      const before = content.split(old_string).length - 1;
      content = content.split(old_string).join(new_string);
      totalReplacements += before;
    } else {
      const idx = content.indexOf(old_string);
      if (idx === -1)
        return {
          error: `old_string not found`,
          path: abs,
        };
      content = content.slice(0, idx) + new_string + content.slice(idx + old_string.length);
      totalReplacements++;
    }
  }

  if (content === original) {
    return {
      ok: true,
      replacements: 0,
      bytesWritten: content.length,
      path: abs,
    };
  }

  try {
    await native.writeFile(abs, content);
    readCache.set(abs, { size: content.length, hash: djb2(content) });
    return {
      ok: true,
      replacements: totalReplacements,
      bytesWritten: content.length,
      path: abs,
    };
  } catch (err) {
    return { error: String(err), path: abs };
  }
}

export type EditToolOptions = {
  autoEdit?: boolean;
};

export function buildEditTools(ctx: ToolContext, opts: EditToolOptions = {}) {
  const { autoEdit } = opts;

  return {
    edit: tool({
      description:
        "Replace an exact string in a file. Requires read_file on this path first in the current session — this prevents blind edits. `old_string` must be unique in the file unless `replace_all: true`. Asks for user approval before writing.",
      inputSchema: z.object({
        path: z.string(),
        old_string: z
          .string()
          .describe("Exact substring to replace. Must be unique unless replace_all."),
        new_string: z.string().describe("Replacement substring."),
        replace_all: z.boolean().optional(),
      }),
      needsApproval: !autoEdit,
      execute: async ({ path, old_string, new_string, replace_all }) => {
        const reqPath = resolvePath(path, ctx.getCwd());
        const safety = await checkWritableCanonical(reqPath, native.canonicalize);
        if (!safety.ok) return { error: safety.reason, path: reqPath };
        const abs = safety.canonical;
        if (!ctx.readCache.has(abs)) {
          return {
            error:
              "must call read_file on this path first (read-before-edit invariant).",
            path: abs,
          };
        }
        return applyEdits(
          abs,
          [{ old_string, new_string, replace_all }],
          "edit",
          ctx.readCache,
        );
      },
    }),

    multi_edit: tool({
      description:
        "Apply several exact-string replacements to a single file atomically. Each edit is applied in order to the running buffer; if any edit's old_string is missing or non-unique, the whole batch aborts before writing. Requires prior read_file on the path. Asks for user approval before writing.",
      inputSchema: z.object({
        path: z.string(),
        edits: z
          .array(
            z.object({
              old_string: z.string(),
              new_string: z.string(),
              replace_all: z.boolean().optional(),
            }),
          )
          .min(1),
      }),
      needsApproval: !autoEdit,
      execute: async ({ path, edits }) => {
        const reqPath = resolvePath(path, ctx.getCwd());
        const safety = await checkWritableCanonical(reqPath, native.canonicalize);
        if (!safety.ok) return { error: safety.reason, path: reqPath };
        const abs = safety.canonical;
        if (!ctx.readCache.has(abs)) {
          return {
            error:
              "must call read_file on this path first (read-before-edit invariant).",
            path: abs,
          };
        }
        return applyEdits(abs, edits, "multi_edit", ctx.readCache);
      },
    }),
  } as const;
}