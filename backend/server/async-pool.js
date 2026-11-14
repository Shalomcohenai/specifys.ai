/**
 * Run async work with a fixed concurrency cap. Results stay in input order.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, concurrency, fn) {
  const list = Array.from(items || []);
  if (list.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency || 1, list.length));
  const results = new Array(list.length);
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

module.exports = { mapWithConcurrency };
