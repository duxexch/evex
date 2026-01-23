/**
 * Type definitions for the evaluation framework
 */

export interface EvaluationContext {
  userId: string;
  username: string;
  initialBalance: number;
  timestamp: Date;
}

export interface StateSnapshot {
  timestamp: Date;
  description: string;
  database: {
    users?: any[];
    challenges?: any[];
    liveGameSessions?: any[];
    currencyLedger?: any[];
    notifications?: any[];
  };
  memory: {
    websocketConnections?: number;
    queuedMessages?: number;
  };
}

export interface EvaluationStep {
  name: string;
  description: string;
  action: () => Promise<any>;
  validate: (result: any, beforeState: StateSnapshot, afterState: StateSnapshot) => Promise<ValidationResult>;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
  errors?: string[];
}

export interface EvaluationScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  steps: EvaluationStep[];
  cleanup: () => Promise<void>;
}

export interface EvaluationResult {
  scenarioName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  steps: StepResult[];
  summary: string;
}

export interface StepResult {
  stepName: string;
  description: string;
  passed: boolean;
  duration: number;
  beforeState: StateSnapshot;
  afterState: StateSnapshot;
  validation: ValidationResult;
  error?: string;
}

export interface EvaluationReport {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: EvaluationResult[];
  timestamp: Date;
  environment: {
    nodeVersion: string;
    databaseConnected: boolean;
  };
}
