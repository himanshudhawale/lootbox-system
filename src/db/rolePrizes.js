const { getContainer } = require('./cosmos');
const { CONTAINER_ROLE_PRIZES } = require('../utils/constants');

/**
 * Get all role prizes for a guild.
 */
async function getRolePrizes(guildId) {
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.guildId = @guildId',
      parameters: [{ name: '@guildId', value: guildId }],
    })
    .fetchAll();
  return resources;
}

/**
 * Get only role prizes that still have remaining winner slots.
 */
async function getEligibleRolePrizes(guildId) {
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.guildId = @guildId AND c.remainingWinners > 0',
      parameters: [{ name: '@guildId', value: guildId }],
    })
    .fetchAll();
  return resources;
}

/**
 * Check if any role prizes still have remaining slots.
 */
async function hasActiveRolePrizes(guildId) {
  const eligible = await getEligibleRolePrizes(guildId);
  return eligible.length > 0;
}

/**
 * Add a role prize. Uses roleId as the document id.
 */
async function addRolePrize(guildId, roleId, roleName, maxWinners) {
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  const doc = {
    id: roleId,
    guildId,
    roleId,
    roleName,
    maxWinners,
    remainingWinners: maxWinners,
  };
  const { resource } = await container.items.upsert(doc);
  return resource;
}

/**
 * Remove a role prize.
 */
async function removeRolePrize(guildId, roleId) {
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  try {
    await container.item(roleId, guildId).delete();
    return true;
  } catch (err) {
    if (err.code === 404) return false;
    throw err;
  }
}

/**
 * Decrement the remaining winners for a role prize by 1.
 * Returns the updated doc, or null if no slots were left.
 */
async function decrementRolePrize(guildId, roleId) {
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  const { resource } = await container.item(roleId, guildId).read();
  if (!resource || resource.remainingWinners <= 0) return null;

  resource.remainingWinners -= 1;
  const { resource: updated } = await container.items.upsert(resource);
  return updated;
}

/**
 * Delete all role prizes for a guild (used by /lootbox reset).
 */
async function deleteAllRolePrizes(guildId) {
  const prizes = await getRolePrizes(guildId);
  const container = getContainer(CONTAINER_ROLE_PRIZES);
  for (const prize of prizes) {
    await container.item(prize.id, guildId).delete();
  }
}

module.exports = {
  getRolePrizes,
  getEligibleRolePrizes,
  hasActiveRolePrizes,
  addRolePrize,
  removeRolePrize,
  decrementRolePrize,
  deleteAllRolePrizes,
};
