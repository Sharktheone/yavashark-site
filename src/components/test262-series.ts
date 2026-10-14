// Stack order (bottom to top). Colors are --c1..--c8 from styles/theme.scss, in this order.
export const SERIES = [
    { key: "passed", label: "passed" },
    { key: "failed", label: "failed" },
    { key: "not_implemented", label: "not implemented" },
    { key: "parse_error", label: "parse error" },
    { key: "timeout", label: "timeout" },
    { key: "crashed", label: "crashed" },
    { key: "skipped", label: "skipped" },
    { key: "runner_error", label: "runner error" },
] as const;

export type SeriesKey = (typeof SERIES)[number]["key"];
