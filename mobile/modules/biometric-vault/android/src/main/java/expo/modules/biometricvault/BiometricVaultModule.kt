package expo.modules.biometricvault

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
private const val AES_TRANSFORMATION = "AES/GCM/NoPadding"
private const val FORMAT_VERSION: Byte = 1
private const val AES_KEY_BYTES = 32
private const val GCM_IV_BYTES = 12
private const val GCM_TAG_BITS = 128

// Android Keystore only accepts SHA-1 as OAEP's MGF1 digest for decryption
// (before API 34), so both sides spell the parameters out.
private val OAEP_SPEC = OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)

/**
 * Keeps a secret (a locked account's refresh token) so that only the phone's
 * owner can read it back: an RSA key pair in the Android Keystore whose
 * private half needs a strong biometric — or, from Android 11 (API 30), the
 * phone's PIN/pattern/password instead — for every use.
 *
 * Sealing needs no prompt: the secret is encrypted with a random AES key, and
 * that key with the PUBLIC half, which the Keystore never gates. Opening
 * shows the system prompt and decrypts with the private half. A new
 * fingerprint, or removing the screen lock, permanently invalidates the key
 * (the caller then asks for the password).
 */
class BiometricVaultModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BiometricVault")

    // "available" when a key can be made and opened on this phone right now.
    Function("availability") {
      if (canAuthenticate()) "available" else "none"
    }

    AsyncFunction("seal") { alias: String, plaintext: String ->
      seal(alias, plaintext)
    }

    AsyncFunction("open") { alias: String, sealed: String, title: String, cancelLabel: String, promise: Promise ->
      open(alias, sealed, title, cancelLabel, promise)
    }.runOnQueue(Queues.MAIN)

    Function("remove") { alias: String ->
      runCatching { keyStore().deleteEntry(alias) }
      Unit
    }
  }

  private fun allowsDeviceCredential(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R

  private fun authenticators(): Int =
    if (allowsDeviceCredential()) BIOMETRIC_STRONG or DEVICE_CREDENTIAL else BIOMETRIC_STRONG

  private fun canAuthenticate(): Boolean =
    BiometricManager.from(context).canAuthenticate(authenticators()) == BiometricManager.BIOMETRIC_SUCCESS

  private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

  // A fresh key pair per seal: whatever invalidated the previous one (a new
  // fingerprint) does not carry over to an account locked afterwards.
  private fun generateKeyPair(alias: String) {
    val builder = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(2048)
      .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
      .setUserAuthenticationRequired(true)
      .setInvalidatedByBiometricEnrollment(true)
    if (allowsDeviceCredential()) {
      // 0 = every use needs its own authentication, biometric or screen lock.
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
    }
    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE).apply {
      initialize(builder.build())
      generateKeyPair()
    }
  }

  private fun seal(alias: String, plaintext: String): String {
    val store = keyStore()
    if (store.containsAlias(alias)) store.deleteEntry(alias)
    generateKeyPair(alias)

    // Used outside the Keystore so the public-key step never asks for anything.
    val keystorePublic = store.getCertificate(alias).publicKey
    val publicKey = KeyFactory.getInstance(keystorePublic.algorithm).generatePublic(X509EncodedKeySpec(keystorePublic.encoded))

    val random = SecureRandom()
    val aesKey = ByteArray(AES_KEY_BYTES).also(random::nextBytes)
    val iv = ByteArray(GCM_IV_BYTES).also(random::nextBytes)
    try {
      val body = Cipher.getInstance(AES_TRANSFORMATION).run {
        init(Cipher.ENCRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(GCM_TAG_BITS, iv))
        doFinal(plaintext.toByteArray(Charsets.UTF_8))
      }
      val wrappedKey = Cipher.getInstance(RSA_TRANSFORMATION).run {
        init(Cipher.ENCRYPT_MODE, publicKey, OAEP_SPEC)
        doFinal(aesKey)
      }
      val out = ByteBuffer.allocate(1 + 2 + wrappedKey.size + iv.size + body.size)
      out.put(FORMAT_VERSION)
      out.putShort(wrappedKey.size.toShort())
      out.put(wrappedKey)
      out.put(iv)
      out.put(body)
      return Base64.encodeToString(out.array(), Base64.NO_WRAP)
    } finally {
      aesKey.fill(0)
    }
  }

  private class Sealed(val wrappedKey: ByteArray, val iv: ByteArray, val body: ByteArray)

  private fun parse(sealed: String): Sealed {
    val buffer = ByteBuffer.wrap(Base64.decode(sealed, Base64.NO_WRAP))
    require(buffer.get() == FORMAT_VERSION) { "unknown sealed format" }
    val wrappedKey = ByteArray(buffer.short.toInt()).also { buffer.get(it) }
    val iv = ByteArray(GCM_IV_BYTES).also { buffer.get(it) }
    val body = ByteArray(buffer.remaining()).also { buffer.get(it) }
    return Sealed(wrappedKey, iv, body)
  }

  private fun decrypt(unlocked: Cipher, sealed: Sealed): String {
    val aesKey = unlocked.doFinal(sealed.wrappedKey)
    try {
      val plain = Cipher.getInstance(AES_TRANSFORMATION).run {
        init(Cipher.DECRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(GCM_TAG_BITS, sealed.iv))
        doFinal(sealed.body)
      }
      return String(plain, Charsets.UTF_8)
    } finally {
      aesKey.fill(0)
    }
  }

  private fun open(alias: String, sealedValue: String, title: String, cancelLabel: String, promise: Promise) {
    val activity = appContext.currentActivity as? FragmentActivity
      ?: return promise.reject("ERR_VAULT_FAILED", "The app is not in the foreground", null)
    if (!canAuthenticate()) {
      return promise.reject("ERR_VAULT_UNAVAILABLE", "No screen lock or biometric to check", null)
    }
    val sealed = try {
      parse(sealedValue)
    } catch (e: Exception) {
      return promise.reject("ERR_VAULT_INVALIDATED", "Unreadable sealed value", e)
    }
    val cipher = try {
      val key = keyStore().getKey(alias, null) as? PrivateKey
        ?: return promise.reject("ERR_VAULT_INVALIDATED", "The key is gone", null)
      Cipher.getInstance(RSA_TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, key, OAEP_SPEC) }
    } catch (e: KeyPermanentlyInvalidatedException) {
      return promise.reject("ERR_VAULT_INVALIDATED", "The key was invalidated (biometrics or screen lock changed)", e)
    } catch (e: Exception) {
      return promise.reject("ERR_VAULT_FAILED", e.message, e)
    }

    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        try {
          val unlocked = result.cryptoObject?.cipher ?: throw IllegalStateException("No cipher in the result")
          promise.resolve(decrypt(unlocked, sealed))
        } catch (e: Exception) {
          promise.reject("ERR_VAULT_FAILED", e.message, e)
        }
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        val code = when (errorCode) {
          BiometricPrompt.ERROR_USER_CANCELED,
          BiometricPrompt.ERROR_NEGATIVE_BUTTON,
          BiometricPrompt.ERROR_CANCELED -> "ERR_VAULT_CANCELLED"
          BiometricPrompt.ERROR_LOCKOUT,
          BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "ERR_VAULT_LOCKOUT"
          // Nothing left to check against (the lock was removed): only the
          // password can bring the account back. A sensor that is merely busy
          // (ERROR_HW_UNAVAILABLE) is a plain failure, tried again later.
          BiometricPrompt.ERROR_NO_BIOMETRICS,
          BiometricPrompt.ERROR_HW_NOT_PRESENT,
          BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "ERR_VAULT_UNAVAILABLE"
          else -> "ERR_VAULT_FAILED"
        }
        promise.reject(code, errString.toString(), null)
      }
      // onAuthenticationFailed (one wrong finger) is not final: the prompt stays.
    }

    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setConfirmationRequired(false)
      .setAllowedAuthenticators(authenticators())
      .apply { if (!allowsDeviceCredential()) setNegativeButtonText(cancelLabel) }
      .build()
    try {
      BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
        .authenticate(info, BiometricPrompt.CryptoObject(cipher))
    } catch (e: Exception) {
      promise.reject("ERR_VAULT_FAILED", e.message, e)
    }
  }
}
