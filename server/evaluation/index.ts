/**
 * Evaluation Framework Entry Point
 * Main CLI for running evaluations
 */

import { runEvaluation, generateReportJSON, generateReportMarkdown } from "./runner";
import { createChallengeScenario, challengeAcceptanceScenario } from "./scenarios";
import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Main evaluation runner
 */
async function main() {
  console.log('\n🚀 Starting Evaluation Framework...\n');

  // Define scenarios to run
  const scenarios = [
    createChallengeScenario,
    challengeAcceptanceScenario,
  ];

  // Run evaluation
  const report = await runEvaluation(scenarios, []);

  // Generate reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = join(process.cwd(), 'evaluation-reports');

  try {
    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = join(reportDir, `evaluation-${timestamp}.json`);
    writeFileSync(jsonPath, generateReportJSON(report), 'utf-8');
    console.log(`\n📄 JSON Report saved: ${jsonPath}`);

    // Save Markdown report
    const mdPath = join(reportDir, `evaluation-${timestamp}.md`);
    writeFileSync(mdPath, generateReportMarkdown(report), 'utf-8');
    console.log(`📄 Markdown Report saved: ${mdPath}`);

  } catch (error: any) {
    console.error('Error saving reports:', error.message);
  }

  // Exit with appropriate code
  const exitCode = report.failedScenarios > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runEvaluationFramework };
