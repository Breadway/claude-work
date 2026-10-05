# ASTRA-7 explained: chapter and scene plan (video 2)

Status: plan only. Nothing here is rendered. `[DOC]` = grounded in ASTRA7-NET.md / ASTRA7.md / STATE.md already supplied.
`[SPEC]` = stated in the video brief. `[NEED]` = I need the real source/log to state it exactly (see "Information needed").

## Visual language (kept identical across all 17 chapters)
- State tokens cyan, history tokens green, action tokens orange, policy gold, value blue-violet, gradients red,
  loss/teacher pink, search/tree purple, masks/padding grey.
- One persistent "Astra spine" (left-to-right data flow: tokens → embeddings → 6 blocks → heads) that is the same drawing in
  every chapter; chapters zoom into it and always zoom back out. A progress rail (17 ticks) and chapter cards.
- One running example (a single Novacana decision) re-used from Chapter 1 to 17. Policy example vector [2.1, -0.4, 3.2, 1.7].

## New engine primitives to build (extends the existing engine)
`MatrixView` (grid with row/col highlight, value tint, morph between shapes) · `TensorFlow` (labelled slabs moving through ops) ·
`CameraRig` (pan/zoom/rack-focus on a scene group, match-cut helpers) · `EquationBlock` (symbol-by-symbol reveal, hover-highlight
mapping each symbol to a drawn object) · `TokenCard` (game object ↔ 8-byte token morph) · `TreeView` (MCTS tree with PUCT stats) ·
`CurveLab` (loss/precision plots) · `BitsView` (FP16/FP32 bit layout) · `SpineMap` (the persistent architecture drawing + progress rail).

## Chapters

| # | Chapter | Scenes (teaching beats 1→7 where relevant) | Est. |
|---|---|---|---|
| 1 | What Astra learns | real position (hand, 3 opponents, systems, history, legal actions) → "which action, how likely to win?" → policy vs value | 3:00 |
| 2 | Tokens | game objects fly into 180 slots (52/64/64); token anatomy (type + 7 fields); why IDs are categories not quantities; pads | 3:30 |
| 3 | Embeddings | integer → row lookup; 1 type table + 7 field tables; 8×256 summed; random-at-start → shaped by training (animated drift) | 3:00 |
| 4 | Tensors & Linear | scalar→vector→matrix→tensor; matmul; tiny numeric Linear; scale up to 256→1024 without drawing every number; weights/bias | 3:30 |
| 5 | Attention | one head, 4 tokens; Q,K,V; QKᵀ; ÷√d_k; mask; softmax; ·V; then 8 heads × d_k 32; bidirectional (state/history/actions) | 8:00 |
| 6 | The transformer block | LN → MHA → dropout → +res → LN → FFN(256→1024→256, GELU) → dropout → +res; ×6 | 5:00 |
| 7 | Policy head | shared MLP 256→256→1 per action token; logits [2.1,-0.4,3.2,1.7] → softmax; legal mask | 3:00 |
| 8 | Value head | mean-pool state tokens (pads excluded); 256→256→1→sigmoid; BC target 1/0; why predict the winner early | 2:30 |
| 9 | Loss | CE on a real small example, label smoothing 0.05, value MSE, 0.3 weighting; what Mission Control's two numbers mean | 4:00 |
| 10 | Backpropagation | sensitivity; chain rule drawn as flowing influence; gradients back through heads → 6 blocks → embeddings | 4:30 |
| 11 | Optimizer | param/gradient/lr/update; Adam (m, v, bias correction, ε); global-norm clip 1.0; LR schedule `[NEED]`; one update, then millions | 4:00 |
| 12 | FP16 | FP32 vs FP16 bit layout; range; −1e9 → −inf → NaN; why −1e4 works; Adam ε 1e-2 on the Vulkan build `[NEED]` | 3:30 |
| 13 | Behaviour cloning | ExpertCPU games → decisions → (obs, legal actions, choice, outcome); batches/epochs; 43.91%/0% case; distribution shift | 5:00 |
| 14 | Evaluation | train/val loss, accuracy, top-k, win rate vs 3 AdvCPU as seat 0; noise at n | 2:30 |
| 15 | Search (MCTS) | tree build, PUCT, 6 simulations on a toy tree, visit distribution, "net vs net+search"; **Astra's one-level-deep variant** | 5:30 |
| 16 | AlphaZero-style loop | self-play → targets → train → repeat; replay window; snapshot opponents; Astra vs canonical differences | 4:30 |
| 17 | Everything together | replay Chapter 1 position forward, then backward, then zoom out to millions of examples | 4:00 |

**Estimated total ≈ 69 minutes** of narrated animation (≈ 1,350 s of speech per 10 minutes at the ~145 wpm the TTS delivered
→ about 10,000 words, which fits in roughly 12–14 batched TTS requests of ≤10 min each).
Render cost at the current ~6 fps: about 6 hours for 30 fps, about 4.7 hours at 24 fps. Plan: render per chapter (17 files) so a failure
never costs the whole film, then concatenate. A shorter cut (chapters 5–6 compressed) is possible if you prefer ~55 minutes.

## Caption/narration structure
Each scene keeps the existing `caps: [[t, text], ...]` contract so narration can be generated later and the film retimed to it with
the existing piecewise time-warp (no animation restructuring). Chapter cards carry no narration.

## Truth rules
Anything not confirmed from source is drawn with the label "illustrative". Astra-specific differences from the textbook (pointer policy, 180-slot
bidirectional encoder without positional table, one-level-deep search, ExpertCPU teacher, label smoothing over the legal set) are called out
explicitly when they appear.

## Information needed (blocking items first)
1. **A real captured decision**: the `GameView` and legal-action list for one decision, plus ExpertCPU's choice, ideally the exact token ids
   (output of the tokens encoder), or one frame from `models/spectator_game.json`. Otherwise I will draw an *illustrative* position.
2. **Source of the net + training loop** (the Novacana GitHub repo I can reach only contains the 2025 web game, not `ml7/`): `ml7/src/net.rs`,
   `tokens.rs`, the BC training function in `main.rs` (optimizer, betas, ε, weight decay, clip, LR schedule, batch size, label smoothing,
   loss weights), and `mcts.rs` + `az.rs` (PUCT constants, leaf evaluation, targets, replay window, snapshot opponents, loss).
3. **The FP16 incident**: the commit/log where −1e9 produced NaN and became the finite −1e4 mask; which backend/GPU that run used.
4. **The "43.91% after epoch 1 / 0% win rate" run**: its command line and log lines (batch size, games per epoch, epochs).
5. **Rules of Novacana in one page** (win condition, what chains/flares/fractures do) so the example position can be explained correctly.
6. **Mission Control**: a screenshot of the policy/value loss panels, so Chapter 9 can map to what you actually look at.
7. Preferences: ~69 min total vs a ~55 min cut; 30 fps vs 24 fps; same Sadaltager voice.
