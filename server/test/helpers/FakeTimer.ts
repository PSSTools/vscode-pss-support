import { ITimer, TimerHandle } from '../../src/core/index/DocumentSession';

interface Scheduled {
  id: number;
  fn: () => void;
  dueAt: number;
  cancelled: boolean;
}

/**
 * Deterministic ITimer. Nothing runs until `advance()` is called, so debounce
 * behaviour is asserted rather than slept through.
 */
export class FakeTimer implements ITimer {
  private now = 0;
  private nextId = 1;
  private scheduled: Scheduled[] = [];

  setTimeout(fn: () => void, ms: number): TimerHandle {
    const entry: Scheduled = { id: this.nextId++, fn, dueAt: this.now + ms, cancelled: false };
    this.scheduled.push(entry);
    return entry.id;
  }

  clearTimeout(handle: TimerHandle): void {
    const entry = this.scheduled.find(s => s.id === handle);
    if (entry) entry.cancelled = true;
  }

  /** Move the clock forward, firing everything that comes due, in time order. */
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const due = this.scheduled
        .filter(s => !s.cancelled && s.dueAt <= target)
        .sort((a, b) => a.dueAt - b.dueAt)[0];
      if (!due) break;
      due.cancelled = true;         // one-shot; marked before running
      this.now = due.dueAt;
      due.fn();
    }
    this.now = target;
  }

  /** Number of timers still waiting to fire. */
  pendingCount(): number {
    return this.scheduled.filter(s => !s.cancelled).length;
  }
}
