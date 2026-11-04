/** Media helpers: file → MediaRef, IndexedDB blob → object URL with a small
 *  LRU cache so avatars/wallpapers are never decoded twice. */

import { useEffect, useState } from "react";
import { getBlob, putBlob } from "./db";
import type { MediaKind, MediaRef } from "../types";

const MAX_URLS = 64;
const urlCache = new Map<string, string>();

export function newId(prefix = "m"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function kindFor(mime: string, name: string): MediaKind {
  if (mime === "image/gif" || name.toLowerCase().endsWith(".gif")) return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number } | undefined> {
  if (!blob.type.startsWith("image/")) return undefined;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Persist a picked file and return a reference safe to store in app state. */
export async function storeFile(file: File): Promise<MediaRef> {
  const id = newId("blob");
  await putBlob(id, file);
  const dims = await imageSize(file);
  return {
    blobId: id,
    kind: kindFor(file.type, file.name),
    name: file.name || "file",
    size: file.size,
    mime: file.type || "application/octet-stream",
    width: dims?.width,
    height: dims?.height,
  };
}

/** Store an arbitrary blob (used for generated demo photos). */
export async function storeBlob(blob: Blob, name: string): Promise<MediaRef> {
  const file = new File([blob], name, { type: blob.type });
  return storeFile(file);
}

function remember(id: string, url: string): void {
  if (urlCache.size >= MAX_URLS) {
    const oldest = urlCache.keys().next().value;
    if (oldest) {
      const stale = urlCache.get(oldest);
      if (stale) URL.revokeObjectURL(stale);
      urlCache.delete(oldest);
    }
  }
  urlCache.set(id, url);
}

export async function resolveUrl(blobId: string): Promise<string | undefined> {
  const cached = urlCache.get(blobId);
  if (cached) {
    // refresh LRU position
    urlCache.delete(blobId);
    urlCache.set(blobId, cached);
    return cached;
  }
  const blob = await getBlob(blobId);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  remember(blobId, url);
  return url;
}

/** React hook wrapper around resolveUrl. */
export function useMediaUrl(blobId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (blobId ? urlCache.get(blobId) : undefined));

  useEffect(() => {
    if (!blobId) {
      setUrl(undefined);
      return;
    }
    const cached = urlCache.get(blobId);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    void resolveUrl(blobId).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [blobId]);

  return url;
}

/** Draw a soft gradient artwork so the demo has real photos without assets. */
export async function makeGradientPhoto(hue: number, label: string): Promise<MediaRef> {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, `hsl(${hue} 85% 62%)`);
  grad.addColorStop(0.55, `hsl(${(hue + 40) % 360} 78% 45%)`);
  grad.addColorStop(1, `hsl(${(hue + 95) % 360} 70% 22%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // soft blobs
  for (let i = 0; i < 5; i++) {
    const r = 180 + Math.random() * 260;
    const g = ctx.createRadialGradient(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      0,
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      r,
    );
    g.addColorStop(0, "rgba(255,255,255,0.16)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = "700 76px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(label, 64, canvas.height - 90);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("canvas toBlob failed");
  return storeBlob(blob, `${label}.jpg`);
}
