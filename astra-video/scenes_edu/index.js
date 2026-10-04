import { chapterCard } from '../engine/edukit.js';
import { position, outputs, roadmap } from './c01_position.js';
import { objects, anatomy, ids, padding } from './c02_tokens.js';
import { lookup, sum, meaning, size } from './c03_embeddings.js';
import { shapes, dot, linear, nonlin } from './c04_tensors.js';
import { why, qkv, scores, mixing, heads, bidir } from './c05_attention.js';
import { block, layernorm, residual, ffn, dropout, stack } from './c06_block.js';

export const OPTS = {
  chapters: ['What Astra learns', 'Tokens', 'Embeddings', 'Tensors & Linear', 'Attention', 'The transformer block', 'Policy head', 'Value head', 'Loss', 'Backpropagation', 'Optimizer', 'FP16', 'Behaviour cloning', 'Evaluation', 'Search', 'Self-play loop', 'Everything together'],
  loc: ['TOKENS', 'EMBED', 'ATTENTION', 'BLOCK', 'HEADS', 'LOSS', 'TRAIN', 'SEARCH'],
};

export default [
  chapterCard(1, 'What Astra learns', 'One position, two answers: what to do, and how good it is'),
  position, outputs, roadmap,
  chapterCard(2, 'Tokens', 'Turning a game position into 180 small integer records'),
  objects, anatomy, ids, padding,
  chapterCard(3, 'Embeddings', 'Every integer becomes a row of learned numbers'),
  lookup, sum, meaning, size,
  chapterCard(4, 'Tensors & Linear', 'Numbers with shapes, and the one operation that does the learning'),
  shapes, dot, linear, nonlin,
  chapterCard(5, 'Attention', 'How 180 tokens read each other'),
  why, qkv, scores, mixing, heads, bidir,
  chapterCard(6, 'The transformer block', 'Attention, normalisation, a feed-forward network, repeated six times'),
  block, layernorm, residual, ffn, dropout, stack,
];
