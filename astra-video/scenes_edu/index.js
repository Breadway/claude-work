import { chapterCard } from '../engine/edukit.js';
import { position, outputs, roadmap } from './c01_position.js';
import { objects, anatomy, ids, padding } from './c02_tokens.js';
import { lookup, sum, meaning, size } from './c03_embeddings.js';
import { shapes, dot, linear, nonlin } from './c04_tensors.js';
import { why, qkv, scores, mixing, heads, bidir } from './c05_attention.js';
import { block, layernorm, residual, ffn, dropout, stack } from './c06_block.js';
import { pointer, relu, softmax, mask, pool, valuemlp, target } from './c07_heads.js';
import { ce, smoothing, total, meters } from './c09_loss.js';
import { slope, chain, through, shared } from './c10_backprop.js';
import { lrate, adam, sched, loop } from './c11_optimizer.js';
import { bits, nan, eps, fixes } from './c12_fp16.js';
import { teacher, example, epochs, gap } from './c13_bc.js';
import { protocol, noise } from './c14_eval.js';
import * as c15 from './c15_search.js';
import * as c16 from './c16_az.js';
import * as c17 from './c17_together.js';

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
  chapterCard(7, 'Policy head', 'From 180 context-rich tokens to a choice of action'),
  pointer, relu, softmax, mask,
  chapterCard(8, 'Value head', 'How good is this position for me?'),
  pool, valuemlp, target,
  chapterCard(9, 'Loss', 'Turning "how wrong?" into a single number'),
  ce, smoothing, total, meters,
  chapterCard(10, 'Backpropagation', 'How one loss number reaches every weight'),
  slope, chain, through, shared,
  chapterCard(11, 'Optimizer', 'Gradients in, a better network out'),
  lrate, adam, sched, loop,
  chapterCard(12, 'FP16', 'Why three tiny constants decide whether training survives'),
  bits, nan, eps, fixes,
  chapterCard(13, 'Behaviour cloning', 'Learning to copy a teacher'),
  teacher, example, epochs, gap,
  chapterCard(14, 'Evaluation', 'The only honest test is playing'),
  protocol, noise,
  chapterCard(15, 'Search', 'Thinking before moving'),
  c15.why, c15.puct, c15.leaf, c15.visits,
  chapterCard(16, 'Self-play loop', 'AlphaZero-style, and how it differs'),
  c16.loop, c16.targets, c16.diffs,
  chapterCard(17, 'Everything together', 'One position, forward and backward'),
  c17.forward, c17.backward, c17.zoom,
];
