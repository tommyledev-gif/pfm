import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";

// Taking or picking the photo for an image reading (specs/ai-chat-image-
// capture US-01, plan §4.2). Expo Go compatible: picker + manipulator only.
// The photo is shrunk to a size that stays legible (plan F4) and kept in this
// device's cache for the thumbnail and a retry; it is deleted at logout (AC-26).

export const CAPTURE_MAX_EDGE_PX = 1600;
export const CAPTURE_JPEG_QUALITY = 0.7;
// Mirrors backend common.AIImageMaxUploadBytes (2.5 MiB).
export const CAPTURE_MAX_BYTES = (5 * 1024 * 1024) / 2;
export const CAPTURE_MIME_TYPE = "image/jpeg";
const CAPTURE_DIR_NAME = "chat-captures";
const CAPTURE_FILE_PREFIX = "capture-";

export type ImageSource = "camera" | "library";

export type CaptureResult =
  | { kind: "picked"; uri: string }
  | { kind: "denied"; source: ImageSource }
  | { kind: "cancelled" }
  | { kind: "too_large" }
  | { kind: "failed" };

export async function pickImage(source: ImageSource): Promise<CaptureResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { kind: "denied", source };

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, base64: false };
  const result =
    source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: "cancelled" };

  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > CAPTURE_MAX_EDGE_PX) {
      context.resize(asset.width >= asset.height ? { width: CAPTURE_MAX_EDGE_PX } : { height: CAPTURE_MAX_EDGE_PX });
    }
    const rendered = await context.renderAsync();
    // JPEG also turns a HEIC photo into something every reader accepts.
    const saved = await rendered.saveAsync({ compress: CAPTURE_JPEG_QUALITY, format: SaveFormat.JPEG });

    const directory = captureDirectory();
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(saved.uri);
    file.move(new File(directory, `${CAPTURE_FILE_PREFIX}${Date.now()}.jpg`));
    if (file.size > CAPTURE_MAX_BYTES) {
      file.delete();
      return { kind: "too_large" };
    }
    return { kind: "picked", uri: file.uri };
  } catch {
    return { kind: "failed" };
  }
}

/** Whether a kept photo is still on this device (cache can be cleared, EC-19). */
export function captureExists(uri: string | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Removes every kept photo (logout, account change — AC-26). Never throws. */
export function deleteAllCaptures(): void {
  try {
    const directory = captureDirectory();
    if (directory.exists) directory.delete();
  } catch {
    // Nothing kept, or the cache is already gone.
  }
}

function captureDirectory(): Directory {
  return new Directory(Paths.cache, CAPTURE_DIR_NAME);
}
