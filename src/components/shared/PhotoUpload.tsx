"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type PhotoType = "before" | "after" | "general" | "receipt";

interface UploadedPhoto {
  fileKey: string;
  fileName: string;
  photoType: PhotoType;
  url: string;
}

interface Props {
  jobId: string;
  photoType: PhotoType;
  label: string;
  maxPhotos?: number;
  onUploaded?: (photo: UploadedPhoto) => void;
  onDeleted?: (fileKey: string) => void;
  existing?: UploadedPhoto[];
}

export function PhotoUpload({ jobId, photoType, label, maxPhotos = 5, onUploaded, onDeleted, existing = [] }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(existing);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const urlRes = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, fileType: photoType, fileName: file.name, mimeType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, fileKey } = await urlRes.json();

      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      await fetch(`/api/jobs/${jobId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey, fileName: file.name, photoType }),
      });

      const localUrl = URL.createObjectURL(file);
      const photo: UploadedPhoto = { fileKey, fileName: file.name, photoType, url: localUrl };
      setPhotos((prev) => [...prev, photo]);
      onUploaded?.(photo);
    } catch (e) {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }, [jobId, photoType, onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    disabled: uploading || photos.length >= maxPhotos,
    onDrop: (files) => files.forEach(uploadFile),
  });

  const handleDelete = async (fileKey: string) => {
    const photo = photos.find((p) => p.fileKey === fileKey);
    if (!photo) return;
    setPhotos((prev) => prev.filter((p) => p.fileKey !== fileKey));
    onDeleted?.(fileKey);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.fileKey} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
              <img src={p.url} alt={p.fileName} className="w-full h-full object-cover" />
              <button
                onClick={() => handleDelete(p.fileKey)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
              (uploading || photos.length >= maxPhotos) && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            )}
            <p className="text-sm text-slate-500">Drop photo or tap to choose</p>
          </div>

          {/* Direct camera button for mobile */}
          <label className="flex items-center justify-center gap-2 h-12 border border-slate-300 rounded-xl text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
            <Camera className="w-5 h-5" />
            Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
            />
          </label>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
