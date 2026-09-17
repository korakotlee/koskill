/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LocalEmbedder,
  getEmbedder,
  resetEmbedder,
} from '../../../src/core/search/embedder.js';

describe('Local ONNX Embedding Pipeline', () => {
  beforeEach(() => {
    resetEmbedder();
  });

  afterEach(() => {
    resetEmbedder();
  });

  it('initializes in an unloaded state to ensure instant daemon startup', () => {
    const embedder = new LocalEmbedder();
    expect(embedder.isLoaded()).toBe(false);
  });

  it('embeds a text prompt into a 384-dimensional Float32Array', async () => {
    const embedder = new LocalEmbedder({ modelName: 'Xenova/all-MiniLM-L6-v2' });
    const vector = await embedder.embed('Git commit message generator skill');

    expect(embedder.isLoaded()).toBe(true);
    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector.length).toBe(384);

    // Verify values are finite numbers
    expect(Number.isFinite(vector[0])).toBe(true);
  });

  it('embeds a batch of texts correctly', async () => {
    const embedder = new LocalEmbedder({ modelName: 'Xenova/all-MiniLM-L6-v2' });
    const batch = await embedder.embedBatch([
      'Search web with DuckDuckGo',
      'Git rebase workflow helper',
    ]);

    expect(batch.length).toBe(2);
    expect(batch[0].length).toBe(384);
    expect(batch[1].length).toBe(384);
  });

  it('computes accurate cosine similarity between vectors', async () => {
    const embedder = new LocalEmbedder({ modelName: 'Xenova/all-MiniLM-L6-v2' });
    const vec1 = await embedder.embed('Write unit tests with Vitest');
    const vec2 = await embedder.embed('Create unit test suite using Vitest framework');
    const vec3 = await embedder.embed('Bake chocolate chip cookies at home');

    const selfSim = embedder.cosineSimilarity(vec1, vec1);
    expect(selfSim).toBeCloseTo(1.0, 3);

    const relatedSim = embedder.cosineSimilarity(vec1, vec2);
    const unrelatedSim = embedder.cosineSimilarity(vec1, vec3);

    expect(relatedSim).toBeGreaterThan(0.7);
    expect(relatedSim).toBeGreaterThan(unrelatedSim);
  });

  it('provides a managed singleton instance via getEmbedder', () => {
    const first = getEmbedder();
    const second = getEmbedder();
    expect(first).toBe(second);

    resetEmbedder();
    const third = getEmbedder();
    expect(third).not.toBe(first);
  });
});
