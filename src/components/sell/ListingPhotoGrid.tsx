"use client";

import { useRef, useState } from "react";

export type ListingPhotoItem = {
  key: string;
  label: number;
  preview: string;
  id?: number;
  file?: File;
  url?: string;
  thumbnail_url?: string;
  is_primary?: boolean;
};

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const BLOCKED_EXT = new Set([".pdf", ".exe", ".dll", ".bat", ".cmd", ".msi", ".svg", ".gif", ".bmp", ".tif", ".tiff", ".heic"]);

function fileExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function listingPhotoError(file: File) {
  const name = file.name || "file";
  const ext = fileExtension(name);
  const type = String(file.type || "").toLowerCase();
  if (BLOCKED_EXT.has(ext) || (type && !type.startsWith("image/"))) {
    return `${name} is not an image. Only JPEG, PNG, and WebP under 10MB are accepted.`;
  }
  if ((ext && !ALLOWED_EXT.has(ext)) || (type && !ALLOWED_TYPES.has(type))) {
    return `${name} is not a supported format. Use JPEG, PNG, or WebP under 10MB.`;
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${name} is ${mb}MB. Photos must be JPEG, PNG, or WebP and 10MB or smaller.`;
  }
  if (!ext && !ALLOWED_TYPES.has(type)) {
    return `${name} is not a supported image. Only JPEG, PNG, and WebP under 10MB are accepted.`;
  }
  return null;
}

function nextLabel(photos: ListingPhotoItem[]) {
  return photos.reduce((max, photo) => Math.max(max, photo.label), 0) + 1;
}

function filesFromList(list: FileList | File[]) {
  return Array.from(list);
}

export function ListingPhotoGrid({
  photos,
  onChange,
  onAddFiles,
  onPersist,
  onError,
  max = 12,
  disabled = false,
}: {
  photos: ListingPhotoItem[];
  onChange: (photos: ListingPhotoItem[]) => void;
  onAddFiles?: (files: File[]) => void;
  onPersist?: (photos: ListingPhotoItem[]) => void;
  onError?: (message: string) => void;
  max?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function commit(next: ListingPhotoItem[]) {
    onChange(next);
    onPersist?.(next);
  }

  function addFiles(list: FileList | File[]) {
    const incoming = filesFromList(list);
    if (!incoming.length) return;
    const room = Math.max(0, max - photos.length);
    if (room === 0) {
      const message = `Listings can have up to ${max} photos.`;
      setLocalError(message);
      onError?.(message);
      return;
    }
    setLocalError(null);
    const accepted: File[] = [];
    for (const file of incoming.slice(0, room)) {
      const message = listingPhotoError(file);
      if (message) {
        setLocalError(message);
        onError?.(message);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (onAddFiles) {
      onAddFiles(accepted);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const labeled: ListingPhotoItem[] = [];
    for (const file of accepted) {
      const label = nextLabel([...photos, ...labeled]);
      labeled.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${label}`,
        label,
        preview: URL.createObjectURL(file),
        file,
        is_primary: photos.length + labeled.length === 0,
      });
    }
    onChange([...photos, ...labeled]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePhoto(index: number) {
    const target = photos[index];
    if (target?.preview?.startsWith("blob:")) URL.revokeObjectURL(target.preview);
    const next = photos.filter((_, i) => i !== index);
    if (target?.is_primary && next[0]) next[0] = { ...next[0], is_primary: true };
    commit(next);
  }

  function movePhoto(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  }

  function setPrimary(index: number) {
    commit(photos.map((photo, i) => ({ ...photo, is_primary: i === index })));
  }

  return (
    <div
      aria-label="Photo drop zone"
      className={`rounded-2xl border-2 border-dashed p-3 transition ${
        dropOver ? "border-[#3665f3] bg-[#eef3ff]" : "border-[#e7eef6] bg-[#f8fbff]"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = dragFrom != null ? "move" : "copy";
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDropOver(false);
        if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
      }}
    >
      <p className="mb-3 text-[12.5px] text-[#6b7587]">
        Drag and drop up to {max} photos here, then drag thumbnails to reorder. Only JPEG, PNG, and WebP under 10MB are accepted.
      </p>
      {localError ? (
        <p role="alert" className="mb-3 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[13px] font-medium text-[#e53238]">
          {localError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={photo.key}
            draggable={!disabled}
            aria-label={`Photo ${photo.label}`}
            onDragStart={(event) => {
              setDragFrom(index);
              event.dataTransfer.setData("text/plain", String(index));
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.dataTransfer.files?.length) {
                addFiles(event.dataTransfer.files);
                return;
              }
              const from = dragFrom ?? Number(event.dataTransfer.getData("text/plain"));
              movePhoto(from, index);
              setDragFrom(null);
            }}
            className={`group relative aspect-square cursor-grab rounded-lg ${dragFrom === index ? "opacity-60" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview}
              alt={`Photo ${photo.label}`}
              className="h-full w-full rounded-lg border-2 border-[#e7eef6] object-cover"
            />
            <p className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
              Photo {photo.label}
            </p>
            <button
              type="button"
              aria-label={`Remove photo ${photo.label}`}
              onClick={() => removePhoto(index)}
              disabled={disabled}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 group-hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {photo.is_primary ? (
              <div className="absolute bottom-2 left-2 rounded bg-[#0f1c3f] px-2 py-1 text-xs font-semibold text-white">
                Primary
              </div>
            ) : (
              <button
                type="button"
                aria-label="Set as Primary"
                onClick={() => setPrimary(index)}
                disabled={disabled}
                className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#0f1c3f] shadow-sm hover:bg-white"
              >
                Set as Primary
              </button>
            )}
          </div>
        ))}

        {photos.length < max ? (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#c9d3e0] bg-white hover:border-[#3665f3] hover:bg-[#eef3ff]">
            <svg className="h-8 w-8 text-[#6b7587]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="mt-2 text-sm text-[#6b7587]">Add Photo</span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              disabled={disabled}
              onChange={(event) => addFiles(event.target.files || [])}
              className="hidden"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
