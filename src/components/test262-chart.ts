// Hand-rolled SVG chart for the test262 history: stacked areas per result
// category, togglable series, count/% scale, range presets and zooming.
// Colors live in CSS (theme variables), so this only computes geometry.

import { SERIES, type SeriesKey } from "./test262-series";

const ENDPOINT = "https://raw.githubusercontent.com/Sharktheone/yavashark-data/refs/heads/main/history.json";
const DAY = 86_400_000;
const MIN_SPAN = DAY;
const SVG = "http://www.w3.org/2000/svg";

type Run = Record<SeriesKey, number> & { t: number; commit: string; total: number };
type Mode = "count" | "share";

const num = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const fmtDayTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
const fmtMonthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    parent?.appendChild(node);
    return node;
}

function niceStep(max: number, count: number) {
    const raw = max / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const n = raw / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function timeTicks(from: number, to: number, maxTicks: number) {
    const spanDays = (to - from) / DAY;
    const dayStep = [1, 2, 7, 14].find((s) => spanDays / s <= maxTicks);
    const ticks: { t: number; label: string }[] = [];

    if (dayStep) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        for (; d.getTime() <= to; d.setDate(d.getDate() + dayStep)) ticks.push({ t: d.getTime(), label: fmtDay.format(d) });
        return ticks;
    }

    const step = [1, 2, 3, 6, 12].find((s) => spanDays / (30.4 * s) <= maxTicks) ?? 12;
    const d = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 1);
    while (d.getMonth() % step !== 0) d.setMonth(d.getMonth() + 1);
    for (; d.getTime() <= to; d.setMonth(d.getMonth() + step)) {
        const label = d.getMonth() === 0 || ticks.length === 0 ? fmtMonthYear.format(d) : fmtMonth.format(d);
        ticks.push({ t: d.getTime(), label });
    }
    return ticks;
}

/** Index of the first run with t >= time. */
function lowerBound(runs: Run[], time: number) {
    let lo = 0;
    let hi = runs.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (runs[mid].t < time) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function nearest(runs: Run[], time: number) {
    const i = Math.min(lowerBound(runs, time), runs.length - 1);
    return i > 0 && time - runs[i - 1].t < runs[i].t - time ? i - 1 : i;
}

export function mountChart(root: HTMLElement) {
    const svg = root.querySelector<SVGSVGElement>(".t2-svg")!;
    const plot = root.querySelector<HTMLElement>(".t2-plot")!;
    const tip = root.querySelector<HTMLElement>(".t2-tip")!;
    const reset = root.querySelector<HTMLButtonElement>(".t2-reset")!;
    const rangeInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="t2-range"]')];
    const modeInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="t2-mode"]')];
    const seriesInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="t2-series"]')];

    let runs: Run[] = [];
    let view = { from: 0, to: 0 };
    let mode: Mode = "count";
    let enabled = SERIES.filter((s) => seriesInputs.find((i) => i.value === s.key)?.checked);
    let active = -1;
    let dragFrom: number | null = null;
    let geo: { x: (t: number) => number; t: (x: number) => number; y: (v: number) => number; left: number; right: number; top: number; bottom: number } | null = null;
    let hover: SVGGElement | null = null;
    let sel: SVGRectElement | null = null;

    const extent = () => ({ from: runs[0].t, to: runs[runs.length - 1].t });
    const value = (r: Run, key: SeriesKey) => (mode === "share" ? r[key] / r.total : r[key]);

    function setView(from: number, to: number, preset = false) {
        const all = extent();
        const span = Math.max(MIN_SPAN, Math.min(to - from, all.to - all.from));
        from = Math.max(all.from, Math.min(from, all.to - span));
        view = { from, to: from + span };

        const isFull = view.from <= all.from && view.to >= all.to;
        if (!preset) rangeInputs.forEach((i) => (i.checked = isFull && i.value === "all"));
        reset.hidden = isFull;
        active = -1;
        render();
    }

    function applyPreset() {
        const value = rangeInputs.find((i) => i.checked)?.value ?? "all";
        const all = extent();
        setView(value === "all" ? all.from : all.to - Number(value) * DAY, all.to, true);
    }

    function zoomAt(time: number, factor: number) {
        const from = time - (time - view.from) * factor;
        const to = time + (view.to - time) * factor;
        setView(from, to);
    }

    function updateChips(r: Run | undefined) {
        for (const s of SERIES) {
            const b = root.querySelector(`[data-value="${s.key}"]`)!;
            b.textContent = r ? (mode === "share" ? pct(r[s.key] / r.total) : num.format(r[s.key])) : "";
        }
    }

    function render() {
        const width = plot.clientWidth;
        const height = plot.clientHeight;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.replaceChildren();
        if (!runs.length || !width) return;

        const left = 46;
        const right = width - 6;
        const top = 8;
        const bottom = height - 24;

        // Visible runs plus one neighbor on each side so areas reach the edges.
        const lo = Math.max(0, lowerBound(runs, view.from) - 1);
        const hi = Math.min(runs.length - 1, lowerBound(runs, view.to + 1));
        const visible = runs.slice(lo, hi + 1);

        const span = view.to - view.from;
        const x = (t: number) => left + ((t - view.from) / span) * (right - left);
        const t = (px: number) => view.from + ((px - left) / (right - left)) * span;

        const inView = visible.filter((r) => r.t >= view.from && r.t <= view.to);
        const sums = (inView.length ? inView : visible).map((r) => enabled.reduce((acc, s) => acc + value(r, s.key), 0));
        const max = Math.max(...sums, mode === "share" ? 0.01 : 1);
        const step = niceStep(max, height < 300 ? 3 : 4);
        const yMax = mode === "share" ? Math.min(1, Math.ceil(max / step) * step) : Math.ceil(max / step) * step;
        const y = (v: number) => bottom - (v / yMax) * (bottom - top);
        geo = { x, t, y, left, right, top, bottom };

        // Grid + axes
        const axes = el("g", {}, svg);
        for (let v = 0; v <= yMax + step / 1000; v += step) {
            el("line", { class: "grid", x1: left, x2: right, y1: y(v), y2: y(v) }, axes);
            const label = mode === "share" ? pct(v, 0) : compact.format(v);
            el("text", { class: "tick", x: left - 8, y: y(v), "text-anchor": "end", "dominant-baseline": "middle" }, axes).textContent = label;
        }
        for (const tick of timeTicks(view.from, view.to, Math.max(2, Math.floor((right - left) / 90)))) {
            el("text", { class: "tick", x: x(tick.t), y: bottom + 17, "text-anchor": "middle" }, axes).textContent = tick.label;
        }

        // Stacked bands, clipped to the plot area
        const clipId = "t2-clip";
        const clip = el("clipPath", { id: clipId }, svg);
        el("rect", { x: left, y: top - 2, width: right - left, height: bottom - top + 2 }, clip);
        const bands = el("g", { "clip-path": `url(#${clipId})` }, svg);

        const base = visible.map(() => 0);
        for (const s of enabled) {
            const slot = SERIES.indexOf(s) + 1;
            const upper = visible.map((r, i) => base[i] + value(r, s.key));
            const pts = (vals: number[]) => visible.map((r, i) => `${x(r.t).toFixed(1)},${y(vals[i]).toFixed(1)}`);
            const top = pts(upper);
            const bottomPts = pts(base).reverse();
            el("path", { class: "band", fill: `var(--c${slot})`, d: `M${top.join("L")}L${bottomPts.join("L")}Z` }, bands);
            el("path", { class: "edge", stroke: `var(--c${slot})`, d: `M${top.join("L")}` }, bands);
            upper.forEach((v, i) => (base[i] = v));
        }

        sel = el("rect", { class: "sel", y: top, height: bottom - top, width: 0, visibility: "hidden" }, svg);
        hover = el("g", { visibility: "hidden" }, svg);

        if (active >= 0) show(active);
        else updateChips(inView[inView.length - 1] ?? visible[visible.length - 1]);
    }

    function show(i: number) {
        if (!geo || !hover || !runs[i]) return;
        active = i;
        const r = runs[i];
        const cx = geo.x(r.t);
        hover.replaceChildren();
        hover.setAttribute("visibility", "visible");
        el("line", { class: "cross", x1: cx, x2: cx, y1: geo.top, y2: geo.bottom }, hover);

        let acc = 0;
        for (const s of enabled) {
            acc += value(r, s.key);
            if (r[s.key] > 0) el("circle", { class: "dot", cx, cy: geo.y(acc), r: 3.5, fill: `var(--c${SERIES.indexOf(s) + 1})` }, hover);
        }

        updateChips(r);
        const date = document.createElement("div");
        date.textContent = fmtDayTime.format(r.t);
        const meta = document.createElement("span");
        meta.textContent = `${r.commit.slice(0, 7)} · ${num.format(r.total)} tests · ${pct(r.passed / r.total)} pass`;
        tip.replaceChildren(date, meta);
        tip.hidden = false;

        const w = tip.offsetWidth;
        tip.style.left = `${cx + 12 + w > plot.clientWidth ? cx - 12 - w : cx + 12}px`;
        svg.setAttribute("aria-label", `${fmtDayTime.format(r.t)}: ${enabled.map((s) => `${num.format(r[s.key])} ${s.label}`).join(", ")}`);
    }

    function hide() {
        active = -1;
        hover?.setAttribute("visibility", "hidden");
        tip.hidden = true;
        render();
    }

    const localX = (e: MouseEvent) => e.clientX - svg.getBoundingClientRect().left;
    const clampX = (px: number) => Math.max(geo!.left, Math.min(geo!.right, px));

    svg.addEventListener("pointerdown", (e) => {
        if (!geo || e.button !== 0) return;
        e.preventDefault(); // keep mouse drags from focusing the chart
        dragFrom = clampX(localX(e));
        svg.setPointerCapture(e.pointerId);
    });

    svg.addEventListener("pointermove", (e) => {
        if (!geo || !runs.length) return;
        const px = localX(e);
        if (dragFrom !== null && sel) {
            const a = Math.min(dragFrom, clampX(px));
            const b = Math.max(dragFrom, clampX(px));
            sel.setAttribute("x", String(a));
            sel.setAttribute("width", String(b - a));
            sel.setAttribute("visibility", "visible");
        }
        if (px < geo.left - 4 || px > geo.right + 4) {
            if (active >= 0) hide();
            return;
        }
        const first = lowerBound(runs, view.from);
        const last = Math.max(first, lowerBound(runs, view.to + 1) - 1);
        const i = Math.max(first, Math.min(last, nearest(runs, geo.t(px))));
        if (i !== active) show(i);
    });

    svg.addEventListener("pointerup", (e) => {
        if (dragFrom === null || !geo) return;
        const to = clampX(localX(e));
        const [a, b] = [Math.min(dragFrom, to), Math.max(dragFrom, to)];
        dragFrom = null;
        if (b - a > 8) setView(geo.t(a), geo.t(b));
        else sel?.setAttribute("visibility", "hidden");
    });

    svg.addEventListener("pointerleave", () => dragFrom === null && hide());
    svg.addEventListener("dblclick", () => applyPresetAll());

    // Ctrl/⌘ + wheel (and trackpad pinch) zooms, horizontal scrolling pans.
    svg.addEventListener(
        "wheel",
        (e) => {
            if (!geo) return;
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                zoomAt(geo.t(clampX(localX(e))), Math.exp(e.deltaY * 0.01));
            } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !reset.hidden) {
                e.preventDefault();
                const shift = (e.deltaX / (geo.right - geo.left)) * (view.to - view.from);
                setView(view.from + shift, view.to + shift);
            }
        },
        { passive: false },
    );

    svg.addEventListener("focus", () => show(lowerBound(runs, view.to + 1) - 1));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (e) => {
        if (!runs.length) return;
        const step = e.shiftKey ? 10 : 1;
        const at = active >= 0 ? runs[active].t : view.to;
        const keys: Record<string, () => void> = {
            ArrowLeft: () => show(Math.max(lowerBound(runs, view.from), active - step)),
            ArrowRight: () => show(Math.min(lowerBound(runs, view.to + 1) - 1, active + step)),
            "+": () => zoomAt(at, 0.7),
            "=": () => zoomAt(at, 0.7),
            "-": () => zoomAt(at, 1 / 0.7),
            "0": () => applyPresetAll(),
            Escape: hide,
        };
        if (keys[e.key]) {
            e.preventDefault();
            keys[e.key]();
        }
    });

    function applyPresetAll() {
        rangeInputs.forEach((i) => (i.checked = i.value === "all"));
        applyPreset();
    }

    reset.addEventListener("click", applyPresetAll);
    rangeInputs.forEach((i) => i.addEventListener("change", applyPreset));
    modeInputs.forEach((i) =>
        i.addEventListener("change", () => {
            mode = i.value as Mode;
            render();
        }),
    );
    seriesInputs.forEach((i) =>
        i.addEventListener("change", () => {
            enabled = SERIES.filter((s) => seriesInputs.find((x) => x.value === s.key)?.checked);
            render();
        }),
    );
    new ResizeObserver(() => runs.length && render()).observe(plot);

    fetch(ENDPOINT)
        .then((res) => {
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return res.json() as Promise<{ runs: (Record<SeriesKey, number> & { time: number; commit_hash: string; total: number })[] }>;
        })
        .then((data) => {
            runs = data.runs
                .filter((r) => r.total > 0)
                .map((r) => {
                    const run = { t: r.time * 1000, commit: r.commit_hash, total: r.total } as Run;
                    for (const s of SERIES) run[s.key] = r[s.key] ?? 0;
                    return run;
                })
                .sort((a, b) => a.t - b.t);
            if (!runs.length) throw new Error("no runs");
            root.dataset.state = "ready";
            applyPreset();
        })
        .catch((err) => {
            console.error("Failed to load test262 history", err);
            root.dataset.state = "error";
        });
}
