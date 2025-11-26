/**
 * Cloudflare Vectorize Integration for RAG
 *
 * This module handles:
 * - Generating embeddings via AI API
 * - Storing and querying vectors in Vectorize
 * - Semantic search for similar quotes and requests
 */

import { getAIConfig, isAIConfigured } from './ai';

// Vectorize index configuration
const VECTOR_DIMENSIONS = 1536; // OpenAI ada-002 / text-embedding-3-small dimensions
const SIMILARITY_THRESHOLD = 0.75;
const MAX_RESULTS = 5;

// Metadata types for different vector types
export type VectorType = 'quote' | 'quote_request' | 'product' | 'customer';

export interface VectorMetadata {
  type: VectorType;
  id: string;
  title?: string;
  description?: string;
  serviceType?: string;
  totalAmount?: number;
  createdAt?: string;
  customerId?: string;
  status?: string;
}

export interface SimilarityResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

/**
 * Generate embeddings using configured AI provider
 */
export async function generateEmbedding(
  text: string,
  kv: KVNamespace
): Promise<EmbeddingResult | null> {
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    console.warn('AI not configured, cannot generate embeddings');
    return null;
  }

  const config = await getAIConfig(kv);

  try {
    if (config.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        embedding: data.data[0].embedding,
        model: 'text-embedding-3-small',
      };
    } else {
      // For Anthropic, we use a workaround via OpenAI for embeddings
      // since Anthropic doesn't have a native embeddings API
      // In production, you might want to use a separate OpenAI key for embeddings
      console.warn('Anthropic does not support embeddings, using fallback');
      return null;
    }
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Index a quote for semantic search
 */
export async function indexQuote(
  vectorize: VectorizeIndex,
  kv: KVNamespace,
  quote: {
    id: string;
    title: string;
    description?: string;
    serviceType?: string;
    totalAmount: number;
    customerId?: string;
    status: string;
    createdAt: Date;
    lines?: Array<{ description: string; }>;
  }
): Promise<boolean> {
  // Build text representation for embedding
  const textParts = [
    quote.title,
    quote.description || '',
    quote.serviceType ? `Service: ${quote.serviceType}` : '',
    quote.lines?.map(l => l.description).join('. ') || '',
  ];
  const text = textParts.filter(Boolean).join(' | ');

  const embeddingResult = await generateEmbedding(text, kv);
  if (!embeddingResult) {
    console.warn('Could not generate embedding for quote:', quote.id);
    return false;
  }

  const metadata: VectorMetadata = {
    type: 'quote',
    id: quote.id,
    title: quote.title,
    description: quote.description?.substring(0, 200),
    serviceType: quote.serviceType,
    totalAmount: quote.totalAmount,
    customerId: quote.customerId,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
  };

  try {
    await vectorize.upsert([{
      id: `quote:${quote.id}`,
      values: embeddingResult.embedding,
      metadata,
    }]);
    return true;
  } catch (error) {
    console.error('Failed to index quote:', error);
    return false;
  }
}

/**
 * Index a quote request for semantic search
 */
export async function indexQuoteRequest(
  vectorize: VectorizeIndex,
  kv: KVNamespace,
  request: {
    id: string;
    serviceType: string;
    description: string;
    companyName?: string;
    budgetIndication?: string;
    createdAt: Date;
  }
): Promise<boolean> {
  const textParts = [
    request.description,
    `Service: ${request.serviceType}`,
    request.companyName ? `Company: ${request.companyName}` : '',
    request.budgetIndication ? `Budget: ${request.budgetIndication}` : '',
  ];
  const text = textParts.filter(Boolean).join(' | ');

  const embeddingResult = await generateEmbedding(text, kv);
  if (!embeddingResult) {
    console.warn('Could not generate embedding for quote request:', request.id);
    return false;
  }

  const metadata: VectorMetadata = {
    type: 'quote_request',
    id: request.id,
    description: request.description.substring(0, 200),
    serviceType: request.serviceType,
    createdAt: request.createdAt.toISOString(),
  };

  try {
    await vectorize.upsert([{
      id: `request:${request.id}`,
      values: embeddingResult.embedding,
      metadata,
    }]);
    return true;
  } catch (error) {
    console.error('Failed to index quote request:', error);
    return false;
  }
}

/**
 * Find similar quotes based on a text query
 */
export async function findSimilarQuotes(
  vectorize: VectorizeIndex,
  kv: KVNamespace,
  query: string,
  options: {
    serviceType?: string;
    limit?: number;
    minScore?: number;
  } = {}
): Promise<SimilarityResult[]> {
  const embeddingResult = await generateEmbedding(query, kv);
  if (!embeddingResult) {
    return [];
  }

  const limit = options.limit || MAX_RESULTS;
  const minScore = options.minScore || SIMILARITY_THRESHOLD;

  try {
    // Build filter for quote type
    const filter: VectorizeVectorMetadataFilter = {
      type: 'quote',
    };
    if (options.serviceType) {
      filter.serviceType = options.serviceType;
    }

    const results = await vectorize.query(embeddingResult.embedding, {
      topK: limit,
      filter,
      returnMetadata: 'all',
    });

    return results.matches
      .filter(match => match.score >= minScore)
      .map(match => ({
        id: match.metadata?.id as string || match.id.replace('quote:', ''),
        score: match.score,
        metadata: match.metadata as VectorMetadata,
      }));
  } catch (error) {
    console.error('Failed to query similar quotes:', error);
    return [];
  }
}

/**
 * Find similar quote requests (for deduplication or pattern matching)
 */
export async function findSimilarRequests(
  vectorize: VectorizeIndex,
  kv: KVNamespace,
  query: string,
  options: {
    serviceType?: string;
    limit?: number;
    minScore?: number;
  } = {}
): Promise<SimilarityResult[]> {
  const embeddingResult = await generateEmbedding(query, kv);
  if (!embeddingResult) {
    return [];
  }

  const limit = options.limit || MAX_RESULTS;
  const minScore = options.minScore || SIMILARITY_THRESHOLD;

  try {
    const filter: VectorizeVectorMetadataFilter = {
      type: 'quote_request',
    };
    if (options.serviceType) {
      filter.serviceType = options.serviceType;
    }

    const results = await vectorize.query(embeddingResult.embedding, {
      topK: limit,
      filter,
      returnMetadata: 'all',
    });

    return results.matches
      .filter(match => match.score >= minScore)
      .map(match => ({
        id: match.metadata?.id as string || match.id.replace('request:', ''),
        score: match.score,
        metadata: match.metadata as VectorMetadata,
      }));
  } catch (error) {
    console.error('Failed to query similar requests:', error);
    return [];
  }
}

/**
 * Delete a vector by ID
 */
export async function deleteVector(
  vectorize: VectorizeIndex,
  type: VectorType,
  id: string
): Promise<boolean> {
  try {
    await vectorize.deleteByIds([`${type}:${id}`]);
    return true;
  } catch (error) {
    console.error('Failed to delete vector:', error);
    return false;
  }
}

/**
 * RAG: Get relevant context for a query
 */
export async function getRAGContext(
  vectorize: VectorizeIndex,
  kv: KVNamespace,
  query: string,
  options: {
    types?: VectorType[];
    limit?: number;
    minScore?: number;
  } = {}
): Promise<string> {
  const embeddingResult = await generateEmbedding(query, kv);
  if (!embeddingResult) {
    return '';
  }

  const limit = options.limit || 10;
  const minScore = options.minScore || 0.7;
  const types = options.types || ['quote', 'quote_request'];

  try {
    // Query for each type and combine results
    const allResults: SimilarityResult[] = [];

    for (const type of types) {
      const results = await vectorize.query(embeddingResult.embedding, {
        topK: Math.ceil(limit / types.length),
        filter: { type },
        returnMetadata: 'all',
      });

      for (const match of results.matches) {
        if (match.score >= minScore) {
          allResults.push({
            id: match.metadata?.id as string || match.id,
            score: match.score,
            metadata: match.metadata as VectorMetadata,
          });
        }
      }
    }

    // Sort by score and take top results
    allResults.sort((a, b) => b.score - a.score);
    const topResults = allResults.slice(0, limit);

    // Build context string
    const contextParts = topResults.map(result => {
      const meta = result.metadata;
      if (meta.type === 'quote') {
        return `[Bestaande Offerte] ${meta.title}: ${meta.description || 'Geen beschrijving'} (${meta.serviceType}, €${meta.totalAmount})`;
      } else {
        return `[Eerdere Aanvraag] ${meta.description} (${meta.serviceType})`;
      }
    });

    return contextParts.join('\n\n');
  } catch (error) {
    console.error('Failed to get RAG context:', error);
    return '';
  }
}
