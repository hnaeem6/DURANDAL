export async function register() {
  // Only run the schedule worker in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduleWorker } = await import("./lib/schedule-worker");
    startScheduleWorker();
  }
}
