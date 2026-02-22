const { CosmosClient } = require('@azure/cosmos');
const config = require('../config');
const {
  CONTAINER_GUILD_CONFIG,
  CONTAINER_ROLE_PRIZES,
  CONTAINER_USER_PURCHASES,
  CONTAINER_USER_COOLDOWNS,
} = require('../utils/constants');

let database;
const containers = {};

/**
 * Initialise the Cosmos DB client, create the database and containers
 * if they don't already exist, then cache container references.
 */
async function initCosmos() {
  const client = new CosmosClient({
    endpoint: config.cosmosEndpoint,
    key: config.cosmosKey,
  });

  const { database: db } = await client.databases.createIfNotExists({
    id: config.cosmosDatabase,
  });
  database = db;

  // Create containers (partitioned by guildId for multi-server support)
  const containerDefs = [
    { id: CONTAINER_GUILD_CONFIG, partitionKey: '/guildId' },
    { id: CONTAINER_ROLE_PRIZES, partitionKey: '/guildId' },
    { id: CONTAINER_USER_PURCHASES, partitionKey: '/guildId' },
    { id: CONTAINER_USER_COOLDOWNS, partitionKey: '/guildId' },
  ];

  for (const def of containerDefs) {
    const { container } = await database.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey] },
    });
    containers[def.id] = container;
  }

  console.log('[Cosmos] Database and containers ready.');
}

/**
 * Get a container reference by name.
 */
function getContainer(name) {
  if (!containers[name]) {
    throw new Error(`Container "${name}" not initialised. Call initCosmos() first.`);
  }
  return containers[name];
}

module.exports = { initCosmos, getContainer };
