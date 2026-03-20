import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/**
 * Add a message to the buffer for a given instance+lead combination.
 * Returns whether this is the first message in the buffer window
 * (caller should schedule processing after 10s if isFirst=true).
 */
export async function addToBuffer(
  instanceId: string,
  remoteJid: string,
  content: string
): Promise<{ isFirst: boolean }> {
  const bufferKey = `agent-buf:${instanceId}:${remoteJid}`;

  const pipeline = redis.pipeline();
  pipeline.rpush(bufferKey, content);
  pipeline.expire(bufferKey, 15); // 15s TTL (10s window + 5s safety margin)
  pipeline.llen(bufferKey);

  const results = await pipeline.exec();
  const listLen = results[2] as number;

  return { isFirst: listLen === 1 };
}

/**
 * Drain all buffered messages for a given instance+lead combination.
 * Uses Redis SETNX as a processing lock to prevent double-processing
 * across concurrent serverless invocations.
 * Returns concatenated messages or null if lock not acquired / buffer empty.
 */
export async function drainBuffer(
  instanceId: string,
  remoteJid: string
): Promise<string | null> {
  const bufferKey = `agent-buf:${instanceId}:${remoteJid}`;
  const lockKey = `agent-lock:${instanceId}:${remoteJid}`;

  // Acquire processing lock (prevents double-processing across pods)
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 30 });
  if (!acquired) return null;

  try {
    // Drain buffer atomically via pipeline
    const pipeline = redis.pipeline();
    pipeline.lrange(bufferKey, 0, -1);
    pipeline.del(bufferKey);
    const results = await pipeline.exec();

    const messages = results[0] as string[];
    if (!messages || messages.length === 0) return null;

    // Join all buffered messages with newline
    return messages.join("\n");
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

/**
 * Clear all buffer and lock keys for a given instance+lead combination.
 * Called during handoff to prevent stale messages from processing after AI is deactivated.
 */
export async function clearBuffer(
  instanceId: string,
  remoteJid: string
): Promise<void> {
  const bufferKey = `agent-buf:${instanceId}:${remoteJid}`;
  const lockKey = `agent-lock:${instanceId}:${remoteJid}`;
  await redis.del(bufferKey, lockKey);
}
