import { useState } from "react";
import { StyleProp, Text, TextStyle, ViewStyle } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { ShieldIcon } from "@/components/ui/Icon";
import { createStyles, typography, useColors } from "@/lib/theme";
import { completeLogin, LoginOutcome } from "@/features/accounts/complete-login";
import { loginErrorMessage } from "@/features/auth/login-error";
import { PasskeyNativeError, passkeysAvailable } from "@/features/security/passkeys/native-passkey";
import { signInWithPasskey } from "@/features/security/passkeys/passkey-requests";
import { passkeyFailureMessage } from "@/features/security/passkeys/passkey-messages";
import { PasskeyProviderHelp } from "@/features/security/components/PasskeyProviderHelp";

const LABEL = "Đăng nhập bằng passkey";

interface PasskeySignInButtonProps {
  disabled?: boolean;
  onDone?: (outcome: LoginOutcome) => void;
  /** The login screen sizes it like its other actions (56 tall, 16 corners). */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Signs in with whichever passkey this phone holds for the app: the phone
 * offers its passkeys, the server checks the one picked and says whose
 * account it is. Finishes exactly like a password sign-in (completeLogin),
 * so the account is remembered for switching too. Hidden where passkeys
 * cannot run (Expo Go, old Android).
 */
export function PasskeySignInButton({ disabled, onDone, style, textStyle }: PasskeySignInButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProvider, setNeedsProvider] = useState(false);
  if (!passkeysAvailable()) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    setNeedsProvider(false);
    try {
      const result = await signInWithPasskey();
      onDone?.(await completeLogin(result, result.email ?? ""));
    } catch (e) {
      if (e instanceof PasskeyNativeError) {
        // Nothing on the phone can hold a passkey: show the steps, not a line.
        setNeedsProvider(e.kind === "no-provider");
        setError(e.kind === "no-provider" ? null : passkeyFailureMessage(e.kind, "sign-in"));
        return;
      }
      setError(loginErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PillButton
        label={LABEL}
        variant="outline"
        icon={<ShieldIcon size={18} color={colors.textPrimary} />}
        onPress={run}
        loading={busy}
        disabled={disabled}
        style={style}
        textStyle={textStyle}
        testID="btn-login-passkey"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {needsProvider ? (
        <PasskeyProviderHelp onRetry={run} retrying={busy} onDismiss={() => setNeedsProvider(false)} />
      ) : null}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  error: { ...typography.caption, color: colors.peach, textAlign: "center" },
}));
