const { getContainer } = require('../db/cosmos');
const { CONTAINER_USER_COOLDOWNS, DEFAULT_COOLDOWN_SECONDS } = require('../utils/constants');

// In-memory cache for fast lookups (guildId:userId -> timestamp)
const cooldownCache = new Map();

/**
 * Check if a user is on cooldown. Returns { onCooldown, remainingMs }.
 */
async function checkCooldown(guildId, userId, cooldownSeconds) {
  const cd = cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
  const key = `${guildId}:${userId}`;

  // Try cache first
  let lastPurchase = cooldownCache.get(key);

  // If not in cache, check Cosmos
  if (lastPurchase === undefined) {
    const container = getContainer(CONTAINER_USER_COOLDOWNS);
    try {
      const { resource } = await container.item(userId, guildId).read();
      lastPurchase = resource?.lastPurchaseTimestamp ?? 0;
      cooldownCache.set(key, lastPurchase);
    } catch (err) {
      if (err.code === 404) {
        lastPurchase = 0;
      } else {
        throw err;
      }
    }
  }

  const elapsed = Date.now() - lastPurchase;
  const cooldownMs = cd * 1000;

  if (elapsed < cooldownMs) {
    return { onCooldown: true, remainingMs: cooldownMs - elapsed };
  }
  return { onCooldown: false, remainingMs: 0 };
}

/**
 * Set the cooldown timestamp for a user (call after a successful purchase).
 */
async function setCooldown(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  cooldownCache.set(key, now);

  const container = getContainer(CONTAINER_USER_COOLDOWNS);
  await container.items.upsert({
    id: userId,
    guildId,
    userId,
    lastPurchaseTimestamp: now,
  });
}

/**
 * Clear all cooldowns for a guild (used by /lootbox reset).
 */
async function clearAllCooldowns(guildId) {
  const container = getContainer(CONTAINER_USER_COOLDOWNS);
  const { resources } = await container.items
    .query({
      query: 'SELECT c.id FROM c WHERE c.guildId = @guildId',
      parameters: [{ name: '@guildId', value: guildId }],
    })
    .fetchAll();

  for (const doc of resources) {
    await container.item(doc.id, guildId).delete();
  }

  // Purge cache entries for this guild
  for (const key of cooldownCache.keys()) {
    if (key.startsWith(`${guildId}:`)) {
      cooldownCache.delete(key);
    }
  }
}

module.exports = { checkCooldown, setCooldown, clearAllCooldowns };
