# Pattern Contract

## Purpose

Cortex patterns are a bounded interpretation layer on top of the file score.

Their role is to:

- explain why a file stands out
- help prioritize where to look first
- make the score easier to interpret without turning it into a verdict

Patterns are maintenance signals. They are not code judgments.

## Allowed evidence

Cortex patterns may only use evidence that already exists in the current model:

- global file score
- score components
- raw structural metrics
- hotspot score
- short-term score trend

This includes signals derived from:

- complexity
- cognitive complexity
- function size
- nesting depth
- churn
- parameter count
- fan-in

Reliability describes how well Cortex can support the pattern from current signals. It does not measure the truth or severity of the underlying problem.

## Supported patterns

### Maintenance Hotspot

**What it is based on**

- elevated file score
- elevated hotspot score
- usually a mix of structural load and recent churn

**What it probably means**

- this file appears costly to change and is already being changed often
- it is a strong candidate for review first

**What it does not mean**

- the file is buggy
- the churn is harmful rather than routine
- the file must be refactored now

**Reliability**

High

### High Structural Load

**What it is based on**

- elevated file score
- structural contributors dominate the signal
- especially complexity, cognitive complexity, function size, or depth

**What it probably means**

- the file is structurally demanding to read or modify
- the score is being driven mainly by code shape rather than recent change activity

**What it does not mean**

- the design is wrong
- the complexity is unnecessary
- the file is dangerous in product or runtime terms

**Reliability**

Medium

### Large Functions

**What it is based on**

- elevated function size contribution
- unusually large routines in the file

**What it probably means**

- at least one routine carries a lot of logic in one place
- the file is likely expensive to review and change

**What it does not mean**

- the routine is incorrect
- length alone makes the code poor

**Reliability**

High

### High Fan-In File

**What it is based on**

- elevated fan-in
- especially when the file is also stressed or critical

**What it probably means**

- many other files depend on this file
- changes here may have broader impact than average

**What it does not mean**

- the file is fragile
- the design is bad
- the file should be split

**Reliability**

High for dependency centrality  
Medium for maintenance concern

### High Churn File

**What it is based on**

- elevated churn contribution
- with no clear proof that structural load is the main driver

**What it probably means**

- this file is being touched often
- it may deserve attention because it has seen repeated recent changes

**What it does not mean**

- the file is unstable
- the recent changes reflect debt rather than routine edits

**Reliability**

Medium

### Recent Score Increase

**What it is based on**

- recent upward score trend
- or a recent threshold crossing

**What it probably means**

- maintenance pressure is increasing
- this file may deserve a recheck soon if the increase continues

**What it does not mean**

- code quality has objectively regressed
- behavior has regressed
- the change is meaningful outside the current scoring window

**Reliability**

Medium

## Disallowed patterns

Cortex must not claim to detect:

- bugs
- safety
- security
- architectural truth
- business criticality
- product importance
- correctness
- code intent
- justified vs unjustified complexity
- trivial vs meaningful churn

It must also avoid judgment-heavy labels such as:

- bug-prone file
- unsafe file
- healthy file
- stable file
- architectural violation
- god object
- necessary complexity

## Usage rule

Patterns explain and prioritize.

Patterns do not judge.

They may describe what the current signal suggests.

They must not present that suggestion as truth.

## Core principle

Cortex names maintenance signals, not code truths.
