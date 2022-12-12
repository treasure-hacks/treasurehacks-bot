// eslint-disable-next-line no-unused-vars
const { ButtonInteraction } = require('discord.js')
const { PermissionsBitField, ChannelType } = require('discord.js')
const { Deta } = require('deta')
const { sendMessage } = require('../modules/message')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

function clearChannelRequestButtons (components) {
  return components.filter(c => {
    if (c.type === 1) c.components = clearChannelRequestButtons(c.components)
    return !c.data?.custom_id?.includes('btn_channel_request_')
  })
}

async function editMessageIfNeeded (message, color) {
  const embed = message.embeds[0]
  const newComponents = clearChannelRequestButtons(message.components)
  console.log(newComponents)

  // There's other components in this bot message; only remove the action button
  if (newComponents.length > 0) {
    await message.edit({
      embeds: message.embeds,
      components: newComponents
    })
    return false
  }

  embed.data.color = color
  await message.edit({
    content: 'This channel creation request has been addressed',
    embeds: message.embeds,
    components: newComponents
  })
  return true
}

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

  // Refresh users
  await interaction.guild.members.fetch()

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
  const reasonField = fields.find(f => f.name === 'Reason')
  if (reasonField) {
    sendMessage(channel, `Created From Private Channel Request\n**Reason:** ${
      reasonField.value
    }`)
  }
  fields.push({ name: 'Channel', value: `<#${channel.id}>`, inline: true })
  const edited = await editMessageIfNeeded(interaction.message, 0x00ff00)
  if (!edited) interaction.deferUpdate()
}

/**
 * Denies a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
*/
async function denyRequest (interaction) {
  if (deleteIfNoData(interaction)) return
  const embed = interaction.message.embeds[0]
  embed.fields.push({ name: 'Status', value: 'Rejected', inline: true })
  const edited = await editMessageIfNeeded(interaction.message, 0xff0000)
  if (!edited) interaction.deferUpdate()
}

module.exports = [
  { name: 'btn_channel_request_approve', handler: approveRequest },
  { name: 'btn_channel_request_deny', handler: denyRequest }
]
