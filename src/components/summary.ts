export type Summary = {
    passed: number;
    failed: number;
    not_implemented: number;
    skipped: number;
    runner_error: number;
    crashed: number;
    timeout: number;
    parse_error: number;
    total: number;
    timestamp: string;
    commit_hash: string;
}

export type TestHistory = {
    runs: Summary[];
}

export const summaryKeys = [
    'passed',
    'failed',
    'not_implemented',
    'skipped',
    'runner_error',
    'crashed',
    'timeout',
    'parse_error',
] as const;
export type SummaryKey = typeof summaryKeys[number];

export const summaryLabels: Record<SummaryKey, string> = {
    passed: 'Passed',
    failed: 'Failed',
    not_implemented: 'Not Implemented',
    skipped: 'Skipped',
    runner_error: 'Runner Error',
    crashed: 'Crashed',
    timeout: 'Timeout',
    parse_error: 'Parse Error',
};

export const summaryColors: Record<SummaryKey, string> = {
    passed: 'rgb(34, 197, 94)',
    failed: 'rgb(239, 68, 68)',
    not_implemented: 'rgb(234, 179, 8)',
    skipped: 'rgb(59, 130, 246)',
    runner_error: 'rgb(168, 85, 247)',
    crashed: 'rgb(244, 114, 182)',
    timeout: 'rgb(251, 146, 60)',
    parse_error: 'rgb(45, 212, 191)',
};

