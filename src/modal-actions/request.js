// eslint-disable-next-line no-unused-vars
const { ModalSubmitInteraction } = require('discord.js')
const { approveChannelRequest, editMessageIfNeeded } = require('../scripts/channel-request')

/**
 * Renames and approves the channel request
 * @param {ModalSubmitInteraction} interaction The modal submit interaction
 */
async function renameApproveRequest (interaction) {
  const message = interaction.message

  await interaction.deferReply()
  interaction.deleteReply()

  const embed = interaction.message.embeds[0]
  let nameFieldIdx = embed.fields.findIndex(f => f.name === 'Team Name')
  if (nameFieldIdx === -1) {
    embed.fields.push({ name: 'Team Name', value: '', inline: true })
    nameFieldIdx += embed.fields.length
  }
  const nameField = embed.fields[nameFieldIdx]
  nameField.value = interaction.fields.getTextInputValue('modal_txt_channel_name')
    .toLowerCase().replace(/[\s_]/g, '-').replace(/[^a-zA-Z0-9-]/g, '')

  await editMessageIfNeeded(message, 0x0088ff)
  approveChannelRequest(interaction)
}

module.exports = [
  { name: 'modal_root_rename_approve_request', handler: renameApproveRequest }
]
