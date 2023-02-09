// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const { getLeaderboard, generateLeaderboardPost, updateLeaderboardPost, getLeaderboardMessage } = require('../../scripts/leaderboard')

/**
 * Creates a leaderboard from a slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function createLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')
  const title = interaction.options.getString('title')
  const type = interaction.options.getString('type')
  const channel = interaction.options.getChannel('channel')

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const leaderboards = serverConfig.leaderboards || {}
  serverConfig.leaderboards = leaderboards // In case it's not a part of the serverConfig yet
  if (leaderboards[name]) {
    return interaction.reply({
      content: 'Error: leaderboard with that name already exists',
      ephemeral: true
    })
  }

  const scores = {} // User ID maps to a list of post links or an integer
  const leaderboard = { name, title, type, scores }
  leaderboards[name] = (leaderboard)
  await serverSettingsDB.put(serverConfig)

  await interaction.reply({
    content: '',
    embeds: [{
      title: 'Leaderboard Created: ' + title,
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Type', value: type, inline: true }
      ],
      color: 0x00cc00
    }]
  })

  if (!channel) return
  const messageContent = generateLeaderboardPost(leaderboard)
  const message = await channel.send(messageContent)
  leaderboard.channelID = channel.id
  leaderboard.messageID = message.id

  // Update the DB again
  await serverSettingsDB.put(serverConfig)
}

/**
 * Deletes a leaderboard from a chat command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function deleteLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const { leaderboards } = serverConfig
  if (!leaderboards || !leaderboards[name]) {
    return interaction.reply(`No such leaderboard with name ${name} exists`)
  }

  const leaderboard = leaderboards[name]
  delete leaderboards[name]
  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Leaderboard Deleted: ' + leaderboard.title,
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Type', value: leaderboard.type, inline: true }
      ],
      color: 0xff0000
    }]
  })

  // Delete the post for the leaderboard if it exists
  const existingChannel = await interaction.guild.channels.fetch(leaderboard.channelID)
  const existingMessage = await existingChannel?.messages?.fetch(leaderboard.messageID)
    .catch(() => {}) // existingMessage won't exist if this fails
  if (existingMessage?.deletable) existingMessage.delete()
}

/**
 * Re-posts a leaderboard from a slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function repostLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const leaderboard = await getLeaderboard(serverConfig, name)
  if (!leaderboard) {
    return interaction.reply({
      content: `No such leaderboard with name ${name} exists`,
      ephemeral: true
    })
  }
  await interaction.deferReply()

  // Delete the old post for the leaderboard if it exists
  const existingChannel = await interaction.guild.channels.fetch(leaderboard.channelID)
  const existingMessage = await existingChannel?.messages?.fetch(leaderboard.messageID)
    .catch(() => {}) // existingMessage won't exist if this fails
  if (existingMessage?.deletable) existingMessage.delete()
  await interaction.deleteReply()

  const messageContent = generateLeaderboardPost(leaderboard)
  const message = await interaction.channel.send(messageContent)

  leaderboard.channelID = message.channelId
  leaderboard.messageID = message.id

  await serverSettingsDB.put(serverConfig)
}

/**
 * Updates a posts leaderboard from a slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function updatePostsLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const leaderboard = await getLeaderboard(serverConfig, name)
  if (!leaderboard) {
    return interaction.reply({
      content: `No such leaderboard with name ${name} exists`,
      ephemeral: true
    })
  }
  if (leaderboard.type !== 'post') {
    return interaction.reply({
      content: 'Leaderboard is not a post leaderboard',
      ephemeral: true
    })
  }

  const linksResponse = interaction.options.getString('links')
  if (!linksResponse.match(/^(https:\/\/[^\s]*discord\.com\/channels(\/\d+){3}(\s|$))+/)) {
    return interaction.reply({
      content: 'Could not find space-separated links to messages',
      ephemeral: true
    })
  }

  await interaction.deferReply()

  for (const link of linksResponse.split(' ')) {
    const [channelID, messageID] = link.match(/\/channels\/\d+\/(\d+)\/(\d+)/).slice(1)
    const channel = await interaction.guild.channels.fetch(channelID)
    const message = await channel?.messages?.fetch(messageID).catch(() => {})
    if (!message) continue

    const userScore = leaderboard.scores[message.member.id] || []
    leaderboard.scores[message.member.id] = userScore
    if (userScore.find(m => m.messageID === messageID)) continue
    userScore.push({ channelID, messageID })
  }

  updateLeaderboardPost(leaderboard, interaction.guild)
  await serverSettingsDB.put(serverConfig)
  const lm = await getLeaderboardMessage(leaderboard, interaction.guild)
  interaction.followUp({
    embeds: [{
      title: 'Leaderboard Updated',
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Title', value: leaderboard.title, inline: true },
        { name: 'Message Link', value: lm ? `[#${lm.channel.name}](${lm.url})` : '<None>', inline: true }
      ],
      color: 0x0077cc
    }]
  })
}

/**
 * Updates a posts leaderboard from a slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function updateUsersLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')
  const amount = interaction.options.getNumber('amount') || 1
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const leaderboard = await getLeaderboard(serverConfig, name)
  if (!leaderboard) {
    return interaction.reply({
      content: `No such leaderboard with name ${name} exists`,
      ephemeral: true
    })
  }
  if (leaderboard.type !== 'user') {
    return interaction.reply({
      content: 'Leaderboard is not a user leaderboard',
      ephemeral: true
    })
  }

  const usersResponse = interaction.options.getString('users')
  const usersMatch = usersResponse.match(/<@\D?(\d+)>/g)
  if (!usersMatch) {
    return interaction.reply({
      content: 'Could not find user mentions',
      ephemeral: true
    })
  }

  await interaction.deferReply()

  for (const mention of usersMatch) {
    const [userID] = mention.match(/<@\D?(\d+)>/).slice(1)
    const userScore = leaderboard.scores[userID] || 0
    leaderboard.scores[userID] = userScore + amount
  }

  updateLeaderboardPost(leaderboard, interaction.guild)
  await serverSettingsDB.put(serverConfig)
  const lm = await getLeaderboardMessage(leaderboard, interaction.guild)
  interaction.followUp({
    embeds: [{
      title: 'Leaderboard Updated',
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Title', value: leaderboard.title, inline: true },
        { name: 'Message Link', value: lm ? `[#${lm.channel.name}](${lm.url})` : '<None>', inline: true }
      ],
      color: 0x0077cc
    }]
  })
}

/**
 * Lists details about all current leaderboards
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function listLeaderboards (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const { leaderboards } = serverConfig
  const texts = []
  for (const l of Object.values(leaderboards)) {
    const message = await getLeaderboardMessage(l, interaction.guild)
    const highest = Object.entries(l.scores).sort((b, a) => {
      return (a[1].length || a[1]) - (b[1].length || b[1])
    })[0]
    const text = `__**${l.title}** (${l.name}):__\n` +
      `Users on Leaderboard: ${Object.keys(l.scores).length}` +
      (highest ? `\nHighest Scorer: <@${highest[0]}> (${highest[1].length || highest[1]})` : '') +
      (message ? `\n[Link to Leaderboard](${message.url})` : '')
    texts.push(text)
  }
  interaction.reply(texts.join('\n\n'))
}

/**
 * Resets a leaderboard
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function resetLeaderboard (interaction, client) {
  const name = interaction.options.getString('name')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const leaderboard = await getLeaderboard(serverConfig, name)
  const replyContent = 'Old Leaderboard Content:\n\n' + generateLeaderboardPost(leaderboard)

  leaderboard.scores = {}
  updateLeaderboardPost(leaderboard, interaction.guild)
  await serverSettingsDB.put(serverConfig)
  const lm = await getLeaderboardMessage(leaderboard, interaction.guild)
  interaction.reply({
    embeds: [{
      title: 'Leaderboard Reset',
      content: replyContent,
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Title', value: leaderboard.title, inline: true },
        { name: 'Message Link', value: lm ? `[#${lm.channel.name}](${lm.url})` : '<None>', inline: true }
      ],
      color: 0x0077cc
    }]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Manages leaderboards for different server activiites')
    .addSubcommand(subcommand => subcommand
      .setName('create')
      .setDescription('Creates a leaderboard')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard. Shorter names are easier to remember!')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('title')
        .setDescription('The title for the leaderboard post to show')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('type')
        .setDescription('The type of leaderboard')
        .setRequired(true)
        .addChoices(
          { name: 'Post Counter', value: 'post' },
          { name: 'User Counter', value: 'user' }
        )
      )
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('The channel to post the leaderboard in')
        .addChannelTypes(ChannelType.GuildText)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('delete')
      .setDescription('Deletes a leaderboard')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard to delete')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('Lists all leaderboards')
    )
    .addSubcommand(subcommand => subcommand
      .setName('repost')
      .setDescription('Reposts a leaderboard in the current channel')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('reset')
      .setDescription('Resets a leaderboard')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard to reset')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('post_score')
      .setDescription('Updates a leaderboard by adding posts to it')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('links')
        .setDescription('Links to the posts to count, separated by spaces')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('user_score')
      .setDescription('Updates a leaderboard by adding a point to the following users')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the leaderboard')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('users')
        .setDescription('Mentions of the users to increment points for')
        .setRequired(true)
      )
      .addNumberOption(option => option
        .setName('amount')
        .setDescription('Amount to increment the users\' scores by, defaults to 1')
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'create': return createLeaderboard(interaction, client)
      case 'delete': return deleteLeaderboard(interaction, client)
      case 'repost': return repostLeaderboard(interaction, client)
      case 'post_score': return updatePostsLeaderboard(interaction, client)
      case 'user_score': return updateUsersLeaderboard(interaction, client)
      case 'list': return listLeaderboards(interaction, client)
      case 'reset': return resetLeaderboard(interaction, client)
    }
  }
}
