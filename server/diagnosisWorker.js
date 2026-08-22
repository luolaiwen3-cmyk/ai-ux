const defaultClock = () => new Date()

const errorMessage = (error) => {
  const message = error instanceof Error ? error.message : String(error || '未知错误')
  return message.slice(0, 1000)
}

export function createDiagnosisWorker({
  diagnoses,
  execute,
  logger,
  retryDelayMs = 2000,
  clock = defaultClock
}) {
  let activePromise = null
  let timer = null
  let stopped = true

  const clearScheduledRun = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const schedule = (delayMs) => {
    if (stopped) return
    clearScheduledRun()
    timer = setTimeout(() => {
      timer = null
      void run()
    }, Math.max(0, delayMs))
    timer.unref?.()
  }

  const scheduleNextAttempt = () => {
    const nextAttemptAt = diagnoses.findNextAttemptAt()
    if (!nextAttemptAt) return
    const delayMs = Math.max(0, new Date(nextAttemptAt).getTime() - clock().getTime())
    schedule(Math.min(delayMs, 2_147_483_647))
  }

  const drain = async () => {
    while (!stopped) {
      const claimedAt = clock()
      const job = diagnoses.claimNext(claimedAt.toISOString())
      if (!job) break

      try {
        const diagnosis = await execute(job)
        const timestamp = clock().toISOString()
        diagnoses.complete(job.sessionId, { ...diagnosis, timestamp })
      } catch (error) {
        const failedAt = clock()
        const delayMs = retryDelayMs * (2 ** Math.max(0, job.attemptCount - 1))
        const updated = diagnoses.failAttempt(job.sessionId, {
          error: errorMessage(error),
          nextAttemptAt: new Date(failedAt.getTime() + delayMs).toISOString(),
          timestamp: failedAt.toISOString()
        })
        logger?.warn?.({
          err: error,
          sessionId: job.sessionId,
          attemptCount: updated?.attemptCount,
          status: updated?.status
        }, 'diagnosis job failed')
      }
    }
    if (!stopped) scheduleNextAttempt()
  }

  const run = () => {
    if (stopped || activePromise) return activePromise
    activePromise = drain()
      .catch((error) => {
        logger?.error?.({ err: error }, 'diagnosis worker stopped unexpectedly')
        try {
          diagnoses.releaseClaims()
        } catch (releaseError) {
          logger?.error?.({ err: releaseError }, 'diagnosis worker could not release jobs')
        }
        if (!stopped) schedule(retryDelayMs)
      })
      .finally(() => {
        activePromise = null
      })
    return activePromise
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      diagnoses.releaseClaims()
      schedule(0)
    },

    wake() {
      if (!stopped) schedule(0)
    },

    async stop() {
      stopped = true
      clearScheduledRun()
      await activePromise
    },

    runNow: run
  }
}
