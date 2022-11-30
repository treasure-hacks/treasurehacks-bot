// eslint-disable-next-line no-unused-vars
const { ButtonInteraction } = require('discord.js')
const { PermissionsBitField, ChannelType } = require('discord.js')
const { Deta } = require('deta')
const { sendMessage } = require('../modules/message')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Deletes an interaction's source if there's no data associated with it
 * @param {ButtonInteraction} interaction The interaction
 * @returns {boolean} Whether the source message was deleted
 */
function deleteIfNoData (interaction) {
  const dataEmbed = interaction.message.embeds[0]
  if (dataEmbed) return false
  interaction.reply({
    content: 'Original data could not be found',
    ephemeral: true
  })
  interaction.message.delete()
  return true
}

/**
 * Approves a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
 */
async function approveRequest (interaction) {
  if (deleteIfNoData(interaction)) return
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const embed = interaction.message.embeds[0]
  const fields = embed.fields

  const membersField = fields.find(f => f.name === 'Members')
  const team = membersField.value.split(', ').map(mention => {
    const userId = mention.match(/<@!?(\d+)>/)[1]
    const user = interaction.guild.members.cache.get(userId)
    return user
  })

  const nameField = fields.find(f => f.name === 'Team Name')
  const category = serverConfig.channelRequest?.category
  const channel = await interaction.guild.channels.create({
    name: 'team-' + nameField.value,
    type: ChannelType.GuildText,
    parent: category,
    permissionOverwrites: [
      {
        id: interaction.guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      ...team.map(user => {
        return {
          id: user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      })
    ]
  })
  sendMessage(channel, `Created From Private Channel Request\n**Reason:** ${
    fields.find(f => f.name === 'Reason').value
  }`)
  fields.push({ name: 'Channel', value: `<#${channel.id}>`, inline: true })
  embed.color = 0x00ff00
  interaction.message.edit({
    content: 'This channel creation request has been addressed',
    embeds: interaction.message.embeds,
    components: []
  })
}

/**
 * Denies a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
 */
function denyRequest (interaction) {
  if (deleteIfNoData(interaction)) return
  const embed = interaction.message.embeds[0]
  embed.fields.push({ name: 'Status', value: 'Rejected', inline: true })
  embed.color = 0xff0000
  interaction.message.edit({
    content: 'This channel creation request has been addressed',
    embeds: interaction.message.embeds,
    components: []
  })
}

module.exports = [
  { name: 'btn_channel_request_approve', handler: approveRequest },
  { name: 'btn_channel_request_deny', handler: denyRequest }
]
