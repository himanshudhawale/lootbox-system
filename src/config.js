require('dotenv').config();

module.exports = {
  // Discord
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,

  // Azure Cosmos DB
  cosmosEndpoint: process.env.COSMOS_ENDPOINT,
  cosmosKey: process.env.COSMOS_KEY,
  cosmosDatabase: process.env.COSMOS_DATABASE || 'lootbox-bot',

  // UnbelievaBoat
  unbApiToken: process.env.UNB_API_TOKEN,
};
