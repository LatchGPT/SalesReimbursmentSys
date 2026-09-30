type Measure = <T>(name: string, operation: () => Promise<T>) => Promise<T>;

/** Adds comparable server timing for workflow actions in Vercel logs and browsers. */
export async function timedRoute(
  name: string,
  operation: (measure: Measure) => Promise<Response>,
): Promise<Response> {
  const startedAt = performance.now();
  const timings = new Map<string, number>();
  const measure: Measure = async (label, work) => {
    const stageStartedAt = performance.now();
    const result = await work();
    timings.set(label, performance.now() - stageStartedAt);
    return result;
  };

  const response = await operation(measure);
  const totalMs = performance.now() - startedAt;
  timings.set('total', totalMs);
  response.headers.set(
    'Server-Timing',
    [...timings].map(([label, duration]) => `${label};dur=${duration.toFixed(1)}`).join(', '),
  );
  console.info(`[performance] ${name}`, Object.fromEntries(
    [...timings].map(([label, duration]) => [`${label}Ms`, Number(duration.toFixed(1))]),
  ));
  return response;
}
