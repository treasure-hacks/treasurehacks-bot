// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const { generateLeaderboardPost } = require('../../scripts/leaderboard')

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
  const { leaderboards } = serverConfig
  if (!leaderboards || !leaderboards[name]) {
    return interaction.reply(`No such leaderboard with name ${name} exists`)
  }
  const leaderboard = leaderboards[name]
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

/*
# Create a counter
/counter create name:str count_type:post|user channel:channel
# Delete a counter
/counter delete name:str
# Re-posts the counter post in the current channel
/counter repost name:str
# Adds a post to a counter
/counter post_score name:str post:post count:bool
# Changes the score of a user
/counter user_score name:str user:user score:int

 */

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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'create': return createLeaderboard(interaction, client)
      case 'delete': return deleteLeaderboard(interaction, client)
      case 'repost': return repostLeaderboard(interaction, client)
      // case 'post_score': return respond(interaction, client)
      // case 'user_score': return respond(interaction, client)
      // case 'list': return respond(interaction, client)
    }
  }
}
