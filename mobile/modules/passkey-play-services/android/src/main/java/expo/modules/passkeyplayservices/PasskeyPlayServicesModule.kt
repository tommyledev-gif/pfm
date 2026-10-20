package expo.modules.passkeyplayservices

import android.app.Activity
import android.app.PendingIntent
import android.util.Base64
import com.google.android.gms.fido.Fido
import com.google.android.gms.fido.fido2.api.common.AuthenticatorErrorResponse
import com.google.android.gms.fido.fido2.api.common.ErrorCode
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredential
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialCreationOptions
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialDescriptor
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialRequestOptions
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

// FragmentActivity (which ReactActivity is) only accepts request codes that
// fit in 16 bits.
private const val REQUEST_CODE = 0x7A51
private const val CREDENTIAL_TYPE = "public-key"
private const val MS_PER_SECOND = 1000.0

/**
 * Passkeys through Google Play Services' FIDO2 API, the way Chrome and most
 * apps reach Google Password Manager, for phones where Android 14's own
 * Credential Manager never hands the request to a password service.
 *
 * react-native-passkey goes through androidx.credentials, which on Android 14+
 * asks the system Credential Manager. On some makers' builds (a Vivo V2352A,
 * 2026-10-20) that answers "No create options available." within ~40 ms with
 * Google switched on in every setting, while other apps save passkeys fine:
 * the system service never reaches Google. The same WebAuthn JSON sent here
 * goes to Google Play Services directly. The JS side only calls this after
 * the normal path failed that way (features/security/passkeys/native-passkey.ts).
 *
 * Errors use react-native-passkey's codes, so both paths read the same in JS.
 */
class PasskeyPlayServicesModule : Module() {
  // The ceremony in flight; its answer arrives through OnActivityResult.
  private var pending: Promise? = null

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
      launch(promise) { activity -> Fido.getFido2ApiClient(activity).getRegisterPendingIntent(options) }
    }.runOnQueue(Queues.MAIN)

    // Server's PublicKeyCredentialRequestOptions JSON in, the assertion
    // response JSON out.
    AsyncFunction("get") { requestJson: String, promise: Promise ->
      val options = try {
        requestOptions(JSONObject(requestJson))
      } catch (e: Exception) {
        return@AsyncFunction promise.reject("RequestFailed", "Unreadable request options: ${e.message}", e)
      }
      launch(promise) { activity -> Fido.getFido2ApiClient(activity).getSignPendingIntent(options) }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      settle(payload.data?.getByteArrayExtra(Fido.FIDO2_KEY_CREDENTIAL_EXTRA), promise)
    }
  }

  private fun launch(promise: Promise, pendingIntentFor: (Activity) -> Task<PendingIntent>) {
    val activity = appContext.currentActivity
      ?: return promise.reject("RequestFailed", "No active Activity", null)
    // A sheet that never answered: give it up rather than leave its caller waiting.
    pending?.reject("Interrupted", "Replaced by a new passkey request", null)
    pending = promise
    val fail = { e: Exception ->
      if (pending === promise) pending = null
      promise.reject("RequestFailed", e.message ?: e.javaClass.simpleName, e)
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

  private fun settle(bytes: ByteArray?, promise: Promise) {
    // Closed with back, or swiped away, before Google answered.
    if (bytes == null) return promise.reject("UserCancelled", "The user cancelled the request.", null)
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

  // There is no JSON constructor for request options in play-services-fido
  // 21, unlike creation options: built field by field.
  private fun requestOptions(json: JSONObject): PublicKeyCredentialRequestOptions {
    val builder = PublicKeyCredentialRequestOptions.Builder()
      .setChallenge(base64Url(json.getString("challenge")))
      .setRpId(json.getString("rpId"))
    if (json.has("timeout")) builder.setTimeoutSeconds(json.getDouble("timeout") / MS_PER_SECOND)
    val allowed = json.optJSONArray("allowCredentials")
    val descriptors = (0 until (allowed?.length() ?: 0)).map { i ->
      val item = allowed!!.getJSONObject(i)
      // Transports left out: Google decides how to reach its own passkeys.
      PublicKeyCredentialDescriptor(item.optString("type", CREDENTIAL_TYPE), base64Url(item.getString("id")), null)
    }
    // Empty = discoverable: Google offers every passkey it holds for the rpId.
    builder.setAllowList(descriptors)
    return builder.build()
  }

  private fun base64Url(value: String): ByteArray =
    Base64.decode(value, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
}
