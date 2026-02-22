const { getContainer } = require('./cosmos');
const { withRetry } = require('./retry');
const { CONTAINER_USER_PURCHASES, ROLLING_WINDOW_MS } = require('../utils/constants');
const { v4: uuidv4 } = require('uuid');

/**
 * Record a purchase (one /buy invocation, may contain multiple boxes).
 */
async function recordPurchase(guildId, userId, totalCost, netCoinChange, results) {
  return withRetry(async () => {
    const container = getContainer(CONTAINER_USER_PURCHASES);
    const doc = {
      id: uuidv4(),
      guildId,
      userId,
      timestamp: Date.now(),
      boxCount: results.length,
      totalCost,
      netCoinChange,
      results, // array of { outcome, coins?, roleId?, roleName? }
    };
    const { resource } = await container.items.create(doc);
    return resource;
  }, { label: 'recordPurchase' });
}

/**
 * Count how many boxes a user has opened in the last 24 hours.
 */
async function getBoxesOpenedLast24h(guildId, userId) {
  return withRetry(async () => {
    const container = getContainer(CONTAINER_USER_PURCHASES);
    const cutoff = Date.now() - ROLLING_WINDOW_MS;
    const { resources } = await container.items
      .query({
        query:
          'SELECT VALUE SUM(c.boxCount) FROM c WHERE c.guildId = @guildId AND c.userId = @userId AND c.timestamp >= @cutoff',
        parameters: [
          { name: '@guildId', value: guildId },
          { name: '@userId', value: userId },
          { name: '@cutoff', value: cutoff },
        ],
      })
      .fetchAll();
    return resources[0] || 0;
  }, { label: 'getBoxesOpenedLast24h' });
}

/**
 * Get full purchase history for a user in a guild (for audit purposes).
 */
async function getUserPurchaseHistory(guildId, userId) {
  const container = getContainer(CONTAINER_USER_PURCHASES);
  const { resources } = await container.items
    .query({
      query:
        'SELECT * FROM c WHERE c.guildId = @guildId AND c.userId = @userId ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@guildId', value: guildId },
        { name: '@userId', value: userId },
      ],
    })
    .fetchAll();
  return resources;
}

/**
 * Delete all purchase history for a guild (used by /lootbox reset).
 */
async function deleteAllPurchases(guildId) {
  const container = getContainer(CONTAINER_USER_PURCHASES);
  const { resources } = await container.items
    .query({
      query: 'SELECT c.id FROM c WHERE c.guildId = @guildId',
      parameters: [{ name: '@guildId', value: guildId }],
    })
    .fetchAll();
  for (const doc of resources) {
    await container.item(doc.id, guildId).delete();
  }
}

module.exports = {
  recordPurchase,
  getBoxesOpenedLast24h,
  getUserPurchaseHistory,
  deleteAllPurchases,
};
