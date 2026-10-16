import { Counter, Trend } from 'k6/metrics';

export const successfulCreates = new Counter('successful_creates');

export const failedCreates = new Counter('failed_creates');

export const createResponseTime = new Trend('create_response_time', true);

export const createJourneyDuration = new Trend('create_journey_duration', true);

export function recordCreate(ok, startedAt) {
  (ok ? successfulCreates : failedCreates).add(1);
  createResponseTime.add(Date.now() - startedAt);
  return ok;
}
