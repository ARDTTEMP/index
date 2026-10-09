"use client";

import { useRef, useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { api } from "./PublicForm";
import { text, type Locale } from "@/lib/domain";

type MediaRow = {
  id: string;
  media_type: "image" | "video";
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  url: string;
  poster_url: string | null;
  created_at: string;
};

export default function MediaManager({
  rows,
  act,
  l,
}: {
  rows: MediaRow[];
  act: (body: Record<string, unknown>) => Promise<unknown>;
  l: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const t = (fr: string, en: string) => text(l, fr, en);

  async function upload(file: File, contentType: string) {
    if (contentType === "image/webp")
      return uploadPublicPhoto(file, "gallery-media");
    const signed = await api({
      op: "create_media_upload",
      content_type: contentType,
    });
    const { error: uploadError } = await supabaseBrowser()
      .storage.from("gallery-media")
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);
    return signed.path as string;
  }

  return (
    <>
      <section className="card media-publisher">
        <h2>
          {t("Publier une photo ou une vidéo", "Publish a photo or video")}
        </h2>
        <p>
          {t(
            "Les photos sont redimensionnées et converties en WebP avant l’envoi. Les vidéos sont préparées pour une lecture différée et reçoivent une miniature.",
            "Photos are resized and converted to WebP before upload. Videos are set up for deferred playback and receive a poster image.",
          )}
        </p>
        <form
          ref={formRef}
          className="form"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!formRef.current) return;
            const form = formRef.current;
            const fd = new FormData(form);
            const selected = fd.get("media");
            if (!(selected instanceof File) || selected.size === 0) {
              setError(
                t(
                  "Choisissez une photo ou une vidéo.",
                  "Choose a photo or video.",
                ),
              );
              return;
            }
            setBusy(true);
            setError("");
            try {
              let file = selected;
              let poster: File | null = null;
              let mediaType: "image" | "video";
              if (selected.type.startsWith("image/")) {
                setProgress(
                  t("Optimisation de la photo…", "Optimizing photo…"),
                );
                file = await optimizeImage(selected);
                mediaType = "image";
              } else if (selected.type.startsWith("video/")) {
                if (!/^video\/(mp4|webm|quicktime)$/.test(selected.type))
                  throw new Error(
                    t(
                      "Format vidéo non pris en charge. Utilisez MP4 ou WebM.",
                      "Unsupported video format. Use MP4 or WebM.",
                    ),
                  );
                if (selected.size > 200 * 1024 * 1024)
                  throw new Error(
                    t(
                      "La vidéo source doit faire moins de 200 Mo.",
                      "The source video must be under 200 MB.",
                    ),
                  );
                setProgress(
                  t(
                    "Préparation de la vidéo et de sa miniature…",
                    "Preparing video and poster…",
                  ),
                );
                poster = await makePoster(selected);
                setProgress(
                  t("Optimisation de la vidéo…", "Optimizing video…"),
                );
                const encoded = await optimizeVideo(selected, (pct) =>
                  setProgress(
                    t(
                      `Optimisation de la vidéo… ${pct}%`,
                      `Optimizing video… ${pct}%`,
                    ),
                  ),
                );
                file = encoded || selected;
                mediaType = "video";
                if (file.size > 50 * 1024 * 1024)
                  throw new Error(
                    t(
                      "La vidéo optimisée dépasse 50 Mo. Choisissez une vidéo plus courte.",
                      "The optimized video exceeds 50 MB. Choose a shorter video.",
                    ),
                  );
              } else {
                throw new Error(
                  t(
                    "Type de fichier non pris en charge.",
                    "Unsupported file type.",
                  ),
                );
              }

              setProgress(t("Envoi du média…", "Uploading media…"));
              const contentType =
                file.type === "image/webp" ? "image/webp" : file.type;
              if (
                !new Set(["image/webp", "video/webm", "video/mp4"]).has(
                  contentType,
                )
              )
                throw new Error(
                  t(
                    "Le format optimisé n’est pas pris en charge par le stockage.",
                    "The optimized format is not supported by storage.",
                  ),
                );
              const objectPath = await upload(file, contentType);
              let posterPath: string | null = null;
              if (poster) {
                setProgress(t("Envoi de la miniature…", "Uploading poster…"));
                posterPath = await upload(poster, "image/webp");
              }
              setProgress(t("Publication…", "Publishing…"));
              await act({
                op: "publish_media",
                media_type: mediaType,
                title_fr: fd.get("title_fr"),
                title_en: fd.get("title_en"),
                description_fr: fd.get("description_fr") || "",
                description_en: fd.get("description_en") || "",
                object_path: objectPath,
                poster_path: posterPath,
              });
              form.reset();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
              setProgress("");
            }
          }}
        >
          <label>
            {t("Photo ou vidéo", "Photo or video")}
            <input
              name="media"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              {t("Titre en français", "French title")}
              <input name="title_fr" required minLength={2} maxLength={200} />
            </label>
            <label>
              {t("Titre en anglais", "English title")}
              <input name="title_en" required minLength={2} maxLength={200} />
            </label>
          </div>
          <div className="form-grid">
            <label>
              {t("Description en français", "French description")}
              <textarea name="description_fr" maxLength={2000} />
            </label>
            <label>
              {t("Description en anglais", "English description")}
              <textarea name="description_en" maxLength={2000} />
            </label>
          </div>
          {progress && (
            <p className="notice" role="status">
              {progress}
            </p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy
              ? t("Publication en cours…", "Publishing…")
              : t("Publier dans la galerie", "Publish to gallery")}
          </button>
        </form>
      </section>
      <div className="media-admin-grid">
        {rows.length ? (
          rows.map((row) => (
            <article className="card media-admin-card" key={row.id}>
              <div className="media-admin-preview">
                {row.media_type === "image" ? (
                  <img
                    src={row.url}
                    alt={row.title_fr}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <video
                    src={row.url}
                    poster={row.poster_url || undefined}
                    preload="none"
                    controls
                    playsInline
                  />
                )}
              </div>
              <h3>{l === "fr" ? row.title_fr : row.title_en}</h3>
              <button
                className="button outline small"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      t(
                        "Supprimer ce média de la galerie ?",
                        "Delete this gallery media?",
                      ),
                    )
                  )
                    void act({ op: "delete_media", id: row.id });
                }}
              >
                {t("Supprimer", "Delete")}
              </button>
            </article>
          ))
        ) : (
          <p className="empty">
            {t("Aucun média publié pour le moment.", "No media published yet.")}
          </p>
        )}
      </div>
    </>
  );
}

export async function optimizeImage(
  source: File,
  maxEdge = 1920,
  quality = 0.82,
): Promise<File> {
  if (source.size > 30 * 1024 * 1024)
    throw new Error("Photo source trop lourde (30 Mo maximum).");
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer cette image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Conversion WebP impossible.")),
      "image/webp",
      quality,
    ),
  );
  if (blob.size > 50 * 1024 * 1024)
    throw new Error("La photo optimisée dépasse 50 Mo.");
  return new File([blob], `${source.name.replace(/\.[^.]+$/, "")}.webp`, {
    type: "image/webp",
  });
}

function makePoster(source: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(source);
    video.preload = "metadata";
    video.muted = true;
    video.onloadeddata = () => {
      const scale = Math.min(
        1,
        1280 / Math.max(video.videoWidth, video.videoHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return cleanup(new Error("Miniature vidéo impossible."));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return cleanup(new Error("Miniature vidéo impossible."));
          cleanup();
          resolve(new File([blob], "poster.webp", { type: "image/webp" }));
        },
        "image/webp",
        0.78,
      );
    };
    video.onerror = () => cleanup(new Error("Lecture de la vidéo impossible."));
    const cleanup = (error?: Error) => {
      URL.revokeObjectURL(url);
      video.src = "";
      if (error) reject(error);
    };
    video.src = url;
  });
}

function optimizeVideo(
  source: File,
  onProgress: (percent: number) => void,
): Promise<File | null> {
  const mime = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  const canvasStreamSupported = "captureStream" in HTMLCanvasElement.prototype;
  if (!mime || !canvasStreamSupported) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(source);
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.pause();
      video.src = "";
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Lecture de la vidéo impossible."));
    };
    video.onloadedmetadata = async () => {
      if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        video.duration > 180
      ) {
        cleanup();
        reject(new Error("La vidéo doit durer moins de 3 minutes."));
        return;
      }
      const scale = Math.min(1, 1280 / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(
        2,
        Math.floor((video.videoWidth * scale) / 2) * 2,
      );
      canvas.height = Math.max(
        2,
        Math.floor((video.videoHeight * scale) / 2) * 2,
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Optimisation vidéo indisponible."));
        return;
      }
      const stream = canvas.captureStream(24);
      const captureVideo = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
      };
      try {
        for (const track of captureVideo.captureStream?.().getAudioTracks() ||
          [])
          stream.addTrack(track);
      } catch {
        /* Audio capture support varies by browser. */
      }
      const chunks: BlobPart[] = [];
      let stopReason = "";
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 1_100_000,
        audioBitsPerSecond: 96_000,
      });
      const draw = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        onProgress(
          Math.min(99, Math.floor((video.currentTime / video.duration) * 100)),
        );
        requestAnimationFrame(draw);
      };
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        const size = chunks.reduce(
          (sum, chunk) => sum + (chunk instanceof Blob ? chunk.size : 0),
          0,
        );
        if (size > 50 * 1024 * 1024) {
          stopReason = "La vidéo optimisée dépasse 50 Mo.";
          recorder.stop();
        }
      };
      recorder.onerror = () => {
        cleanup();
        reject(new Error("Échec de l’encodage vidéo."));
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        cleanup();
        if (stopReason) {
          reject(new Error(stopReason));
          return;
        }
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        onProgress(100);
        resolve(
          new File([blob], `${source.name.replace(/\.[^.]+$/, "")}.webm`, {
            type: "video/webm",
          }),
        );
      };
      try {
        recorder.start(1000);
        await video.play();
        draw();
        video.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };
      } catch {
        if (recorder.state !== "inactive") recorder.stop();
        else {
          cleanup();
          reject(new Error("Impossible de démarrer l’optimisation vidéo."));
        }
      }
    };
    video.src = url;
  });
}

export async function uploadPublicPhoto(
  file: File,
  bucket: "news-photos" | "gallery-media",
) {
  if (file.size > 4 * 1024 * 1024)
    throw new Error(
      "La photo optimisée dépasse 4 Mo. Choisissez une image plus petite.",
    );
  const form = new FormData();
  form.set("bucket", bucket);
  form.set("file", file);
  const response = await fetch("/api/platform", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Échec de l’envoi de la photo.");
  return result.path as string;
}
