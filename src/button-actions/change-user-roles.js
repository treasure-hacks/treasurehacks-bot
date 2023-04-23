// eslint-disable-next-line no-unused-vars
const { ButtonInteraction } = require('discord.js')

/**
 * Approves a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
 */
async function addRole (interaction) {
  const targetRole = (await interaction.guild.roles.fetch()).find(r => r.id === interaction.extension)
  if (!targetRole) return interaction.reply({ content: 'Role does not exist', ephemeral: true })

  interaction.member.roles.add(targetRole).then(() => {
    // Adding the role was successful
    interaction.reply({
      content: `Successfully given the ${targetRole} role`,
      ephemeral: true
    })
  }).catch(e => {
    interaction.reply({
      content: `Unable to add you to the ${targetRole} role`,
      ephemeral: true
    })
  })
}

/**
 * Approves a channel creation request
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
 */
async function addRoleIf (interaction) {
  const [conditionalID, targetID] = interaction.extension.split('?')
  const prereqRole = (await interaction.guild.roles.fetch()).find(r => r.id === conditionalID)
  const targetRole = (await interaction.guild.roles.fetch()).find(r => r.id === targetID)
  if (!prereqRole || !targetRole) return interaction.reply({ content: 'Role does not exist', ephemeral: true })

  await interaction.member.fetch()
  const hasPrereq = [...interaction.member.roles.cache.keys()].includes(conditionalID)
  if (!hasPrereq) {
    return interaction.reply({
      content: `You must first have the ${prereqRole} role to get the ${targetRole} role`,
      ephemeral: true
    })
  }

  interaction.member.roles.add(targetRole).then(() => {
    // Adding the role was successful
    interaction.reply({
      content: `Successfully given the ${targetRole} role`,
      ephemeral: true
    })
  }).catch(e => {
    interaction.reply({
      content: `Unable to add you to the ${targetRole} role`,
      ephemeral: true
    })
  })
}

/**
 * Removes a role from the user who clicked the button
 * @param {ButtonInteraction} interaction The Discord bot's button interaction
*/
async function removeRole (interaction) {
  const targetRole = (await interaction.guild.roles.fetch()).find(r => r.id === interaction.extension)
  if (!targetRole) return interaction.reply({ content: 'Role does not exist', ephemeral: true })

  interaction.member.roles.remove(targetRole).then(() => {
    // Adding the role was successful
    interaction.reply({
      content: `Successfully removed the ${targetRole} role`,
      ephemeral: true
    })
  }).catch(e => {
    interaction.reply({
      content: `Unable to remove you from the ${targetRole} role`,
      ephemeral: true
    })
  })
}

module.exports = [
  { name: 'btn_role_add', handler: addRole },
  { name: 'btn_role_add_if', handler: addRoleIf },
  { name: 'btn_role_remove', handler: removeRole }
]
