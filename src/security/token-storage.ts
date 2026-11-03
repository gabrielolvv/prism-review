import { patchLines } from "../analysis/added-lines.js";

// A key or property named for an auth token: `token`, `accessToken`, `refresh_token`, `jwt`,
// `id_token`, or `bearer`. CSRF tokens, push notification and device tokens, and a token's expiry or
// type are not secrets of that kind.
const tokenKey = /^[@_$-]*(?:\w*[_-])?(?:\w*(?:token|jwt|bearer))$/i;
const notSecret = /csrf|xsrf|push|fcm|apns|device|notification|expir|type|count|index|key_?name|cursor|page|pagination|next_?token|continuation/i;

// Browser storage, React Native's AsyncStorage, Android's SharedPreferences, and iOS's
// UserDefaults keep values in the clear: any script on the page can read web storage, and the
// others are unencrypted files on the device.
const webStorage = /\b(?:localStorage|sessionStorage)\b/;
const storageCall = /\b(?:localStorage|sessionStorage|AsyncStorage)\s*\.\s*setItem\s*\(\s*["'`]([^"'`]+)["'`]/g;
const storageProperty = /\b(?:localStorage|sessionStorage)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["'`]([^"'`]+)["'`]\s*\])\s*=(?!=)/g;
const androidPut = /\.\s*put(?:String|StringSet)\s*\(\s*"([^"]+)"/g;
const iosDefaults = /\bUserDefaults\b[^\n]*\bforKey\s*:\s*"([^"]+)"|\bNSUserDefaults\b[^\n]*\bforKey\s*:\s*@"([^"]+)"/g;

const javascript = /\.(?:[cm]?[jt]sx?|vue|svelte)$/i;
const android = /\.(?:java|kt)$/i;
const ios = /\.(?:swift|m|mm)$/i;

const commentLine = /^\s*(?:\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const maxLineLength = 1_000;

// Added lines that keep an auth token in browser storage or unencrypted mobile storage.
export function findTokenStorageLines(path: string, patch: string): number[] {
  const readsJavaScript = javascript.test(path);
  const readsAndroid = android.test(path);
  const readsIos = ios.test(path);
  if ((!readsJavaScript && !readsAndroid && !readsIos) || documentation.test(path) || skippedFile.test(path)) {
    return [];
  }

  const lines = patchLines(patch);
  // EncryptedSharedPreferences encrypts what is put into it.
  const encrypted = readsAndroid && lines.some(({ content }) => /\bEncryptedSharedPreferences\b/.test(content));
  const found: number[] = [];
  for (const { line, content, added } of lines) {
    if (!added || content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const keys: Array<string | undefined> = [];
    if (readsJavaScript) {
      keys.push(...[...content.matchAll(storageCall)].map((match) => match[1]));
      if (webStorage.test(content)) {
        keys.push(...[...content.matchAll(storageProperty)].map((match) => match[1] ?? match[2]));
      }
    }
    if (readsAndroid && !encrypted) {
      keys.push(...[...content.matchAll(androidPut)].map((match) => match[1]));
    }
    if (readsIos) {
      keys.push(...[...content.matchAll(iosDefaults)].map((match) => match[1] ?? match[2]));
    }
    if (keys.some((key) => key !== undefined && tokenKey.test(key) && !notSecret.test(key))) {
      found.push(line);
    }
  }
  return found;
}
