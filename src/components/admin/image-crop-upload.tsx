import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminSupabase, uploadAdminFile } from "@/lib/admin";

// ------------------------------------------------------------
// Recadrage carré avec aperçu avant téléversement.
// Le cadre se déplace à la souris ou au doigt ; un curseur règle
// sa taille. L'image recadrée est exportée en WebP (800×800) puis
// envoyée vers le bucket Storage indiqué. Pensé pour un usage non
// technique : un seul flux "choisir → cadrer → utiliser".
// ------------------------------------------------------------

type CropRect = { x: number; y: number; size: number };

const OUTPUT_SIZE = 800;
const MIN_CROP_RATIO = 0.35;
const FRAME_PX = 320;

type Point = { x: number; y: number };

function clampCrop(rect: CropRect, side: number): CropRect {
  const size = Math.min(rect.size, side);
  const max = Math.max(side - size, 0);
  return {
    size,
    x: Math.min(Math.max(rect.x, 0), max),
    y: Math.min(Math.max(rect.y, 0), max),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = URL.createObjectURL(file);
  });
}

export function ImageCropUpload({
  bucket,
  label = "Photo",
  initialUrl,
  onUploaded,
}: {
  bucket: string;
  label?: string;
  initialUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, size: FRAME_PX });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ start: Point; crop: CropRect } | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const closeCropSession = useCallback(() => {
    setFile(null);
    setBitmap(null);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    dragRef.current = null;
  }, [objectUrl]);

  const openFile = useCallback(async (chosen: File) => {
    setError("");
    if (!chosen.type.startsWith("image/")) {
      setError("Choisissez une image (JPG, PNG ou WEBP).");
      return;
    }
    try {
      const loaded = await loadBitmap(chosen);
      const side = Math.min(loaded.width, loaded.height);
      setFile(chosen);
      setBitmap(loaded);
      setObjectUrl(URL.createObjectURL(chosen));
      setCrop(
        clampCrop(
          { x: (loaded.width - side) / 2, y: (loaded.height - side) / 2, size: side },
          side,
        ),
      );
    } catch {
      setError("Impossible de lire cette image.");
    }
  }, []);

  const image = bitmap;
  // Affichage "contain" dans un cadre carré de FRAME_PX px.
  const scale = image ? FRAME_PX / Math.max(image.width, image.height) : 1;
  const displayWidth = image ? image.width * scale : 0;
  const displayHeight = image ? image.height * scale : 0;
  const offsetX = (FRAME_PX - displayWidth) / 2;
  const offsetY = (FRAME_PX - displayHeight) / 2;

  function pointToImage(clientX: number, clientY: number): Point {
    const frame = frameRef.current;
    if (!frame) return { x: 0, y: 0 };
    const bounds = frame.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - offsetX) / scale,
      y: (clientY - bounds.top - offsetY) / scale,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { start: pointToImage(event.clientX, event.clientY), crop };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !image) return;
    const point = pointToImage(event.clientX, event.clientY);
    const side = Math.min(image.width, image.height);
    setCrop(
      clampCrop(
        {
          ...drag.crop,
          x: drag.crop.x + (point.x - drag.start.x),
          y: drag.crop.y + (point.y - drag.start.y),
        },
        side,
      ),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onResize(event: React.ChangeEvent<HTMLInputElement>) {
    if (!image) return;
    const side = Math.min(image.width, image.height);
    const size = Math.max(side * MIN_CROP_RATIO, Math.min(Number(event.target.value), side));
    setCrop((current) => clampCrop({ ...current, size }, side));
  }

  async function confirmCrop() {
    if (!image || !file) return;
    setUploading(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.size,
        crop.size,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!blob) throw new Error("export failed");
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      const cropped = new File([blob], `${baseName}.webp`, { type: "image/webp" });

      const supabase = getAdminSupabase();
      if (!supabase) throw new Error("supabase unavailable");
      const result = await uploadAdminFile(supabase, bucket, cropped);
      if ("error" in result) {
        setError(result.error);
      } else {
        onUploaded(result.url);
        closeCropSession();
      }
    } catch {
      setError("Le recadrage ou l'envoi a échoué. Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-upload-block">
      <label className={`admin-upload admin-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const chosen = event.dataTransfer.files[0]; if (chosen) void openFile(chosen); }}>
        <Upload />
        <span>{file ? "Changer l'image" : `Déposez ou choisissez une ${label.toLowerCase()}`}</span>
        <small>JPG, PNG ou WEBP</small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) void openFile(chosen);
            event.target.value = "";
          }}
        />
      </label>

      {image && (
        <div className="admin-crop">
          <div
            className="admin-crop-frame"
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {objectUrl && (
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  width: displayWidth,
                  height: displayHeight,
                  left: offsetX,
                  top: offsetY,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            )}
            <div
              className="admin-crop-rect"
              style={{
                left: offsetX + crop.x * scale,
                top: offsetY + crop.y * scale,
                width: crop.size * scale,
                height: crop.size * scale,
              }}
            />
          </div>
          <label className="admin-crop-size">
            <span>
              <Crop /> Taille du cadre
            </span>
            <input
              type="range"
              min={Math.max(image.width, image.height) * MIN_CROP_RATIO}
              max={Math.min(image.width, image.height)}
              value={crop.size}
              onChange={onResize}
            />
          </label>
          <div className="admin-actions">
            <Button type="button" size="sm" disabled={uploading} onClick={() => void confirmCrop()}>
              {uploading ? "Envoi…" : "Utiliser ce cadrage"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={closeCropSession}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {error && <p className="admin-error">{error}</p>}
      {initialUrl && !image && (
        <img className="admin-preview admin-preview-portrait" src={initialUrl} alt="Aperçu" />
      )}
    </div>
  );
}
