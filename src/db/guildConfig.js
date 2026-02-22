const { getContainer } = require('./cosmos');
const { withRetry } = require('./retry');
const { CONTAINER_GUILD_CONFIG, DEFAULT_COOLDOWN_SECONDS } = require('../utils/constants');

const DOC_ID = 'config'; // One config doc per guild

/**
 * Return the full guild config, or sensible defaults if none exists yet.
 */
async function getGuildConfig(guildId) {
  return withRetry(async () => {
    const container = getContainer(CONTAINER_GUILD_CONFIG);
    try {
      const { resource } = await container.item(DOC_ID, guildId).read();
      return resource;
    } catch (err) {
      if (err.code === 404) return null;
      throw err;
    }
  }, { label: 'getGuildConfig' });
}

/**
 * Create or fully replace the guild config document.
 */
async function upsertGuildConfig(guildId, fields) {
  return withRetry(async () => {
    const container = getContainer(CONTAINER_GUILD_CONFIG);
    const existing = await getGuildConfig(guildId);

    const doc = {
      id: DOC_ID,
      guildId,
      price: null,
      winCoinMin: null,
      winCoinMax: null,
      lossCoinMin: null,
      lossCoinMax: null,
      cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
      prizeChannelId: null,
      auditChannelId: null,
      maxPrizeTypes: null, // null = unlimited
      purchaseLimitOverride: null, // custom limit after roles gone (null = unlimited)
      ...(existing || {}),
      ...fields,
      // Always keep identity fields
      id: DOC_ID,
      guildId,
    };

    const { resource } = await container.items.upsert(doc);
    return resource;
  }, { label: 'upsertGuildConfig' });
}

/**
 * Delete the entire guild config (used by /lootbox reset).
 */
async function deleteGuildConfig(guildId) {
  return withRetry(async () => {
    const container = getContainer(CONTAINER_GUILD_CONFIG);
    try {
      await container.item(DOC_ID, guildId).delete();
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }, { label: 'deleteGuildConfig' });
}

module.exports = { getGuildConfig, upsertGuildConfig, deleteGuildConfig };
