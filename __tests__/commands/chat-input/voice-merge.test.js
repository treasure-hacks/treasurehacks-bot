const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { mergePeople } = require('../../../src/commands/chat-input/voice-merge')

function createVoiceState (channel, member) {
  return {
    member,
    channelId: channel.id,
    channel,
    setChannel: jest.fn()
  }
}

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })
client.guilds.cache.set(guild.id, guild)

const users = [
  discordMock.createUser(client, { id: 'u1' }),
  discordMock.createUser(client, { id: 'u2' })
]
const members = [
  discordMock.createMember(client, { user: users[0], roles: [] }, guild),
  discordMock.createMember(client, { user: users[1], roles: [] }, guild)
]
users.forEach(u => client.users.cache.set(u.id, u))

const category = discordMock.createChannel(client, guild, { id: '1', name: 'CAT!', type: ChannelType.GuildCategory })
const channel = discordMock.createChannel(client, guild, { id: '2', name: 'TEXT!', type: ChannelType.GuildText })
const voiceCh = discordMock.createChannel(client, guild, { id: '3', name: 'VOICE', type: ChannelType.GuildVoice, parentId: '1' })
const stageCh = discordMock.createChannel(client, guild, { id: '4', name: 'STAGE', type: ChannelType.GuildStageVoice })
const stageC2 = discordMock.createChannel(client, guild, { id: '5', name: 'STAGE2', type: ChannelType.GuildStageVoice })
client.channels.cache.set(category.id, category)
client.channels.cache.set(channel.id, channel)
client.channels.cache.set(voiceCh.id, voiceCh)
client.channels.cache.set(stageCh.id, stageCh)
client.channels.cache.set(stageC2.id, stageC2)
guild.voiceStates.cache.set('u1', createVoiceState(voiceCh, members[0]))
guild.voiceStates.cache.set('u2', createVoiceState(voiceCh, members[1]))

describe('Voice Merge Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    this.interaction.options.getString.mockReturnValue('name')
  })
  beforeEach(() => {
    this.interaction.reply.mockClear()
    channel.send.mockClear()
    members[0].voice.setChannel.mockClear()
    members[1].voice.setChannel.mockClear()
  })

  it('Replies with error if the current channel is not a voice channel', async () => {
    const expectedReply = { content: 'Error: Is not a voice channel', ephemeral: true }
    await mergePeople(this.interaction, client, 0)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Refreshes the guild', async () => {
    this.interaction.channelId = voiceCh.id
    await mergePeople(this.interaction, client, 0)
    expect(guild.fetch).toBeCalled()
  })

  it('Replies with message indicating the number of people being merged', async () => {
    this.interaction.channelId = stageCh.id
    client.channels.cache.set(channel.id, channel)
    const expectedReply = { content: 'Merging 2 members into <#4>', ephemeral: true }

    await mergePeople(this.interaction, client, 0)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Sends a message that people will be moved', async () => {
    const interaction = discordMock.createInteraction(client, { guild, channel: stageCh })
    await mergePeople(interaction, client, 0)
    expect(voiceCh.send).toBeCalledWith('You are being moved to <#4>. (<@u1> <@u2>)')
  })

  it('Moves people to the voice channel the command was run in', async () => {
    guild.voiceStates.cache.set('u1', createVoiceState(stageCh, members[0])) // user 1 is NOT being moved

    await mergePeople(this.interaction, client, 0)
    expect(members[0].voice.setChannel).not.toBeCalled()
    expect(members[1].voice.setChannel).toBeCalledWith(stageCh)
    expect(members[1].voice.setChannel).toBeCalledTimes(1)
  })

  it('Only moves people in the specified category, if it\'s provided', async () => {
    guild.voiceStates.cache.set('u1', createVoiceState(voiceCh, members[0])) // user 1 is inside category
    guild.voiceStates.cache.set('u2', createVoiceState(stageCh, members[1])) // user 2 is outside category
    this.interaction.channel = stageC2
    this.interaction.options.getChannel.mockReturnValue(category)

    await mergePeople(this.interaction, client, 0)
    expect(members[0].voice.setChannel).toBeCalledTimes(1)
    expect(members[1].voice.setChannel).not.toBeCalled()
  })
})
