// eslint-disable-next-line no-unused-vars
const { Events, AutoModerationActionExecution, AutoModerationActionType, GuildChannel, GuildMember, Message } = require('discord.js')
const { serverSettingsDB } = require('../modules/database')

const { client } = require('../modules/bot-setup')
const { searchByID } = require('../modules/members')

const TIMEOUT_HOURS = 24
const MEMORY_MESSAGE_TTL = 20
/** @type {{ [key: string]: number }} */
const recentExecutions = {} // so we can associate it with the first message

/**
 * Takes action against a guild member for repeated offenses
 * @param {GuildChannel} alertsChannel The alerts channel`
 * @param {GuildMember} member The member to take action against
 */
async function takeAction (alertsChannel, member) {
  const result = await searchByID(member.guild, member.id)
  await alertsChannel.send({
    embeds: [{
      description: `Taking action against ${member}`,
      fields: [
        { name: 'Inviter', value: `<@${result.inviter_id ?? 0}>`, inline: true },
        { name: 'Source Invite', value: String(result.source_invite_code), inline: true },
        { name: 'Source Type', value: String(result.join_source_type), inline: true }
      ]
    }]
  })
  member.timeout(TIMEOUT_HOURS * 3600 * 1000, 'Timeout due to repeated automod trigger')
}

/**
 * Scans the chat message for harmful or malicious links
 * @param {AutoModerationActionExecution} data The chat message
 */
async function scanMessage (data) {
  // We only care about the actual block, not the alert or timeout
  if (data.action.type !== AutoModerationActionType.BlockMessage) return

  const member = await data.guild.members.fetch(data.userId)
  // Ignore messages sent by bots
  if (!member || member.user.bot) return
  const serverConfig = await serverSettingsDB.get(data.guild.id)
  if (!serverConfig?.automodStrike?.enabled) return

  const channels = await data.guild.channels.fetch()
  const alertsChannel = channels.get(serverConfig.alertsChannel)

  const contentID = `${data.userId}/${data.ruleId}`
  if (recentExecutions[contentID]) {
    if (++recentExecutions[contentID] === 3) takeAction(alertsChannel, member)
    return
  }

  // Mark it temporarily so we can catch repeated instances
  // of the same message in a short amount of time
  recentExecutions[contentID] = 1
  /** @type {Message} */
  let message = null
  setTimeout(() => {
    delete recentExecutions[contentID]
    if (message) message.delete().catch(() => {})
  }, MEMORY_MESSAGE_TTL * 1000)

  const rule = await data.guild.autoModerationRules.fetch(data.ruleId)

  message = await alertsChannel.send({
    author: { name: member.displayName, icon_url: member.displayAvatarURL() },
    content: `[BETA] Automod rule first triggered: ${rule.name}`
  })
}

client.on(Events.AutoModerationActionExecution, scanMessage)
