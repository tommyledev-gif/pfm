// Mirrors backend/internal/dto/app_update.go.
export interface NativeUpdateStatus {
  /** This phone's APK is too old for the updates now published: install the newest. */
  update_required: boolean;
  version_code: number;
  version_name: string;
  /** The APK link to open in a browser (APK_PUBLIC_URL on the server), so a
   *  person never sees the API's address; absent when none is configured. */
  download_url?: string;
}
