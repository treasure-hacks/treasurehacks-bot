const { SlashCommandBuilder } = require('@discordjs/builders')

async function clearRole (interaction, client, sourceProperty) {
  const role = interaction.options.getRole(sourceProperty)
  if (!role) {
    interaction.reply({
      embeds: [{
        title: 'Error in configuration',
        description: 'Unable to find that role',
        color: 0xff0000
      }],
      ephemeral: true
    })
    return
  }
  const failArray = []
  const result = (await Promise.all(role.members.map(async member => {
    return await member.roles.remove(role)
      .catch(e => failArray.push(`<@!${member.id}>`))
  }))).filter(member => member.id)
  const embed = {
    title: '',
    description: `Successfully removed (${result.length}): ${result.map(member => `<@!${member.id}>`)}\n\n` +
      `Failed to remove (${failArray.length}): ${failArray.join(', ')}`
  }
  interaction.reply({
    embeds: [embed]
  })
}
async function siphonRole (interaction, client) {
  const clear = interaction.options.getBoolean('clear')
  const source = interaction.options.getRole('source')
  const targetRole = interaction.options.getRole('target')

  const addFails = []
  const addResult = (await Promise.all(source.members.map(async member => {
    return await member.roles.add(targetRole)
      .catch(e => addFails.push(`<@!${member.id}>`))
  }))).filter(member => member.id)

  const removeFails = []
  const removeResult = (await Promise.all(addResult.map(async member => {
    if (!clear) return member
    return await member.roles.remove(source)
      .catch(e => removeFails.push(`<@!${member.id}>`))
  }))).filter(member => member.id)

  const embed = {
    title: '',
    description: `**${removeResult.length} siphoned to ${targetRole}**\n` +
      `**Added to ${targetRole}: ${addResult.length}, failed to add: ${addFails.length}**\n` +
      (clear ? `**Removed from ${source}: ${removeResult.length}, failed to remove: ${removeFails.length}**\n\n` : '\n') +
      `Successfully siphoned to ${targetRole} (${removeResult.length}): ${removeResult.map(member => `<@!${member.id}>`)}\n\n` +
      `Successfully added to ${targetRole} (${addResult.length}): ${addResult.map(member => `<@!${member.id}>`)}\n\n` +
      `Failed to add to ${targetRole} (${addFails.length}): ${addFails.join(', ')}` +
      (clear ? `\n\nFailed to remove from ${source} (${removeFails.length}): ${removeFails.join(', ')}` : '')
  }
  interaction.reply({
    embeds: [embed]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Mass-manage roles within the server')
    .addSubcommand(subcommand => {
      subcommand.setName('clear').setDescription('Removes all members from a certain role')
        .addRoleOption(option => option
          .setName('role')
          .setDescription('The role you would like to remove all members from')
          .setRequired(true)
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('siphon').setDescription('Add members of one role to another role')
        .addRoleOption(option => option
          .setName('source')
          .setDescription('The role of the users who you want to modify')
          .setRequired(true)
        )
        .addRoleOption(option => option
          .setName('target')
          .setDescription('The role you want these users to be added to')
          .setRequired(true)
        )
        .addBooleanOption(option => option
          .setName('clear')
          .setDescription('Whether to remove all members from the source role, defaults to false')
        )
      return subcommand
    }),
  userPermissions: ['ADMINISTRATOR'],
  defaultMemberPermissions: 8,
  execute: async (interaction, client) => {
    // Make sure all members' roles are up to date
    await interaction.guild.members.fetch({ force: true })
    switch (interaction.options.getSubcommand()) {
      case 'clear': return clearRole(interaction, client, 'role')
      case 'siphon': return siphonRole(interaction, client)
    }
  }
}
