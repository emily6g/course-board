export function chunkItems<T>(items: T[], size: number) {
  if (!Number.isInteger(size) || size < 1)
    throw new Error("Chunk size must be a positive integer.");
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    chunks.push(items.slice(index, index + size));
  return chunks;
}
