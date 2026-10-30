import { i18n, TranslationKey } from "@/lib/i18n";
import { ChatMessage } from "@/features/ai-chat/types";

type MessageCopy = Pick<ChatMessage, "text" | "textKey" | "textParams">;

/**
 * A reply the app itself puts in the thread, stored as key + params
 * (specs/mobile-language-switch BR-10): rendered through messageText, it
 * reads in whatever language the app is in when it is shown. `text` keeps the
 * sentence in today's language for search and for older app versions.
 */
export function appReply(textKey: TranslationKey, textParams?: Record<string, string | number>): MessageCopy {
  return { text: i18n.t(textKey, textParams), textKey, ...(textParams ? { textParams } : {}) };
}

/**
 * The text to show for a message: its key in the current language when it
 * has one this build knows, else the text it was stored with (a server
 * reply, the User's own words, an app reply from before BR-10). Call it
 * during render of a component that uses useTranslation().
 */
export function messageText(message: MessageCopy): string {
  if (message.textKey && i18n.exists(message.textKey)) return String(i18n.t(message.textKey, message.textParams));
  return message.text;
}
