// Only presentation fields may be translated. Identifiers remain byte-for-byte intact.
const opaqueKeys = new Set(['source_refs', 'student', 'response_id', '_source_fingerprint', '_grounding_version', '_analysis_version']);
export function localizeAnalysis(value, labels) {
  if (typeof value === 'string') return labels.reduce((result, [pattern, label]) => result.replace(pattern, label), value);
  if (Array.isArray(value)) return value.map(item => localizeAnalysis(item, labels));
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, opaqueKeys.has(key) ? item : localizeAnalysis(item, labels)])
  );
  return value;
}
