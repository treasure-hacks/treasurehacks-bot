// eslint-disable-next-line no-unused-vars
const { Collection, GuildMember, Events } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { client } = require('../modules/bot-setup')
const { sendMessage } = require('../modules/message')
const { getStats } = require('../modules/role-stats')
const { searchByID } = require('../modules/members')

// Track Invites

/*
const invites = new Collection()

async function loadInvites () {
  // Cache invites
  await client.guilds.fetch()
  client.guilds.cache.forEach(async guild => {
    // Fetch all Guild Invites
    const firstInvites = await guild.invites.fetch()
    const inviteArray = firstInvites.map(invite => [invite.code, invite.uses])
    invites.set(guild.id, new Map(inviteArray))
  })
}
async function updateGuildInvites (guild) {
  const guildInvites = await guild.invites.fetch()
  invites.set(guild.id, new Map(guildInvites.map(invite => [invite.code, invite.uses])))
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

*/

/**
 * Adds invite roles to a new server member
 * @param {GuildMember} member The member to add invite roles to
 */
async function addInviteRolesToNewMember (member) {
  // const newInvites = await member.guild.invites.fetch()
  // // This is the *existing* invites for the guild.
  // const oldInvites = invites.get(member.guild.id)
  // // Look through the invites, find the one for which the uses went up.
  // const invite = newInvites.find(i => i.uses > oldInvites.get(i.code))
  // updateGuildInvites(member.guild)
  let source
  for (let i = 0; i < 5; i++) {
    const result = await searchByID(member.guild, member.id)
    source = result?.source_invite_code
    console.log(i, !!source)
    if (result) break
    await new Promise(resolve => setTimeout(resolve, 2000)) // give it time
  }

  const invite = await member.guild.invites.fetch(source)

  // test
  if (!source || !invite) {
    // We don't know which invite someone used
    return console.warn('Unknown invite for user: ' + member.user?.tag)
  }

  const serverConfig = await serverSettingsDB.get(member.guild.id)
  const logChannel = await member.guild.channels.fetch(serverConfig.logChannel)

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

  const actions = serverConfig.inviteRoles.filter(action => {
    return action.enabled && action.invites?.includes(invite.code)
  })
  for (const action of actions) {
    action.occurrences++
    action.rolesToAdd.forEach(roleId => {
      const role = member.guild.roles.cache.get(roleId)
      member.roles.add(role).catch(() => logChannel?.send(`Failed to add role ${role.name} to ${member.displayName}`))
    })
    setTimeout(() => {
      action.rolesToRemove.forEach(roleId => {
        const role = member.guild.roles.cache.get(roleId)
        member.roles.remove(role).catch(() => logChannel?.send(`Failed to remove role ${role.name} from ${member.displayName}`))
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
  }
  await serverSettingsDB.put(serverConfig)
  if (actions.length > 0) sendMessage(logChannel, { embeds })
}

client.on(Events.GuildMemberAdd, addInviteRolesToNewMember)
client.on(Events.GuildMemberAvailable, m => console.log('member available'))
client.on(Events.GuildMemberUpdate, m => console.log('member updated', m.displayName))
client.addListener(Events.Raw, m => console.log('EVENT:', m.t))
