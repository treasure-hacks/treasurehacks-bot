// eslint-disable-next-line no-unused-vars
const { Message, Events, PermissionOverwriteManager } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { client } = require('../modules/bot-setup')

/** @type {{ [guildID: string]: string[] }} */
const singlePostChannels = {}

/**
 * Scans the chat message for harmful or malicious links
 * @param {Message} message The chat message
 */
async function removeAccess (message) {
  // Ignore messages sent by bot
  if (!message.member || message.member.user.bot) return
  const isSPC = singlePostChannels[message.guildId]?.includes(message.channelId)
  if (!isSPC) return
  /** @type {PermissionOverwriteManager} */
  const overwrites = message.channel.permissionOverwrites
  overwrites.delete(message.member)
}

function setSPChannels (guildID, channels) {
  singlePostChannels[guildID] = channels
}

client.on(Events.MessageCreate, removeAccess)
client.on('*UpdateSinglePostChannels', setSPChannels)
client.once('ready', async () => {
  const guilds = await client.guilds.fetch()
  for (const guild of guilds.map(g => g)) {
    const serverConfig = await serverSettingsDB.get(guild.id)
    const channels = serverConfig.singlePostChannels || []
    singlePostChannels[guild.id] = channels
  }
})
