/* Time is derived from a persisted timestamp, not background JavaScript ticks. */
(function (root) {
  'use strict';
  const nonnegative = value => Number.isFinite(value) && value >= 0 ? value : 0;
  function elapsed(task, now = Date.now()) {
    return nonnegative(task.elapsedMs) + (Number.isFinite(task.timerStartedAt) && task.timerStartedAt > 0 ? Math.max(0, now - task.timerStartedAt) : 0);
  }
  function pause(task, now = Date.now()) {
    task.elapsedMs = elapsed(task, now);
    task.timerStartedAt = null;
  }
  function toggle(tasks, id, now = Date.now()) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done) return false;
    if (task.timerStartedAt) { pause(task, now); return true; }
    for (const other of tasks) if (other.timerStartedAt) pause(other, now);
    task.elapsedMs = nonnegative(task.elapsedMs);
    task.timerStartedAt = now;
    return true;
  }
  function normalize(tasks, now = Date.now()) {
    let active = false;
    for (const task of tasks) {
      task.elapsedMs = nonnegative(task.elapsedMs);
      task.timerStartedAt = Number.isFinite(task.timerStartedAt) && task.timerStartedAt > 0 && task.timerStartedAt <= now ? task.timerStartedAt : null;
      if (task.timerStartedAt && (task.done || active)) pause(task, now);
      if (task.timerStartedAt) active = true;
    }
    return tasks;
  }
  function clock(ms) {
    const s = Math.floor(nonnegative(ms) / 1000);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function duration(ms) {
    const seconds = Math.floor(nonnegative(ms) / 1000), minutes = Math.floor(seconds / 60);
    if (seconds < 60) return `${seconds} сек`;
    return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  }
  const api = { elapsed, pause, toggle, normalize, clock, duration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudyTimer = api;
})(globalThis);
