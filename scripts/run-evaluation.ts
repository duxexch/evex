#!/usr/bin/env tsx
/**
 * Evaluation CLI
 * Command-line interface for running evaluations
 */

import { runEvaluationFramework } from '../server/evaluation';

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          EVALUATION FRAMEWORK - Challenge System          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

runEvaluationFramework();
