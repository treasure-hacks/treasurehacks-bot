// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { ChannelType } = require('discord.js')
const {
  createLeaderboard, deleteLeaderboard, repostLeaderboard,
  updatePostsLeaderboard, /* updateUsersLeaderboard, listLeaderboards, */ resetLeaderboard
} = require('../../../src/commands/chat-input/leaderboard')
const { generateLeaderboardPost } = require('../../../src/scripts/leaderboard')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: '0' })
client.guilds.cache.set(guild.id, guild)
const category = discordMock.createChannel(guild, { id: '1', type: ChannelType.GuildCategory, name: 'category' })
const channel = discordMock.createChannel(guild, { id: '2', guild, name: 'main' }, client)
client.channels.cache.set(category.id, category)
client.channels.cache.set(channel.id, channel)

const user = discordMock.createUser(client, { id: 'u1' })
const member = discordMock.createMember(client, { user }, guild)

function testNonExistent (thisArg, fn) {
  return async () => {
    const expectedReply = {
      content: 'No such leaderboard with name leaderboard exists',
      ephemeral: true
    }
    detaMock.Base.get.mockReturnValue({})
    await fn(thisArg.interaction, client)
    expect(thisArg.interaction.reply).toBeCalledWith(expectedReply)

    detaMock.Base.get.mockReturnValueOnce({ leaderboards: { blah: {} } })
    await fn(thisArg.interaction, client)
    expect(thisArg.interaction.reply).toBeCalledWith(expectedReply)
  }
}

describe('Leaderboard Create Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild })
    channel.send.mockReturnValue({ id: '1' })
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
    detaMock.Base.get.mockReturnValue({})
    this.interaction.options.getString
      .mockReturnValueOnce('leaderboard') // Name
      .mockReturnValueOnce('Leaderboard') // Title
      .mockReturnValueOnce('post') // Type (post or user)
    this.interaction.options.getChannel.mockReturnValue(channel)
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockClear()
    channel.send.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
  })

  it('Replies with an error if a leaderboard with that name already exists', async () => {
    detaMock.Base.get.mockReturnValueOnce({
      leaderboards: { leaderboard: { title: 'test' } }
    })
    await createLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      content: 'Error: leaderboard with that name already exists',
      ephemeral: true
    })
  })

  it('Replies with an embed that the leaderboard was created', async () => {
    const expectedReply = {
      content: '',
      embeds: [{
        title: 'Leaderboard Created: Leaderboard',
        fields: [
          { name: 'Name', value: 'leaderboard', inline: true },
          { name: 'Type', value: 'post', inline: true }
        ],
        color: 0x00cc00
      }]
    }
    await createLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the database with the settings for that leaderboard', async () => {
    const expectedDB = { leaderboards: {} }
    expectedDB.leaderboards.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      scores: {}
    }
    this.interaction.options.getChannel.mockReturnValueOnce(undefined)
    await createLeaderboard(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })

  it('Sends a message to the target channel if specified', async () => {
    const expectedContent = generateLeaderboardPost({
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      channelID: '2',
      messageID: '1',
      scores: {}
    })
    await createLeaderboard(this.interaction, client)
    expect(channel.send).toBeCalledWith(expectedContent)

    channel.send.mockClear()
    this.interaction.options.getChannel.mockReturnValueOnce(undefined)
    await createLeaderboard(this.interaction, client)
    expect(channel.send).not.toBeCalled()
  })

  it('Updates the database with the channel and message ID', async () => {
    const expectedDB = { leaderboards: {} }
    expectedDB.leaderboards.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      channelID: '2',
      messageID: '1',
      scores: {}
    }
    await createLeaderboard(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })
})

describe('Leaderboard Delete Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild })
    channel.send.mockReturnValue({ id: '1' })
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
    detaMock.Base.get.mockReturnValue({})
    this.interaction.options.getString.mockReturnValue('leaderboard')
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockClear()
    channel.send.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
  })

  it('Replies with an error if that leaderboard does not exist', testNonExistent(this, deleteLeaderboard))

  it('Replies with an embed stating that the leaderboard was deleted', async () => {
    const leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'user'
    }
    detaMock.Base.get.mockReturnValueOnce({ leaderboards: { leaderboard } })
    const expectedReply = {
      embeds: [{
        title: 'Leaderboard Deleted: Leaderboard',
        fields: [
          { name: 'Name', value: 'leaderboard', inline: true },
          { name: 'Type', value: 'user', inline: true }
        ],
        color: 0xff0000
      }]
    }
    await deleteLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the DB to remove the leaderboard', async () => {
    const leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'user'
    }
    detaMock.Base.get.mockReturnValueOnce({ leaderboards: { leaderboard } })
    await deleteLeaderboard(this.interaction, client)
    const expectedDB = { leaderboards: {} }
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })

  it('Deletes the existing leaderboard post, if it exists', async () => {
    this.interaction.guild.channels.fetch.mockReturnValueOnce(channel)
    const delFn = jest.fn()
    const resolver = discordMock.resolveTo({ delete: delFn, deletable: true })
    channel.messages = { fetch: jest.fn().mockReturnValueOnce(resolver) }

    const leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'user',
      channelID: '2',
      messageID: '1'
    }
    detaMock.Base.get.mockReturnValueOnce({ leaderboards: { leaderboard } })

    await deleteLeaderboard(this.interaction, client)
    expect(delFn).toBeCalled()
  })
})

describe.skip('Leaderboard List Command', () => {
  // Will need to test for cases like empty leaderboards
  it('Lists leaderboards correctly', async () => {})
})

describe('Leaderboard Repost Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    channel.send.mockReturnValue({ id: '1' })
    this.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      channelID: '2',
      messageID: '1',
      scores: {}
    }
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
    detaMock.Base.get.mockReturnValue({ leaderboards: { leaderboard: this.leaderboard } })
    this.interaction.options.getString.mockReturnValue('leaderboard')
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockClear()
    channel.send.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
    this.interaction.deferReply.mockClear()
    this.interaction.deleteReply.mockClear()
    this.interaction.deferReply.mockClear()
  })

  it('Replies with an error if that leaderboard does not exist', testNonExistent(this, repostLeaderboard))

  it('Defers and deletes the reply if the leaderboard exists', async () => {
    await repostLeaderboard(this.interaction, client)
    expect(this.interaction.deferReply).toBeCalled()
    expect(this.interaction.deleteReply).toBeCalled()
  })

  it('Deletes the old leaderboard message, if it exists', async () => {
    this.interaction.guild.channels.fetch.mockReturnValueOnce(channel)
    const delFn = jest.fn()
    const resolver = discordMock.resolveTo({ delete: delFn, deletable: true })
    channel.messages = { fetch: jest.fn().mockReturnValueOnce(resolver) }

    await repostLeaderboard(this.interaction, client)
    expect(delFn).toBeCalled()
  })

  it('Creates a new leaderboard message in the current channel', async () => {
    const expectedContent = generateLeaderboardPost({
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      channelID: '2',
      messageID: '1',
      scores: {}
    })
    await repostLeaderboard(this.interaction, client)
    expect(channel.send).toBeCalledWith(expectedContent)
  })

  it('Updates the database with the new channel and message ID', async () => {
    channel.send.mockReturnValue({ channelId: '3', id: '3' })
    const expectedDB = { leaderboards: {} }
    expectedDB.leaderboards.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      channelID: '3',
      messageID: '3',
      scores: {}
    }
    await repostLeaderboard(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })
})

describe('Leaderboard Reset Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    channel.send.mockReturnValue({ id: '1' })
    this.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'user',
      scores: { user1: 1 }
    }
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
    detaMock.Base.get.mockReturnValue({ leaderboards: { leaderboard: this.leaderboard } })
    this.interaction.options.getString.mockReturnValue('leaderboard')
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockReset()
    channel.send.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
    this.interaction.deferReply.mockClear()
    this.interaction.deleteReply.mockClear()
    this.interaction.deferReply.mockClear()
  })

  it('Replies with an error if that leaderboard does not exist', testNonExistent(this, resetLeaderboard))

  it('Replies with an embed of the old leaderboard content, as well as its settings', async () => {
    const expectedReply = {
      embeds: [{
        title: 'Leaderboard Reset',
        content: 'Old Leaderboard Content:\n\n' + generateLeaderboardPost(this.leaderboard),
        fields: [
          { name: 'Name', value: 'leaderboard', inline: true },
          { name: 'Title', value: 'Leaderboard', inline: true },
          { name: 'Message Link', value: '<None>', inline: true }
        ],
        color: 0x0077cc
      }]
    }
    await resetLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)

    const expectedReply2 = {
      embeds: [{
        title: 'Leaderboard Reset',
        content: 'Old Leaderboard Content:\n\n' + generateLeaderboardPost(this.leaderboard),
        fields: [
          { name: 'Name', value: 'leaderboard', inline: true },
          { name: 'Title', value: 'Leaderboard', inline: true },
          { name: 'Message Link', value: '[#main](test://0/2/1)', inline: true }
        ],
        color: 0x0077cc
      }]
    }
    this.leaderboard.channelID = '2'
    this.leaderboard.messageID = '1'
    guild.channels.fetch.mockReturnValue(channel)
    const editFn = jest.fn()
    /** @todo Make a discordMock message */
    const resolver = discordMock.resolveTo({ id: '1', url: 'test://0/2/1', edit: editFn, channel })
    channel.messages = { fetch: jest.fn().mockReturnValue(resolver) }

    await resetLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply2)

    // Clean up changes in this test
    delete this.leaderboard.channelID
    delete this.leaderboard.messageID
  })

  it('Updates the DB to remove the scores', async () => {
    const expectedDB = { leaderboards: {} }
    expectedDB.leaderboards.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'user',
      scores: {}
    }
    await resetLeaderboard(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })
})

describe.skip('Leaderboard Update Command (User Leaderboards)', () => {
  // Skipping these tests until further decision on whether to keep User Leaderboards
  it('Works correctly', async () => {})
})

describe('Leaderboard Update Command (Post Leaderboards)', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    channel.send.mockReturnValue({ id: '1' })
    this.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      scores: { user1: 1 }
    }
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
    detaMock.Base.get.mockReturnValue({ leaderboards: { leaderboard: this.leaderboard } })
    this.interaction.options.getString.mockReturnValueOnce('leaderboard') // name
    this.leaderboard.scores = {}
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockClear()
    channel.send.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
    this.interaction.deferReply.mockClear()
    this.interaction.deleteReply.mockClear()
    this.interaction.deferReply.mockClear()
  })

  it('Replies with an error if that leaderboard does not exist', testNonExistent(this, updatePostsLeaderboard))

  it('Replies with an error if that leaderboard is not a post leaderboard', async () => {
    this.leaderboard.type = 'user'
    const expectedReply = {
      content: 'Leaderboard is not a post leaderboard',
      ephemeral: true
    }
    await updatePostsLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)

    // Clean up after this test
    this.leaderboard.type = 'post'
  })

  it('Replies with an error if the links are formatted incorrectly', async () => {
    this.interaction.options.getString.mockReturnValueOnce('discord.com/channels/1/2/3 https://discord.com/channels/1/2/4*') // links
    const expectedReply = {
      content: 'Could not find space-separated links to messages',
      ephemeral: true
    }
    await updatePostsLeaderboard(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with an embed that the leaderboard was updated', async () => {
    guild.channels.fetch.mockReturnValue(channel)
    const message = { id: '5', edit: jest.fn(), member, channel, url: 'test://0/2/5' }
    channel.messages = { fetch: jest.fn(() => discordMock.resolveTo(message)) }
    this.interaction.options.getString.mockReturnValueOnce('https://discord.com/channels/1/2/3 https://discord.com/channels/1/7/8') // link

    const expectedReply = {
      embeds: [{
        title: 'Leaderboard Updated',
        fields: [
          { name: 'Name', value: 'leaderboard', inline: true },
          { name: 'Title', value: 'Leaderboard', inline: true },
          { name: 'Message Link', value: '[#main](test://0/2/5)', inline: true }
        ],
        color: 0x0077cc
      }]
    }

    await updatePostsLeaderboard(this.interaction, client)
    expect(this.interaction.followUp).toBeCalledWith(expectedReply)
  })

  it('Edits the message associated with the leaderboard', async () => {
    guild.channels.fetch.mockReturnValue(channel)
    const message = { id: '5', edit: jest.fn(), member, channel, url: 'test://0/2/5' }
    channel.messages = { fetch: jest.fn(() => discordMock.resolveTo(message)) }
    this.interaction.options.getString.mockReturnValueOnce('https://discord.com/channels/1/2/3 https://discord.com/channels/1/2/3') // link

    await updatePostsLeaderboard(this.interaction, client)
    expect(message.edit).toBeCalledWith(generateLeaderboardPost(this.leaderboard))
  })

  it('Updates the DB with the reflected changes', async () => {
    guild.channels.fetch.mockReturnValue(channel)
    const message = { id: '3', edit: jest.fn(), member, channel, url: 'test://0/2/3' }
    channel.messages = { fetch: jest.fn(() => discordMock.resolveTo(message)) }
    this.interaction.options.getString.mockReturnValueOnce('https://discord.com/channels/1/2/3 https://discord.com/channels/1/2/3') // link

    const expectedDB = { leaderboards: {} }
    expectedDB.leaderboards.leaderboard = {
      name: 'leaderboard',
      title: 'Leaderboard',
      type: 'post',
      scores: { u1: [{ channelID: '2', messageID: '3' }] }
    }

    await updatePostsLeaderboard(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })
})
