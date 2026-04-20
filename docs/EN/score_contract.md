# Score Contract

## What the score is

Cortex score is a per-file maintenance risk estimate relative to Cortex's current thresholds and baselines, not a diagnosis.

It is derived from local structural and historical signals in the codebase, such as:

- complexity
- cognitive complexity
- function size
- nesting depth
- recent churn
- parameter count
- fan-in

Its purpose is to help rank files by likely maintenance pressure, so you know where to look first.

## What the score is not

The score does not measure:

- real bugs
- security issues
- business correctness
- product importance
- functional correctness
- test quality
- user impact
- code intent

It is not a truth claim about code quality.

## What a high score means

A high score usually means the file combines some of these traits:

- hard to read
- hard to modify confidently
- structurally dense
- frequently touched
- depended on by many other files

Reasonable inference:

- this file deserves attention sooner than lower-scored files
- this file is more likely to create maintenance cost or review friction
- this file is a good candidate for inspection, not automatic condemnation

## What a low score means

A low score usually means the file looks structurally lighter and less active in recent history than higher-scored files.

Reasonable inference:

- this file is less likely to be an immediate maintenance hotspot
- this file probably does not need to be inspected first

What you should not infer:

- the file is correct
- the file is safe
- the file is well designed
- the file has no hidden risk

Low score means lower structural warning, not proof of quality.

## How to use it

Use the score to:

- prioritize code review
- decide where to inspect first
- compare a file against its own history
- identify files that combine structural load and high recent change activity
- focus discussion on likely maintenance hotspots

Use it as a ranking signal, then read the file.

## How not to use it

Do not use the score to:

- claim that a file is buggy
- claim that a file is safe
- replace human review
- compare very different file roles too literally
- justify architectural conclusions on its own
- present Cortex as a source of objective truth about code quality

The score supports judgment. It does not replace it.

## Core principle

Cortex helps you decide where to look. It does not decide for you.
