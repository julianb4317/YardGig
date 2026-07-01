"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex = 0, open, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, currentIndex]);

  if (!open || photos.length === 0) return null;

  const prev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
    setZoom(1);
  };

  const next = () => {
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
    setZoom(1);
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30" aria-label="Zoom out">
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="text-white text-sm font-medium min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30" aria-label="Zoom in">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button onClick={onClose} className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 ml-2" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-4 text-white text-sm font-medium bg-black/40 rounded-full px-3 py-1">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Image */}
      <div className="overflow-auto max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={photos[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="transition-transform duration-200 cursor-zoom-in"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          onClick={() => setZoom((z) => z < 2 ? 2 : 1)}
        />
      </div>
    </div>
  );
}

/** A clickable photo grid that opens a lightbox on click */
interface PhotoGridProps {
  photos: string[];
  label?: string;
}

export function PhotoGrid({ photos, label }: PhotoGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <div className="mt-6">
        {label && (
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              className="relative group rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <img src={url} alt={`Photo ${i + 1}`} className="h-32 w-full object-cover rounded-lg" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <ZoomIn className="h-6 w-6 text-white drop-shadow" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
