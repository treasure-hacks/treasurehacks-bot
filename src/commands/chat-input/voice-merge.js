// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType, GuildMember } = require('discord.js')

/**
 * Merges people into the voice channel where this command is run
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function mergePeople (interaction, client, delay = 15) {
  const category = interaction.options.getChannel('category')
  const channel = interaction.channel
  delay = interaction.options.getInteger('delay') ?? delay

  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
    return interaction.reply({ content: 'Error: Is not a voice channel', ephemeral: true })
  }

  await interaction.guild.fetch()
  const states = interaction.guild.voiceStates.cache.map(vs => vs)
    .filter(vs => !category || vs.channel.parentId === category.id)
    .filter(vs => vs.channel && vs.channel.id !== channel.id)

  const members = states.map(vs => vs.member)
  const channels = [...new Set(states.map(s => s.channel))]
  const peopleText = members.length + (members.length === 1 ? ' member' : ' members')
  await interaction.reply({ content: `Merging ${peopleText} into ${channel}`, ephemeral: true })

  for (const ch of channels) {
    const mentions = states.filter(s => s.channelId === ch.id).map(s => s.member)
    const delayText = delay ? ` in ${delay} second${delay > 1 ? 's' : ''}` : '' // in <delay> second(s)
    await ch.send(`You ${delay ? 'will be' : 'are being'} moved to ${channel}` +
      `${delayText}. (${mentions.join(' ')})`)
  }

  // Await the delay
  await new Promise(resolve => setTimeout(resolve, delay * 1000))

  for (const member of members) {
    await member.voice.setChannel(channel)
  }
  interaction.editReply({ content: `Successfully merged ${peopleText} into ${channel}`, ephemeral: true })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice-merge')
    .setDescription('Merge people into the current voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => option
      .setName('category')
      .setDescription('Merge people from only this category')
      .addChannelTypes(ChannelType.GuildCategory)
    )
    .addIntegerOption(option => option
      .setName('delay')
      .setDescription('Number of seconds beforee merging (defaults to 15)')
    ),
  execute: async (interaction, client) => {
    return mergePeople(interaction, client)
  },
  // Expose for tests
  mergePeople
}
