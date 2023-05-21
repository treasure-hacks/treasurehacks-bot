const { Events } = require('discord.js')
const { client } = require('../modules/bot-setup')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Returns an object containing the default bot settings for the guild
 * @param {Guild} guild The guild that the settings apply to
 * @returns {Object} The default bot settings for the guild
 */
function createDefaultSettings (guild) {
  return {
    key: guild.id,
    logChannel: null,
    alertsChannel: null,
    inviteRoles: [],
    linkScanner: { enabled: true, ignoredRoles: [] },
    channelRequest: { enabled: false }
  }
}

/**
 * Creates the server config if needed
 * @param {Guild} guild The guild whose settings should be created
 */
async function createServerConfig (guild) {
  const serverConfig = await serverSettingsDB.get(guild.id)
  if (serverConfig) return
  const defaultSettings = createDefaultSettings(guild)
  serverSettingsDB.put(defaultSettings)
}

/**
 * Creates server configs for all servers the bot is in if they do not exist
 */
async function createServerConfigs () {
  const guilds = await client.guilds.fetch()
  guilds.forEach(createServerConfig)
}

client.once(Events.ClientReady, createServerConfigs)
client.on(Events.GuildCreate, createServerConfig)

module.exports = { createDefaultSettings }
