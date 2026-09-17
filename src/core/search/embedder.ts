import { pipeline } from '@xenova/transformers';
import { Logger } from '../logger.js';

const logger = new Logger();

export interface LocalEmbedderOptions {
  modelName?: string;
  quantized?: boolean;
}

/**
 * Local neural text embedding service utilizing ONNX models via Xenova Transformers.
 * Loads weights lazily upon first inference to preserve fast daemon cold-start times.
 */
export class LocalEmbedder {
  private modelName: string;
  private quantized: boolean;
  private extractor: unknown = null;
  private loadingPromise: Promise<unknown> | null = null;

  constructor(options: LocalEmbedderOptions = {}) {
    this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
    this.quantized = options.quantized !== undefined ? options.quantized : true;
  }

  /**
   * Returns whether the ONNX embedding weights are currently resident in memory.
   */
  public isLoaded(): boolean {
    return this.extractor !== null;
  }

  /**
   * Asynchronously loads the feature extraction pipeline.
   */
  public async load(): Promise<void> {
    if (this.extractor) {
      return;
    }
    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = (async () => {
      try {
        logger.info(`Loading ONNX feature extraction pipeline: ${this.modelName}`);
        const pipe = await pipeline('feature-extraction', this.modelName, {
          quantized: this.quantized,
        });
        this.extractor = pipe;
        logger.info(`Successfully loaded ONNX model: ${this.modelName}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to initialize ONNX embedding model: ${msg}`);
        throw err;
      } finally {
        this.loadingPromise = null;
      }
    })();

    await this.loadingPromise;
  }

  /**
   * Computes a 384-dimensional normalized dense embedding vector for the provided text.
   */
  public async embed(text: string): Promise<Float32Array> {
    await this.load();
    const extractorFn = this.extractor as (
      text: string,
      options: Record<string, unknown>
    ) => Promise<{ data: Float32Array }>;

    const output = await extractorFn(text, {
      pooling: 'mean',
      normalize: true,
    });

    return new Float32Array(output.data);
  }

  /**
   * Computes dense embeddings for an array of input texts.
   */
  public async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }
    await this.load();
    const results: Float32Array[] = [];
    for (const text of texts) {
      const vec = await this.embed(text);
      results.push(vec);
    }
    return results;
  }

  /**
   * Calculates cosine similarity between two dense vectors.
   * Assumes vectors are unit-normalized (dot product equals cosine similarity).
   */
  public cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) {
      return 0;
    }
    return dot / denom;
  }
}

let defaultEmbedderInstance: LocalEmbedder | null = null;

/**
 * Returns the default singleton LocalEmbedder instance.
 */
export function getEmbedder(options?: LocalEmbedderOptions): LocalEmbedder {
  if (!defaultEmbedderInstance) {
    defaultEmbedderInstance = new LocalEmbedder(options);
  }
  return defaultEmbedderInstance;
}

/**
 * Resets the default singleton instance (primarily for testing).
 */
export function resetEmbedder(): void {
  defaultEmbedderInstance = null;
}
