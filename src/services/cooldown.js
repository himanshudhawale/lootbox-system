const { getContainer } = require('../db/cosmos');
const { CONTAINER_USER_COOLDOWNS, DEFAULT_COOLDOWN_SECONDS } = require('../utils/constants');

// In-memory cache for fast lookups (guildId:userId -> { lastPurchase, adminUntil })
const cooldownCache = new Map();

/**
 * Check if a user is on cooldown. Returns { onCooldown, remainingMs }.
 * Checks both normal purchase cooldown and admin-imposed cooldown.
 */
async function checkCooldown(guildId, userId, cooldownSeconds) {
  const cd = cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
  const key = `${guildId}:${userId}`;

  let data = cooldownCache.get(key);

  // If not in cache, check Cosmos
  if (data === undefined) {
    const container = getContainer(CONTAINER_USER_COOLDOWNS);
    try {
      const { resource } = await container.item(userId, guildId).read();
      data = {
        lastPurchase: resource?.lastPurchaseTimestamp ?? 0,
        adminUntil: resource?.adminCooldownUntil ?? 0,
      };
      cooldownCache.set(key, data);
    } catch (err) {
      if (err.code === 404) {
        data = { lastPurchase: 0, adminUntil: 0 };
      } else {
        throw err;
      }
    }
  }

  const now = Date.now();

  // Admin cooldown takes priority
  if (data.adminUntil > now) {
    return { onCooldown: true, remainingMs: data.adminUntil - now };
  }

  // Normal cooldown
  const elapsed = now - data.lastPurchase;
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
  const existing = cooldownCache.get(key) || { lastPurchase: 0, adminUntil: 0 };
  existing.lastPurchase = now;
  cooldownCache.set(key, existing);

  const container = getContainer(CONTAINER_USER_COOLDOWNS);
  await container.items.upsert({
    id: userId,
    guildId,
    userId,
    lastPurchaseTimestamp: now,
    adminCooldownUntil: existing.adminUntil || 0,
  });
}

/**
 * Admin override: block a user from purchasing for a specific duration.
 */
async function setUserCooldownUntil(guildId, userId, durationSeconds) {
  const key = `${guildId}:${userId}`;
  const until = Date.now() + durationSeconds * 1000;
  const existing = cooldownCache.get(key) || { lastPurchase: 0, adminUntil: 0 };
  existing.adminUntil = until;
  cooldownCache.set(key, existing);

  const container = getContainer(CONTAINER_USER_COOLDOWNS);
  await container.items.upsert({
    id: userId,
    guildId,
    userId,
    lastPurchaseTimestamp: existing.lastPurchase || 0,
    adminCooldownUntil: until,
  });
}

/**
 * Admin override: remove the admin cooldown from a user.
 */
async function clearUserCooldown(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const existing = cooldownCache.get(key) || { lastPurchase: 0, adminUntil: 0 };
  existing.adminUntil = 0;
  cooldownCache.set(key, existing);

  const container = getContainer(CONTAINER_USER_COOLDOWNS);
  await container.items.upsert({
    id: userId,
    guildId,
    userId,
    lastPurchaseTimestamp: existing.lastPurchase || 0,
    adminCooldownUntil: 0,
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

module.exports = { checkCooldown, setCooldown, setUserCooldownUntil, clearUserCooldown, clearAllCooldowns };
