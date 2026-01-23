/**
 * Evaluation Runner - Executes evaluation scenarios and collects results
 */

import {
  EvaluationScenario,
  EvaluationResult,
  StepResult,
  EvaluationReport,
  StateSnapshot,
} from "./types";
import { captureState, formatStateChanges } from "./state-capturer";

/**
 * Run a single evaluation scenario
 */
export async function runScenario(
  scenario: EvaluationScenario,
  userIds: string[]
): Promise<EvaluationResult> {
  const startTime = new Date();
  const stepResults: StepResult[] = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running Scenario: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Run setup
    console.log(`[Setup] Running scenario setup...`);
    await scenario.setup();
    console.log(`[Setup] ✓ Complete\n`);

    // Run each step
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      console.log(`[Step ${i + 1}/${scenario.steps.length}] ${step.name}`);
      console.log(`  Description: ${step.description}`);

      const stepStartTime = Date.now();

      try {
        // Capture state before
        const beforeState = await captureState(userIds, `Before: ${step.name}`);

        // Execute step action
        console.log(`  Executing action...`);
        const result = await step.action();

        // Capture state after
        const afterState = await captureState(userIds, `After: ${step.name}`);

        // Validate
        console.log(`  Validating...`);
        const validation = await step.validate(result, beforeState, afterState);

        const stepDuration = Date.now() - stepStartTime;

        if (validation.passed) {
          console.log(`  ✓ PASSED (${stepDuration}ms)`);
          console.log(`    ${validation.message}`);
        } else {
          console.log(`  ✗ FAILED (${stepDuration}ms)`);
          console.log(`    ${validation.message}`);
          if (validation.errors) {
            validation.errors.forEach(err => console.log(`    - ${err}`));
          }
        }

        // Show state changes
        console.log(formatStateChanges(beforeState, afterState));

        stepResults.push({
          stepName: step.name,
          description: step.description,
          passed: validation.passed,
          duration: stepDuration,
          beforeState,
          afterState,
          validation,
        });

      } catch (error: any) {
        const stepDuration = Date.now() - stepStartTime;
        console.log(`  ✗ ERROR (${stepDuration}ms)`);
        console.log(`    ${error.message}`);

        stepResults.push({
          stepName: step.name,
          description: step.description,
          passed: false,
          duration: stepDuration,
          beforeState: await captureState(userIds, `Error in: ${step.name}`),
          afterState: await captureState(userIds, `Error in: ${step.name}`),
          validation: {
            passed: false,
            message: 'Step execution failed',
            errors: [error.message],
          },
          error: error.message,
        });
      }

      console.log('');
    }

    // Run cleanup
    console.log(`[Cleanup] Running scenario cleanup...`);
    await scenario.cleanup();
    console.log(`[Cleanup] ✓ Complete\n`);

  } catch (error: any) {
    console.error(`[Error] Scenario failed:`, error);
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();
  const passedSteps = stepResults.filter(s => s.passed).length;
  const failedSteps = stepResults.filter(s => !s.passed).length;

  const result: EvaluationResult = {
    scenarioName: scenario.name,
    startTime,
    endTime,
    duration,
    totalSteps: scenario.steps.length,
    passedSteps,
    failedSteps,
    steps: stepResults,
    summary: `${passedSteps}/${scenario.steps.length} steps passed (${Math.round((passedSteps / scenario.steps.length) * 100)}%)`,
  };

  console.log(`${'='.repeat(60)}`);
  console.log(`Scenario Complete: ${scenario.name}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Result: ${result.summary}`);
  console.log(`${'='.repeat(60)}\n`);

  return result;
}

/**
 * Run multiple evaluation scenarios and generate a report
 */
export async function runEvaluation(
  scenarios: EvaluationScenario[],
  userIds: string[]
): Promise<EvaluationReport> {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`# EVALUATION FRAMEWORK - Starting Evaluation`);
  console.log(`# Scenarios: ${scenarios.length}`);
  console.log(`# Users: ${userIds.length}`);
  console.log(`${'#'.repeat(60)}\n`);

  const results: EvaluationResult[] = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, userIds);
    results.push(result);
  }

  const passedScenarios = results.filter(r => r.failedSteps === 0).length;
  const failedScenarios = results.filter(r => r.failedSteps > 0).length;

  const report: EvaluationReport = {
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarios,
    scenarios: results,
    timestamp: new Date(),
    environment: {
      nodeVersion: process.version,
      databaseConnected: true, // TODO: Add actual check
    },
  };

  // Print summary
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`# EVALUATION COMPLETE`);
  console.log(`${'#'.repeat(60)}`);
  console.log(`\nScenarios: ${report.totalScenarios}`);
  console.log(`  Passed: ${report.passedScenarios}`);
  console.log(`  Failed: ${report.failedScenarios}`);
  console.log(`\nResults:`);
  results.forEach((r, i) => {
    const status = r.failedSteps === 0 ? '✓' : '✗';
    console.log(`  ${status} ${r.scenarioName}: ${r.summary}`);
  });
  console.log(`\nTimestamp: ${report.timestamp.toISOString()}`);
  console.log(`Environment: Node ${report.environment.nodeVersion}`);
  console.log(`${'#'.repeat(60)}\n`);

  return report;
}

/**
 * Generate JSON report file
 */
export function generateReportJSON(report: EvaluationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate markdown report
 */
export function generateReportMarkdown(report: EvaluationReport): string {
  const lines: string[] = [];

  lines.push(`# Evaluation Report`);
  lines.push(`\nGenerated: ${report.timestamp.toISOString()}`);
  lines.push(`\n## Summary\n`);
  lines.push(`- **Total Scenarios**: ${report.totalScenarios}`);
  lines.push(`- **Passed**: ${report.passedScenarios} ✓`);
  lines.push(`- **Failed**: ${report.failedScenarios} ✗`);
  lines.push(`- **Success Rate**: ${Math.round((report.passedScenarios / report.totalScenarios) * 100)}%`);

  lines.push(`\n## Environment\n`);
  lines.push(`- **Node Version**: ${report.environment.nodeVersion}`);
  lines.push(`- **Database**: ${report.environment.databaseConnected ? 'Connected' : 'Disconnected'}`);

  lines.push(`\n## Scenarios\n`);

  for (const scenario of report.scenarios) {
    const status = scenario.failedSteps === 0 ? '✓ PASSED' : '✗ FAILED';
    lines.push(`\n### ${status}: ${scenario.scenarioName}\n`);
    lines.push(`**Duration**: ${scenario.duration}ms`);
    lines.push(`**Steps**: ${scenario.passedSteps}/${scenario.totalSteps} passed\n`);

    lines.push(`#### Steps:\n`);
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepStatus = step.passed ? '✓' : '✗';
      lines.push(`${i + 1}. ${stepStatus} **${step.stepName}** (${step.duration}ms)`);
      lines.push(`   - ${step.validation.message}`);
      if (!step.passed && step.validation.errors) {
        step.validation.errors.forEach(err => {
          lines.push(`   - Error: ${err}`);
        });
      }
    }
  }

  return lines.join('\n');
}
