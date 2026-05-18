import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, RefreshCw, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a freshly-captured JPEG File after the user confirms it. */
  onCapture: (file: File) => void;
  /** Filename prefix — final name is `${filenamePrefix}-${timestamp}.jpg`. */
  filenamePrefix?: string;
  /** JPEG quality 0..1, default 0.9. */
  jpegQuality?: number;
}

type Status = "idle" | "loading" | "streaming" | "captured" | "error";

interface DeviceState {
  /** All enumerated video devices (label-stripped when no permission yet). */
  devices: MediaDeviceInfo[];
  /** Active deviceId, or null if we let the browser pick. */
  activeDeviceId: string | null;
}

/**
 * Modal camera capture flow:
 *   1. Request getUserMedia(video) with the current/preferred deviceId.
 *   2. Stream to a hidden <video>. Show "Снять" + "Переключить камеру" buttons.
 *   3. On capture: draw the current video frame to a hidden <canvas>, toBlob → File.
 *      Pause the stream and show the still as a preview with "Переснять" / "Использовать".
 *   4. On confirm: hand File to onCapture and close.
 *   5. Always stop tracks on unmount / close / device switch (avoid leaking the
 *      camera light staying on after the dialog hides).
 *
 * Defensive notes:
 *   - SSR-safe: all browser-only access guarded by typeof check inside effects.
 *   - The "switch camera" button is hidden if only one video input is enumerated.
 *   - getUserMedia is invoked again on every deviceId change; the previous
 *     stream is fully stopped first to release the hardware promptly on
 *     mobile Safari (which holds onto it otherwise).
 */
export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  filenamePrefix = "photo",
  jpegQuality = 0.9,
}: CameraCaptureDialogProps) {
  const { t } = useTranslation();
  // i18n strings only show up in error states — pin via ref so the camera
  // stream isn't restarted whenever the language switcher fires.
  const tRef = useRef(t);
  tRef.current = t;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<{ blob: Blob; url: string } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [deviceState, setDeviceState] = useState<DeviceState>({
    devices: [],
    activeDeviceId: null,
  });
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  previewRef.current = preview;

  // Cleanup helpers — wrapped in useCallback with stable deps so the start
  // effect can list them without churning. They only touch refs.
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const releasePreview = useCallback(() => {
    const p = previewRef.current;
    if (p) {
      URL.revokeObjectURL(p.url);
      previewRef.current = null;
      setPreview(null);
    }
  }, []);

  // Start the stream when the dialog opens or the active device changes.
  useEffect(() => {
    if (!open) return;
    if (preview) return; // freeze on captured frame; user re-takes via button

    let cancelled = false;

    async function start() {
      setStatus("loading");
      setErrorMsg("");
      stopStream();

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg(tRef.current("photo:camera_unsupported"));
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceState.activeDeviceId
            ? { deviceId: { exact: deviceState.activeDeviceId } }
            : {
                // Prefer rear camera on mobile; falls back to default webcam on desktop.
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Autoplay attribute set on <video> below; play() is needed for some
          // browsers when srcObject is bound after mount.
          videoRef.current.play().catch(() => {
            /* User-gesture autoplay block — preview still appears at first frame */
          });
        }
        setStatus("streaming");

        // Now that we have permission, re-enumerate so device labels are populated.
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          if (cancelled) return;
          const videos = list.filter((d) => d.kind === "videoinput");
          setDeviceState((prev) => ({
            devices: videos,
            // Lock in the actual active deviceId for the "switch" button to advance.
            activeDeviceId:
              prev.activeDeviceId ?? stream.getVideoTracks()[0]?.getSettings().deviceId ?? null,
          }));
        } catch {
          // enumerate failed — switch button just won't appear.
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        const isPermission =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        const isNoDevice =
          err instanceof DOMException &&
          (err.name === "NotFoundError" || err.name === "OverconstrainedError");
        setErrorMsg(
          isPermission
            ? tRef.current("photo:camera_denied")
            : isNoDevice
              ? tRef.current("photo:camera_no_devices")
              : tRef.current("photo:camera_error")
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, [open, deviceState.activeDeviceId, preview, stopStream]);

  // Always release the camera when the dialog truly closes.
  useEffect(() => {
    if (!open) {
      stopStream();
      releasePreview();
      setStatus("idle");
      setErrorMsg("");
      // Don't reset deviceState — sticky preference for the next open.
    }
  }, [open, stopStream, releasePreview]);

  // Final unmount safety net.
  useEffect(() => {
    return () => {
      stopStream();
      releasePreview();
    };
  }, [stopStream, releasePreview]);

  const switchCamera = () => {
    if (deviceState.devices.length < 2) return;
    const idx = Math.max(
      0,
      deviceState.devices.findIndex((d) => d.deviceId === deviceState.activeDeviceId)
    );
    const next = deviceState.devices[(idx + 1) % deviceState.devices.length];
    setDeviceState((prev) => ({ ...prev, activeDeviceId: next.deviceId }));
  };

  const takeShot = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", jpegQuality)
    );
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview({ blob, url });
    setStatus("captured");
    // Pause the stream until the user retakes or confirms — also saves battery.
    stopStream();
  };

  const retake = () => {
    releasePreview();
    setStatus("idle");
  };

  const useShot = () => {
    if (!preview) return;
    const file = new File([preview.blob], `${filenamePrefix}-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-4 sm:p-6">
        <DialogTitle className="inline-flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Camera className="h-4 w-4" />
          </span>
          {t("photo:camera_dialog_title")}
        </DialogTitle>

        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-black">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2 text-white/90">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-xs">{t("photo:camera_loading")}</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-white/90">
              <X className="h-6 w-6 text-rose-400" />
              <p className="text-sm font-semibold">{errorMsg}</p>
            </div>
          )}

          {/* Live preview — kept mounted so the ref is stable across status flips */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "h-full w-full object-cover",
              (status !== "streaming" || preview) && "hidden"
            )}
          />

          {/* Frozen still after capture */}
          {preview && (
            <img
              src={preview.url}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          )}

          {/* Switch-camera button — hidden when only 1 device or in error/loading */}
          {status === "streaming" && deviceState.devices.length > 1 && !preview && (
            <button
              type="button"
              onClick={switchCamera}
              aria-label={t("photo:camera_switch")}
              className={cn(
                "absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full",
                "bg-black/45 text-white backdrop-blur-sm",
                "transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              )}
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Action bar — distinct shape per state */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>

          {preview ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={retake}>
                <RefreshCw className="h-4 w-4" />
                {t("photo:camera_retake")}
              </Button>
              <Button type="button" variant="brand" onClick={useShot}>
                {t("photo:camera_use")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="brand"
              size="lg"
              disabled={status !== "streaming"}
              onClick={takeShot}
              className="min-w-[10rem]"
            >
              <Camera className="h-4 w-4" />
              {t("photo:camera_capture")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
