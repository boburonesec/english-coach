export function getWorkerStatus(): "idle" {
  return "idle";
}

export function runWorker(): void {
  console.log(`English Coach worker is ${getWorkerStatus()}; no jobs are configured yet.`);
}

if (require.main === module) {
  runWorker();
}
