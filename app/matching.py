from datetime import time

Interval = tuple[int, int]


def to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def fmt(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def free_gaps(meetings: list[Interval], min_gap: int) -> list[Interval]:
    gaps: list[Interval] = []
    busy_until: int | None = None
    for start, end in sorted(meetings):
        if busy_until is not None and start - busy_until >= min_gap:
            gaps.append((busy_until, start))
        busy_until = end if busy_until is None else max(busy_until, end)
    return gaps


def intersect(a: list[Interval], b: list[Interval], min_overlap: int) -> list[Interval]:
    out: list[Interval] = []
    i = j = 0

    while i < len(a) and j < len(b):
        start = max(a[i][0], b[j][0])
        end = min(a[i][1], b[j][1])

        if end - start >= min_overlap:
            out.append((start, end))
        if a[i][1] < b[j][1]:
            i += 1
        else:
            j += 1

    return out


def total_minutes(intervals: list[Interval]) -> int:
    return sum(end - start for start, end in intervals)
