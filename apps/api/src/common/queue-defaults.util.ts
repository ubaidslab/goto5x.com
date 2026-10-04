import { JobsOptions } from "bullmq";

/**
 * Security-checklist audit finding: no queue in this codebase configured
 * retry/backoff - BullMQ's own default (`attempts: 1`) applied everywhere,
 * so a job that threw once simply stayed failed until its next scheduled
 * tick, with no automatic retry. These are periodic sweep jobs (hourly/
 * daily), so a conservative few-attempt exponential backoff is enough to
 * ride out a transient blip (a DB hiccup, a brief Redis reconnect) without
 * risking a retry overlapping the job's own next scheduled run.
 */
export const DEFAULT_SWEEP_JOB_OPTIONS: Pick<JobsOptions, "attempts" | "backoff"> = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
};

/**
 * Same values as DEFAULT_SWEEP_JOB_OPTIONS, same reasoning, for the smaller
 * set of queues that are triggered by a one-off event (a seller requesting
 * a data export/product import, a campaign/newsletter send) rather than a
 * recurring scheduler - kept as its own named export so neither call site
 * reads as describing the other's trigger shape.
 */
export const DEFAULT_TRIGGERED_JOB_OPTIONS = DEFAULT_SWEEP_JOB_OPTIONS;
