// eslint-disable-next-line no-unused-vars
const { Message, Events } = require('discord.js')
const { client } = require('../modules/bot-setup')

/**
 * Scans the chat message for harmful or malicious links
 * @param {Message} message The chat message
 */
async function botReactFr (message) {
  // Ignore messages sent by bots
  if (!message.member || message.member.user.bot) return
  if (!/^fr$/i.test(message.content)) return

  message.react('🤖')
}

client.on(Events.MessageCreate, botReactFr)
