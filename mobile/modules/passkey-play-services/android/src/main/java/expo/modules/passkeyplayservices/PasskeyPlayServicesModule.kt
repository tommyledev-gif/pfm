// Identity's BeginSignInRequest is deprecated: see the class comment.
@file:Suppress("DEPRECATION")

package expo.modules.passkeyplayservices

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import com.google.android.gms.auth.api.identity.BeginSignInRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.fido.Fido
import com.google.android.gms.fido.fido2.api.common.AuthenticatorErrorResponse
import com.google.android.gms.fido.fido2.api.common.ErrorCode
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredential
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialCreationOptions
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// FragmentActivity (which ReactActivity is) only accepts request codes that
// fit in 16 bits.
private const val REQUEST_CODE = 0x7A51

private enum class Ceremony { CREATE, GET }

/**
 * Passkeys through Google Play Services, the way Chrome and most apps reach
 * Google Password Manager, for phones where Android 14's own Credential
 * Manager never hands the request to a password service.
 *
 * react-native-passkey goes through androidx.credentials, which on Android 14+
 * asks the system Credential Manager. On some makers' builds (a Vivo V2352A,
 * 2026-10-20) that answers "No create options available." within ~40 ms when
 * adding, and never answers at all when signing in, with Google switched on in
 * every setting while other apps use passkeys fine: the system service never
 * reaches Google. The same WebAuthn JSON sent here goes to Google Play
 * Services directly, through the two APIs androidx itself uses below Android
 * 14: FIDO2 to create, Identity's sign-in for a discoverable passkey. The JS
 * side only comes here after the normal path failed that way
 * (features/security/passkeys/native-passkey.ts).
 *
 * Errors use react-native-passkey's codes, so both paths read the same in JS.
 *
 * Identity's BeginSignInRequest is deprecated in favour of Credential
 * Manager, the very path that fails on these phones; it still works, and
 * androidx.credentials itself calls it below Android 14.
 */
class PasskeyPlayServicesModule : Module() {
  // The ceremony in flight; its answer arrives through OnActivityResult.
  private var pending: Pair<Ceremony, Promise>? = null

  override fun definition() = ModuleDefinition {
    Name("PasskeyPlayServices")

    // Server's PublicKeyCredentialCreationOptions JSON in, the registration
    // response JSON (PublicKeyCredential.toJson) out.
    AsyncFunction("create") { requestJson: String, promise: Promise ->
      val options = try {
        PublicKeyCredentialCreationOptions(requestJson)
      } catch (e: Exception) {
        return@AsyncFunction promise.reject("RequestFailed", "Unreadable creation options: ${e.message}", e)
      }
      launch(Ceremony.CREATE, promise) { activity -> Fido.getFido2ApiClient(activity).getRegisterPendingIntent(options) }
    }.runOnQueue(Queues.MAIN)

    // Server's PublicKeyCredentialRequestOptions JSON in, the assertion
    // response JSON out. No allowCredentials needed: Google offers every
    // passkey it holds for the rpId.
    AsyncFunction("get") { requestJson: String, promise: Promise ->
      val request = BeginSignInRequest.builder()
        .setPasskeyJsonSignInRequestOptions(
          BeginSignInRequest.PasskeyJsonRequestOptions.Builder().setSupported(true).setRequestJson(requestJson).build(),
        )
        .setPasswordRequestOptions(BeginSignInRequest.PasswordRequestOptions.builder().setSupported(false).build())
        .setAutoSelectEnabled(false)
        .build()
      launch(Ceremony.GET, promise) { activity ->
        Identity.getSignInClient(activity).beginSignIn(request).continueWith { task -> task.result.pendingIntent }
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { activity, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val (ceremony, promise) = pending ?: return@OnActivityResult
      pending = null
      when (ceremony) {
        Ceremony.CREATE -> settleCreate(payload.data, promise)
        Ceremony.GET -> settleGet(activity, payload.data, promise)
      }
    }
  }

  private fun launch(ceremony: Ceremony, promise: Promise, pendingIntentFor: (Activity) -> Task<PendingIntent>) {
    val activity = appContext.currentActivity
      ?: return promise.reject("RequestFailed", "No active Activity", null)
    // A sheet that never answered: give it up rather than leave its caller waiting.
    pending?.second?.reject("Interrupted", "Replaced by a new passkey request", null)
    pending = ceremony to promise
    val fail = { e: Exception ->
      if (pending?.second === promise) pending = null
      // Sign-in fails here when Google has no passkey to offer for the rpId.
      val code = if (ceremony == Ceremony.GET && e.unwrapApi() != null) "NoCredentials" else "RequestFailed"
      promise.reject(code, e.unwrapApi()?.message ?: e.message ?: e.javaClass.simpleName, e)
    }
    pendingIntentFor(activity)
      .addOnSuccessListener { intent ->
        try {
          activity.startIntentSenderForResult(intent.intentSender, REQUEST_CODE, null, 0, 0, 0)
        } catch (e: Exception) {
          fail(e)
        }
      }
      .addOnFailureListener { e -> fail(e) }
  }

  private fun settleCreate(data: Intent?, promise: Promise) {
    // Closed with back, or swiped away, before Google answered.
    val bytes = data?.getByteArrayExtra(Fido.FIDO2_KEY_CREDENTIAL_EXTRA)
      ?: return promise.reject("UserCancelled", "The user cancelled the request.", null)
    val credential = try {
      PublicKeyCredential.deserializeFromBytes(bytes)
    } catch (e: Exception) {
      return promise.reject("UnknownError", "Unreadable credential response", e)
    }
    val response = credential.response
    if (response is AuthenticatorErrorResponse) {
      return promise.reject(codeFor(response.errorCode), response.errorMessage ?: response.errorCode.name, null)
    }
    promise.resolve(credential.toJson())
  }

  private fun settleGet(activity: Activity, data: Intent?, promise: Promise) {
    // Closed with back before Google answered.
    data ?: return promise.reject("UserCancelled", "The user cancelled the request.", null)
    val credential = try {
      Identity.getSignInClient(activity).getSignInCredentialFromIntent(data).publicKeyCredential
    } catch (e: ApiException) {
      val code = if (e.statusCode == CommonStatusCodes.CANCELED) "UserCancelled" else "UnknownError"
      return promise.reject(code, e.message, e)
    }
    // A password or Google account came back instead: not something asked for.
    credential ?: return promise.reject("NoCredentials", "No passkey in the sign-in response", null)
    val response = credential.response
    if (response is AuthenticatorErrorResponse) {
      return promise.reject(codeFor(response.errorCode), response.errorMessage ?: response.errorCode.name, null)
    }
    promise.resolve(credential.toJson())
  }

  // WebAuthn's error names, mapped as react-native-passkey maps them.
  private fun codeFor(error: ErrorCode): String = when (error) {
    // NotAllowed is also how a user's cancel arrives (WebAuthn keeps the two
    // indistinguishable on purpose).
    ErrorCode.NOT_ALLOWED_ERR, ErrorCode.ABORT_ERR -> "UserCancelled"
    ErrorCode.INVALID_STATE_ERR -> "CredentialAlreadyExists"
    ErrorCode.TIMEOUT_ERR -> "TimedOut"
    ErrorCode.NOT_SUPPORTED_ERR -> "NotSupported"
    ErrorCode.CONSTRAINT_ERR -> "BadConfiguration"
    // Security: Google could not tie this app to the relying party
    // (assetlinks.json); the message says so.
    ErrorCode.SECURITY_ERR, ErrorCode.DATA_ERR, ErrorCode.ENCODING_ERR -> "RequestFailed"
    else -> "UnknownError"
  }

  // Task.continueWith wraps the failure it carries; the ApiException inside
  // is the one with Google's status.
  private fun Exception.unwrapApi(): ApiException? = this as? ApiException ?: cause as? ApiException
}
