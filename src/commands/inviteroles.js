// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { Deta } = require('deta')
const { getStats } = require('../modules/role-stats')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Gets the channels and roles from the slash command interaction options
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
function getChannelsAndRoles (interaction) {
  const channels = interaction.options.getString('channels')?.split(' ') || []
  const roles = interaction.options.getString('add-roles')?.split(' ') || []
  const removeRoles = interaction.options.getString('remove-roles')?.split(' ') || []

  if (channels.some(c => !c.match(/^<#\d+>$/))) return { error: 'Channels are not formatted properly. Please enter channel names, separated by spaces. ie `#welcome #general`' }
  if (roles.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`' }
  if (removeRoles.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`' }

  function isValidRole (role) {
    return !role.managed && role.name !== '@everyone'
  }
  const warnings = channels.filter(channel => {
    return !interaction.guild.channels.cache.find(c => c.toString() === channel)
  }).concat(roles.filter(role => {
    return !interaction.guild.roles.cache.find(r => r.toString() === role && isValidRole(role))
  }))

  const serverData = {
    channels: interaction.guild.channels.cache.filter(channel => {
      return channels.includes(channel.toString())
    }),
    roles: interaction.guild.roles.cache.filter(role => {
      return roles.includes(role.toString())
    }),
    removeRoles: interaction.guild.roles.cache.filter(role => {
      return removeRoles.includes(role.toString())
    }),
    warnings: warnings.length ? ['Could not find the following channels or roles: ' + warnings.join(', ')] : []
  }

  return serverData
}

/**
 * Gets a color from the slash command interaction options
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
function getColorFromOptions (interaction) {
  const color = interaction.options.getString('color') || undefined
  if (!color) return { color: undefined }
  if (color.match(/^#?[0-9a-f]{6}$/i)) return { color: parseInt(color.replace(/^#/, ''), 16) }

  if (!color.match(/^<@&\d+>$/)) return { error: 'Color must either be valid HEX or contain exactly one role to inherit color from' }
  const role = interaction.guild.roles.cache.find(role => {
    return color === role.toString()
  })
  return { color: role.color }
}

/**
 * Adds a rule to manage invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function addInviteRule (interaction, client, isUpdate, override) {
  const name = interaction.options.getString('name')
  const description = interaction.options.getString('description') || undefined
  const { color } = getColorFromOptions(interaction)
  if (name.match(/[^0-9a-zA-Z-_]/)) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    })
    return
  }
  const { error, channels, roles, removeRoles, warnings } = getChannelsAndRoles(interaction)
  const { error: error2 } = getColorFromOptions(interaction)
  const noFieldsInNew = error ? true : (!channels.size || !roles.size) && !isUpdate
  if (error || error2 || noFieldsInNew) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: error || error2 || 'There must be at least one valid channel and one valid role'
      }],
      ephemeral: true
    })
    return
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const hasInvalidRoles = roles.some(role => {
    const roleJSON = role.toJSON()
    return roleJSON.name === '@everyone' || roleJSON.managed
  })
  if (hasInvalidRoles) {
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Invalid roles: you cannot assign @everyone or managed roles.'
      }],
      ephemeral: true
    })
  }
  const existingRule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if ((existingRule && !isUpdate) || (!existingRule && isUpdate)) {
    // Force separation of commands because we don't want accidental changes being made
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: `Error while ${isUpdate ? 'updating' : 'creating'} rule \`${name}\``,
        description: isUpdate ? 'Rule does not exist' : 'Rule already exists'
      }],
      ephemeral: true
    })
  }
  const replyContent = {
    embeds: [] // ,
    // ephemeral: true
  }
  if (warnings.length) {
    replyContent.embeds.push({
      color: 0xf0b800,
      title: 'Warnings',
      description: warnings.join('\n')
    })
  }

  if (existingRule) {
    if (description) existingRule.description = description
    if (color) existingRule.color = color
    if (override) {
      existingRule.inviteChannelIds = channels.map(c => c.id)
      existingRule.rolesToAdd = roles.map(r => r.id)
      existingRule.rolesToRemove = removeRoles.map(r => r.id)
    } else {
      existingRule.inviteChannelIds.push(...channels.map(c => c.id))
      existingRule.rolesToAdd.push(...roles.map(r => r.id))
      existingRule.rolesToRemove.push(...removeRoles.map(r => r.id))
    }
    existingRule.inviteChannelIds = [...new Set(existingRule.inviteChannelIds)]
    existingRule.rolesToAdd = [...new Set(existingRule.rolesToAdd)]
    existingRule.rolesToRemove = [...new Set(existingRule.rolesToRemove)]
    existingRule.updated_at = Date.now()
    const { created_at: createdAt, occurrences } = getStats(existingRule)
    replyContent.embeds.push({
      title: `Updated \`${name}\``,
      color: existingRule.color,
      description: (existingRule.description ? existingRule.description + '\n\n' : '') +
        `Applies to invites in: ${existingRule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${existingRule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${existingRule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: { text: `Created ${createdAt} • Updated just now • ${occurrences} use${occurrences === 1 ? '' : 's'}` }
    })
  } else {
    const channelsArray = [...new Set(channels.values())]
    const rolesArray = [...new Set(roles.values())]
    const roleRemovalArray = [...new Set(removeRoles.values())]
    serverConfig.inviteRoles.push({
      name,
      color: color,
      description,
      inviteChannelIds: channelsArray.map(c => c.id),
      rolesToAdd: rolesArray.map(r => r.id),
      rolesToRemove: roleRemovalArray.map(r => r.id),
      occurrences: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    })
    replyContent.embeds.push({
      title: `Created \`${name}\``,
      color,
      description: (description ? description + '\n\n' : '') +
        `Applies to invites in: ${channelsArray.join(', ')}` +
        `\nPeople invited will have these roles: ${rolesArray.join(', ')}`,
      footer: { text: 'Created just now • Updated just now • 0 uses' }
    })
  }

  serverSettingsDB.put(serverConfig)
  interaction.reply(replyContent)
}

/**
 * Lists the existing rules for invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function listInviteRoles (interaction, client) {
  const name = interaction.options.getString('name')
  const listAll = name == null
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const embeds = serverConfig.inviteRoles.filter(rule => {
    return rule.name === name || listAll
  }).map(rule => {
    const stats = getStats(rule)
    return {
      title: `Invite Role Assignment: ${rule.name}`,
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: { text: `Created ${stats.created_at} • Updated ${stats.updated_at} • ${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}` }
    }
  })

  if (!embeds.length) {
    embeds.push({
      title: listAll
        ? 'Command Failed: No Invite Role Assignments'
        : 'Command Failed: No Matching Rule',
      description: listAll
        ? 'Your server does not have any invite role assignment rules associated with it.\nTry adding one with the `/inviteroles add` command!'
        : 'There was no invite role assignment rule with the name that was provided'
    })
  }

  return interaction.reply({
    content: listAll ? 'Details of all role assignments:' : undefined,
    embeds,
    ephemeral: !embeds.length
  })
}

/**
 * Lists the invites that will give people a role upon joining
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function listTargetedInvites (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const serverInvites = await interaction.guild.invites.fetch()
  const inviteArray = serverInvites.map((invite) => {
    return {
      code: invite.code,
      uses: invite.uses,
      channel: invite.channel.id,
      inviter: invite.inviter
    }
  })
  const channelsWithAssignment = serverConfig.inviteRoles.reduce((previous, current) => previous.concat(current.inviteChannelIds), [])
  const invitesWithAssignment = inviteArray.filter(invite => channelsWithAssignment.includes(invite.channel))
  invitesWithAssignment.forEach(invite => {
    const associatedRoles = serverConfig.inviteRoles
      .filter(rule => rule.inviteChannelIds.includes(invite.channel))
      .map(rule => rule.rolesToAdd)
      .flat()
    const associatedRolesToRemove = serverConfig.inviteRoles
      .filter(rule => rule.inviteChannelIds.includes(invite.channel))
      .map(rule => rule.rolesToRemove)
      .flat()
    Object.assign(invite, { associatedRoles, associatedRolesToRemove })
  })

  const embeds = invitesWithAssignment.map(invite => {
    const color = invite.associatedRoles.length > 1 ? parseInt('5a686c', 16) : interaction.guild.roles.cache.get(invite.associatedRoles[0]).color
    return {
      color,
      title: '',
      author: { name: `${invite.inviter.username} (via ${invite.code})`, iconURL: invite.inviter.displayAvatarURL() },
      description: `Invite Channel: <#${invite.channel}>, Uses: ${invite.uses}\n` +
        `Roles Assigned: ${invite.associatedRoles.map(roleId => `<@&${roleId}>`).join(', ')}\n` +
        `Roles Removed: ${invite.associatedRolesToRemove.map(roleId => `<@&${roleId}>`).join(', ')}`
    }
  })

  return interaction.reply({
    content: 'All invites that will assign or remove roles from people who join through them:',
    embeds // ,
    // ephemeral: true
  })
}

/**
 * Removes a rule that manages invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function removeInviteRule (interaction, client) {
  const name = interaction.options.getString('name')
  const [removeDescription, removeColor] = [interaction.options.getBoolean('description'), interaction.options.getBoolean('color')]

  const { error, channels, roles, removeRoles, warnings } = getChannelsAndRoles(interaction)
  if (error) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: error
      }],
      ephemeral: true
    })
    return
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)

  const rule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if (!rule) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Unable to delete ' + name,
        description: 'This invite role assignment rule does not exist'
      }],
      ephemeral: true
    })
    return
  }

  if (removeDescription) delete rule.description
  if (removeColor) delete rule.color
  channels.forEach(channel => {
    const updated = rule.inviteChannelIds.filter(c => c !== channel.id)
    if (updated.length === 0) return warnings.push('Rule must still contain at least one channel. Channel modifications have been ignored.')
    rule.inviteChannelIds = updated
  })
  roles.forEach(role => {
    const updated = rule.rolesToAdd.filter(r => r !== role.id)
    if (updated.length === 0) return warnings.push('Rule must still contain at least one role. Role modifications have been ignored.')
    rule.rolesToAdd = updated
  })
  removeRoles.forEach(role => {
    const updated = rule.rolesToRemove.filter(r => r !== role.id)
    rule.rolesToRemove = updated
  })

  const replyContent = {
    embeds: [] // ,
    // ephemeral: true
  }
  if (warnings.length) {
    replyContent.embeds.push({
      color: 0xf0b800,
      title: 'Warnings',
      description: warnings.join('\n')
    })
  }

  const stats = getStats(rule)
  if (!roles.size && !channels.size && removeDescription == null && removeColor == null) {
    // Delete the entire rule
    replyContent.embeds.push({
      title: `Deleted \`${name}\``,
      thumbnail: { url: 'https://files.catbox.moe/y2ev8v.png' },
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: { text: `Created ${stats.created_at} • Deleted just now • ${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}` }
    })
    const updated = serverConfig.inviteRoles.filter(r => r !== rule)
    await serverSettingsDB.put(Object.assign(serverConfig, { inviteRoles: updated }))
  } else {
    replyContent.embeds.push({
      title: `Updated \`${name}\``,
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: { text: `Created ${stats.created_at} • Updated ${stats.updated_at} • ${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}` }
    })
    await serverSettingsDB.put(serverConfig)
  }

  interaction.reply(replyContent)
}

/**
 * Renames a rule for managing invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function renameInviteRule (interaction, client) {
  const name = interaction.options.getString('name')
  const newName = interaction.options.getString('new')
  if (newName.match(/[^0-9a-zA-Z-_]/)) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'New name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    })
    return
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const rule = serverConfig.inviteRoles.find(r => r.name === name)
  rule.name = newName
  rule.updated_at = Date.now()

  await serverSettingsDB.put(serverConfig)

  const { created_at: createdAt, occurrences } = getStats(rule)
  const embed = {
    title: `Renamed \`${name}\` to \`${newName}\``,
    color: rule.color,
    description: (rule.description ? rule.description + '\n\n' : '') +
      `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
      `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
      `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
    footer: { text: `Created ${createdAt} • Updated just now • ${occurrences} use${occurrences === 1 ? '' : 's'}` }
  }
  interaction.reply({
    embeds: [embed] // ,
    // ephemeral: true
  })
}

function addUpdateCommandOptions (subcommand, requireInitial) {
  return subcommand
    .addStringOption(option => option.setName('name').setDescription('The name of your invite role assignment rule').setRequired(true))
    .addStringOption(option => option.setName('channels').setDescription('The channel for select invites (with the #), separated by spaces').setRequired(requireInitial))
    .addStringOption(option => option.setName('add-roles').setDescription('Roles (with the @), separated by spaces, to grant to people who are invited to this channel').setRequired(requireInitial))
    .addStringOption(option => option.setName('remove-roles').setDescription('Roles (with the @), separated by spaces, to remove from those invited to this channel'))
    .addStringOption(option => option.setName('description').setDescription('A description that describes this invite role assignment rule'))
    .addStringOption(option => option.setName('color').setDescription('A HEX string to assign a color to this rule'))
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteroles')
    .setDescription('Manage roles that are automatically added with invites to certain channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('add').setDescription('Add a new role given to people invited to a certain channel')
      addUpdateCommandOptions(subcommand, true)
      return subcommand
    })
    .addSubcommand(subcommand => {
      return subcommand
        .setName('details')
        .setDescription('List role assignments that occur when someone joins the server')
        .addStringOption(option => option.setName('name').setDescription('The name of the assignment rule'))
    })
    .addSubcommand(subcommand => {
      return subcommand
        .setName('invites')
        .setDescription('Get a list of active invites that will add roles to people who use them')
    })
    .addSubcommand(subcommand => {
      subcommand.setName('rename').setDescription('Rename an invite role assignment rule')
        .addStringOption(option => option.setName('name').setDescription('The current name of your invite role assignment rule').setRequired(true))
        .addStringOption(option => option.setName('new').setDescription('The new name of your invite role assignment rule').setRequired(true))
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand
        .setName('remove')
        .setDescription('Remove linked channels or roles, or, if all params left blank, delete an entire invite role.')
        .addStringOption(option => option.setName('name').setDescription('The name of the rule you want to edit or delete').setRequired(true))
        .addStringOption(option => option.setName('channels').setDescription('Channels (with the #), separated by spaces, to remove from the specified rule'))
        .addStringOption(option => option.setName('add-roles').setDescription('Roles (with the @) to stop adding to users who join channels matching this rule'))
        .addStringOption(option => option.setName('remove-roles').setDescription('Roles (with the @) to stop removing from users who join channels matching this rule'))
        .addBooleanOption(option => option.setName('description').setDescription('Whether to remove the description from the specifed rule'))
        .addBooleanOption(option => option.setName('color').setDescription('Whether to remove the color from the specified rule'))
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('set').setDescription('Override fields in an invite role assignment rule')
      addUpdateCommandOptions(subcommand, false)
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('update').setDescription('Add fields to an invite role assignment rule')
      addUpdateCommandOptions(subcommand, false)
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'add': return addInviteRule(interaction, client, false, false)
      case 'details': return listInviteRoles(interaction, client)
      case 'invites': return listTargetedInvites(interaction, client)
      case 'rename': return renameInviteRule(interaction, client)
      case 'remove': return removeInviteRule(interaction, client)
      case 'set': return addInviteRule(interaction, client, true, true)
      case 'update': return addInviteRule(interaction, client, true, false)
    }
  }
}
