const EMAIL_RE = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})/g;
const PHONE_RE = /(?:(?:\+|00)?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
const NAME_RE = /\b([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})\b/g;

export class DataSanitizer {
  static sanitize(obj: any, anonymizeNames = process.env.SANITIZE_ANONYMIZE_NAMES === 'true') {
    try {
      if (!obj) return obj;
      const cloned = JSON.parse(JSON.stringify(obj));
      DataSanitizer.walkAndSanitize(cloned, anonymizeNames);
      return cloned;
    } catch (e) {
      return obj;
    }
  }

  private static walkAndSanitize(node: any, anonymizeNames: boolean) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      let s = node as string;
      s = s.replace(EMAIL_RE, '[REDACTED_EMAIL]');
      s = s.replace(PHONE_RE, '[REDACTED_PHONE]');
      if (anonymizeNames) s = s.replace(NAME_RE, '[REDACTED_NAME]');
      return s;
    }
    if (typeof node === 'number' || typeof node === 'boolean') return node;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        node[i] = DataSanitizer.walkAndSanitize(node[i], anonymizeNames) ?? node[i];
      }
      return node;
    }
    if (typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (typeof v === 'string') {
          node[k] = DataSanitizer.walkAndSanitize(v, anonymizeNames);
        } else if (typeof v === 'object') {
          DataSanitizer.walkAndSanitize(v, anonymizeNames);
        }
      }
      return node;
    }
    return node;
  }
}

export default DataSanitizer;
