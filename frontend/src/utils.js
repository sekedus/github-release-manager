export function formatSize(size) {
  if (typeof size !== "number" || isNaN(size)) return "-";
  if (size < 1000) return `${size} B`;
  if (size < 1000 * 1000) return `${(size / 1000).toFixed(1)} KB`;
  if (size < 1000 * 1000 * 1000) return `${(size / (1000 * 1000)).toFixed(2)} MB`;
  return `${(size / (1000 * 1000 * 1000)).toFixed(2)} GB`;
}
