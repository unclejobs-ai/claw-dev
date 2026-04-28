/**
 * Clipboard image capture — platform-specific shells out to pbpaste / xclip /
 * powershell to grab the current clipboard image and synthesise a
 * WorkShellComposerImageAttachment-equivalent payload.
 *
 * The TUI composer triggers this on a hotkey (Ctrl+V) when the OS-level
 * clipboard contains an image MIME; on text-only clipboards we degrade to
 * the existing text paste path.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";

export type ClipboardImageAttachment = {
  readonly type: "image";
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly path: string;
  readonly displayName: string;
};

export type ClipboardImageError = {
  readonly status: "no-image" | "unsupported" | "failed";
  readonly reason: string;
};

export type ClipboardImageResult =
  | { readonly status: "ok"; readonly attachment: ClipboardImageAttachment }
  | ClipboardImageError;

const TARGET_MIME = "image/png";

function captureMacOs(): ClipboardImageResult {
  const dir = mkdtempSync(join(tmpdir(), "uc-clip-"));
  const path = join(dir, "clip.png");
  try {
    execFileSync("pbpaste", ["-Prefer", "image"], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    return { status: "failed", reason: `pbpaste exec failed: ${(error as Error).message}` };
  }
  try {
    execFileSync(
      "osascript",
      [
        "-e",
        `set imageData to the clipboard as «class PNGf»`,
        "-e",
        `set f to open for access POSIX file "${path}" with write permission`,
        "-e",
        `write imageData to f`,
        "-e",
        `close access f`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    return { status: "no-image", reason: `clipboard does not hold an image: ${(error as Error).message}` };
  }
  if (!existsSync(path)) {
    rmSync(dir, { recursive: true, force: true });
    return { status: "no-image", reason: "no image file produced" };
  }
  const bytes = readFileSync(path);
  rmSync(dir, { recursive: true, force: true });
  return {
    status: "ok",
    attachment: {
      type: "image",
      mimeType: TARGET_MIME,
      dataUrl: `data:${TARGET_MIME};base64,${bytes.toString("base64")}`,
      path,
      displayName: "clipboard.png",
    },
  };
}

function captureLinux(): ClipboardImageResult {
  try {
    const bytes = execFileSync("xclip", ["-selection", "clipboard", "-t", "image/png", "-o"], {
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    if (bytes.length === 0) {
      return { status: "no-image", reason: "xclip returned empty buffer" };
    }
    return {
      status: "ok",
      attachment: {
        type: "image",
        mimeType: TARGET_MIME,
        dataUrl: `data:${TARGET_MIME};base64,${bytes.toString("base64")}`,
        path: "(xclip)",
        displayName: "clipboard.png",
      },
    };
  } catch (error) {
    return { status: "failed", reason: `xclip exec failed: ${(error as Error).message}` };
  }
}

function captureWindows(): ClipboardImageResult {
  const dir = mkdtempSync(join(tmpdir(), "uc-clip-"));
  const path = join(dir, "clip.png");
  const ps = `Add-Type -AssemblyName System.Windows.Forms;` +
    `$img = [System.Windows.Forms.Clipboard]::GetImage();` +
    `if ($img -ne $null) { $img.Save("${path.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png) } else { exit 1 }`;
  try {
    execFileSync("powershell.exe", ["-Command", ps], { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    rmSync(dir, { recursive: true, force: true });
    return { status: "no-image", reason: "clipboard does not hold an image" };
  }
  if (!existsSync(path)) {
    rmSync(dir, { recursive: true, force: true });
    return { status: "no-image", reason: "no image file produced" };
  }
  const bytes = readFileSync(path);
  rmSync(dir, { recursive: true, force: true });
  return {
    status: "ok",
    attachment: {
      type: "image",
      mimeType: TARGET_MIME,
      dataUrl: `data:${TARGET_MIME};base64,${bytes.toString("base64")}`,
      path,
      displayName: "clipboard.png",
    },
  };
}

export function captureClipboardImage(): ClipboardImageResult {
  switch (platform()) {
    case "darwin":
      return captureMacOs();
    case "linux":
      return captureLinux();
    case "win32":
      return captureWindows();
    default:
      return { status: "unsupported", reason: `clipboard capture not wired for platform ${platform()}` };
  }
}
