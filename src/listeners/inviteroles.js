// eslint-disable-next-line no-unused-vars
const { Collection, GuildMember, Events } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { client } = require('../modules/bot-setup')
const { sendMessage } = require('../modules/message')
const { getStats } = require('../modules/role-stats')

// Track Invites
const invites = new Collection()

async function loadInvites () {
  // Cache invites
  await client.guilds.fetch()
  client.guilds.cache.forEach(async guild => {
    // Fetch all Guild Invites
    const firstInvites = await guild.invites.fetch()
    const inviteArray = firstInvites.map((invite) => [invite.code, invite.uses])
    invites.set(guild.id, new Collection(inviteArray))
  })
}
function updateGuildInvites (guild) {
  guild.invites.fetch().then(guildInvites => {
    // This is the same as the ready event
    invites.set(guild.id, new Map(guildInvites.map((invite) => [invite.code, invite.uses])))
  })
}

client.on(Events.InviteDelete, (invite) => {
  // Delete the Invite from Cache
  invites.get(invite.guild.id).delete(invite.code)
})

client.on(Events.InviteCreate, (invite) => {
  // Update cache on new invites
  invites.get(invite.guild.id).set(invite.code, invite.uses)
})

client.on(Events.GuildCreate, async (guild) => {
  // We've been added to a new Guild. Let's fetch all the invites, and save it to our cache
  updateGuildInvites(guild)
})

client.on(Events.GuildDelete, (guild) => {
  // We've been removed from a Guild. Let's delete all their invites
  invites.delete(guild.id)
})

/**
 * Adds invite roles to a new server member
 * @param {GuildMember} member The member to add invite roles to
 */
async function addInviteRolesToNewMember (member) {
  const serverConfig = await serverSettingsDB.get(member.guild.id)

  const newInvites = await member.guild.invites.fetch()
  // This is the *existing* invites for the guild.
  const oldInvites = invites.get(member.guild.id)
  // Look through the invites, find the one for which the uses went up.
  const invite = newInvites.find(i => i.uses > oldInvites.get(i.code))
  updateGuildInvites(member.guild)

  const channels = await member.guild.channels.fetch()
  const logChannel = channels.get(serverConfig.logChannel)

  const embeds = [{
    color: parseInt('5a686c', 16),
    author: { name: 'Member Joined', iconURL: member.displayAvatarURL() },
    title: '',
    description: `<@!${member.id}> has been invited to the server!`,
    fields: [
      { name: 'Inviter', value: `${invite.inviter.username}#${invite.inviter.discriminator}`, inline: true },
      { name: 'Code', value: invite.code, inline: true },
      { name: 'Channel', value: `${invite.channel.name}`, inline: true }
    ],
    timestamp: new Date().toISOString()
  }]

  const actions = serverConfig.inviteRoles.filter(action => action.inviteChannelIds?.includes(invite.channel.id))
  serverConfig.inviteRoles = serverConfig.inviteRoles.map(action => {
    if (!action.inviteChannelIds?.includes(invite.channel.id)) return action
    action.occurrences += 1
    action.rolesToAdd.forEach(roleId => {
      const role = member.guild.roles.cache.get(roleId)
      member.roles.add(role)
        .catch(() => { sendMessage(logChannel, `Failed to add role ${role.name} to ${member.displayName}`) })
    })
    setTimeout(() => {
      action.rolesToRemove.forEach(roleId => {
        const role = member.guild.roles.cache.get(roleId)
        member.roles.remove(role)
          .catch(() => { sendMessage(logChannel, `Failed to remove role ${role.name} from ${member.displayName}`) })
      })
    }, 2000)
    const stats = getStats(action)
    embeds.push({
      color: action.color,
      author: { name: `${member.user.username}#${member.user.discriminator}`, iconURL: member.displayAvatarURL() },
      title: 'Invite Role Assignment: ' + action.name,
      description: (action.description ? action.description + '\n\n' : '') +
        `Assigned the following roles to <@!${member.id}>: ${action.rolesToAdd.map(id => `<@&${id}>`).join(', ')}\n` +
        `Removed the following roles from <@!${member.id}>: ${action.rolesToRemove.map(id => `<@&${id}>`).join(', ')}`,
      footer: {
        text: `Created ${stats.created_at} • Updated ${stats.updated_at} • ` +
          `${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}`
      }
    })
    return action
  })
  await serverSettingsDB.put(serverConfig)
  console.log(embeds)
  if (actions.length > 0) sendMessage(logChannel, { embeds })
}

client.once(Events.ClientReady, loadInvites)
client.on(Events.GuildMemberAdd, addInviteRolesToNewMember)
