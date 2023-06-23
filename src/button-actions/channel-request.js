// eslint-disable-next-line no-unused-vars
const { ButtonInteraction } = require('discord.js')
const { approveChannelRequest, editMessageIfNeeded } = require('../scripts/channel-request')

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
  approveChannelRequest(interaction)
}

/**
 * Renames and approves a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
 */
async function renameAndApprove (interaction) {
  const embed = interaction.message.embeds[0]
  const nameField = embed.fields.find(f => f.name === 'Team Name')

  interaction.showModal({
    title: 'Rename & Approve Request',
    custom_id: `modal_root_rename_approve_request#${interaction.channelId}/${interaction.message.id}`,
    components: [{
      type: 1,
      custom_id: 'modal_row_txt',
      components: [{
        type: 4,
        style: 1,
        custom_id: 'modal_txt_channel_name',
        label: 'New Channel Name',
        placeholder: nameField?.value || 'team-wumpus',
        required: true
      }]
    }]
  })
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
  { name: 'btn_channel_request_rename_approve', handler: renameAndApprove },
  { name: 'btn_channel_request_deny', handler: denyRequest }
]
