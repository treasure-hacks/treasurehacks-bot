// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

/**
 * Sets the current channel to read-only by all roles that who can see it (admins are not affected)
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function archiveChannel (interaction, client) {
  // Refresh the channel
  let channel = await interaction.guild.channels.fetch(interaction.channelId)
  if (channel.isThread()) channel = await interaction.guild.channels.fetch(interaction.channel.parentId)
  if (!channel.permissionOverwrites) return interaction.reply({ content: 'Error: Cannot change permissions for channel type', ephemeral: true })

  const sync = interaction.options.getBoolean('sync') || false
  if (sync) await channel.lockPermissions()

  const overwrites = channel.permissionOverwrites.cache.map(o => o)
  const permissions = {
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false
  }
  const changes = []
  for (const o of overwrites) {
    /** @param {GuildMember | Role} */
    const subject = await interaction.guild[o.type === 1 ? 'members' : 'roles'].fetch(o.id)
    const isAdmin = subject.permissions.has(PermissionFlagsBits.Administrator)
    if (isAdmin) continue // Don't change overwrites if the user/role is an admin

    const changed = !o.deny.has(PermissionFlagsBits.SendMessages)
    const canView = !o.deny.has(PermissionFlagsBits.ViewChannel)
    if (changed && canView) changes.push(subject)
    await channel.permissionOverwrites.edit(o.id, permissions)
  }
  if (!overwrites.find(o => o.id === interaction.guildId)) {
    // There is no overwrite for @everyone; add it
    await channel.permissionOverwrites.edit(interaction.guildId, permissions)
    changes.push(interaction.guild.roles.everyone)
  }

  if (!changes.length) {
    return interaction.reply({ content: 'No changes were made', ephemeral: true })
  }

  interaction.reply({
    content: `The following users and roles can no longer send messages in this channel: ${changes.join(', ')}`,
    ephemeral: true
  })
}

/**
 * Syncs the channel permissions with the category permissions
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function syncChannel (interaction, client, reply) {
  let channel = await interaction.guild.channels.fetch(interaction.channelId)
  if (channel.isThread()) channel = await interaction.guild.channels.fetch(interaction.channel.parentId)
  if (!channel.permissionOverwrites) return interaction.reply({ content: 'Error: Cannot change permissions for channel type', ephemeral: true })

  await channel.lockPermissions()
  interaction.reply({
    content: 'Permissions synced with category',
    ephemeral: true
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Manages the current channel')
    .addSubcommand(command => command
      .setName('archive')
      .setDescription('Sets the channel to read-only')
      .addBooleanOption(option => option
        .setName('sync')
        .setDescription('Whether to sync permissions first')
      )
    )
    .addSubcommand(command => command
      .setName('sync')
      .setDescription('Syncs channel permissions with its parent category')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'archive': return archiveChannel(interaction, client)
      case 'sync': return syncChannel(interaction, client)
    }
  }
}
