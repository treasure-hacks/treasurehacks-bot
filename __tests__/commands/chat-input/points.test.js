const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { respondWithPoints } = require('../../../src/commands/chat-input/points')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: '0', name: 'Some Guild' })
client.guilds.cache.set(guild.id, guild)
const category = discordMock.createChannel(client, guild, { id: '1', type: ChannelType.GuildCategory, name: 'category' })
const channel = discordMock.createChannel(client, guild, { id: '2', guild, name: 'main' })
guild.channels.cache.set(category.id, category)
guild.channels.cache.set(channel.id, channel)

const user = discordMock.createUser(client, { id: 'u1' })
const member = discordMock.createMember(client, { user, roles: [] }, guild)

describe('Points Command', () => {
  beforeEach(() => {
    this.interaction = discordMock.createInteraction(client, { guild, member })
    this.interaction.options.getChannel.mockReturnValue(channel)
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.get.mockReturnValue({})
  })

  afterEach(() => {
    detaMock.Base.get.mockReset()
    this.interaction.reply.mockClear()
  })

  it('Returns 0 of each type of point-earning task by default', async () => {
    const expectedReply = {
      content: '',
      embeds: [{
        title: '📊 Point Counter',
        description: 'You have 0 points in Some Guild',
        fields: [
          { name: 'Messages', value: '0 sent', inline: true },
          { name: 'Weekly Challenges', value: '0 completed', inline: true },
          { name: 'Workshops', value: '0 attended', inline: true }
        ]
      }],
      ephemeral: true
    }
    await respondWithPoints(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Returns the correct amount of points for each task', async () => {
    detaMock.Base.get.mockReturnValue({
      messageCounter: { counts: { u1: 1 } },
      attendance: { event: ['u2'] }, // a different user
      leaderboards: { weekly: { scores: { u1: [] } } } // zero
    })
    const expectedReply = {
      content: '',
      embeds: [{
        title: '📊 Point Counter',
        description: 'You have 1 point in Some Guild',
        fields: [
          { name: 'Messages', value: '1 sent', inline: true },
          { name: 'Weekly Challenges', value: '0 completed', inline: true },
          { name: 'Workshops', value: '0 attended', inline: true }
        ]
      }],
      ephemeral: true
    }
    await respondWithPoints(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)

    detaMock.Base.get.mockReturnValue({
      messageCounter: { counts: { u1: 3 } },
      attendance: { event: ['u1'] },
      leaderboards: { weekly: { scores: { u1: [{}, {}] } } } // 2 posts of some sort
    })
    const expectedReply2 = {
      content: '',
      embeds: [{
        title: '📊 Point Counter',
        description: 'You have 53 points in Some Guild',
        fields: [
          { name: 'Messages', value: '3 sent', inline: true },
          { name: 'Weekly Challenges', value: '2 completed', inline: true },
          { name: 'Workshops', value: '1 attended', inline: true }
        ]
      }],
      ephemeral: true
    }
    await respondWithPoints(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply2)
  })
})
