// eslint-disable-next-line no-unused-vars
const { Message, Events, PermissionFlagsBits } = require('discord.js')
const { client } = require('../modules/bot-setup')

/**
 * Scans the chat message for harmful or malicious links
 * @param {Message} message The chat message
 */
async function botReactFr (message) {
  // Ignore messages sent by bots
  if (!message.member || message.member.user.bot) return
  const isPublic = message.channel.permissionsFor(message.guild.roles.everyone)
    .has(PermissionFlagsBits.ViewChannel)
  if (!isPublic || !/^f(r|acts?)$/i.test(message.content)) return

  message.react('🤖')
}

client.on(Events.MessageCreate, botReactFr)
client.on(Events.MessageUpdate, (oldMsg, newMsg) => botReactFr(newMsg))
