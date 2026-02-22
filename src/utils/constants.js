module.exports = {
  // Default values — admins override these via /lootbox config
  DEFAULT_COOLDOWN_SECONDS: 3600, // 1 hour
  DEFAULT_PURCHASE_LIMIT_ROLES_ACTIVE: 5, // per user per 24h while roles in play
  ROLLING_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours in ms

  // Algorithm
  WIN_CHANCE: 0.5, // 50% win / 50% lose
  ROLE_VS_COINS_CHANCE: 0.5, // 50% role / 50% coins when roles available

  // Cosmos DB container names
  CONTAINER_GUILD_CONFIG: 'guildConfig',
  CONTAINER_ROLE_PRIZES: 'rolePrizes',
  CONTAINER_USER_PURCHASES: 'userPurchases',
  CONTAINER_USER_COOLDOWNS: 'userCooldowns',

  // Embed colours
  COLOUR_WIN: 0x57f287, // green
  COLOUR_LOSS: 0xed4245, // red
  COLOUR_INFO: 0x5865f2, // blurple
  COLOUR_AUDIT: 0xfee75c, // yellow
};
