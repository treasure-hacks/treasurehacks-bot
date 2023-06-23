const { ChannelType, ApplicationCommandOptionType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { setLog, setAlerts, getFeatureConfig, updateFeatureConfig } = require('../../../src/commands/chat-input/config')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })
client.guilds.cache.set(guild.id, guild)
const category = discordMock.createChannel(client, guild, { id: '1', type: ChannelType.GuildCategory, name: 'category' })
const channel = discordMock.createChannel(client, guild, { id: '2', guild, name: 'main' })
guild.channels.cache.set(category.id, category)
guild.channels.cache.set(channel.id, channel)
detaMock.Base.get.mockReturnValue({}) // make it completely empty

describe('Config Set Log Channel Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild })
    this.interaction.options.getChannel.mockReturnValue(channel)
  })

  beforeEach(() => {
    this.interaction.options.getChannel.mockClear()
  })

  it('Replies with an error if the specified channel cannot be found', async () => {
    this.interaction.options.getChannel.mockReturnValueOnce({ id: null })
    const expectedEmbed = {
      title: 'Error in configuration',
      description: 'Unable to find that channel',
      color: 0xff0000
    }
    await setLog(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      embeds: [expectedEmbed], ephemeral: true
    })
  })

  it('Removes the log channel if no channel is specified', async () => {
    this.interaction.options.getChannel.mockReturnValueOnce(undefined)
    const expectedEmbed = {
      title: 'Success',
      description: 'Successfully removed the log channel',
      color: 0x00ff00
    }
    await setLog(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({ embeds: [expectedEmbed] })
    expect(detaMock.Base.put).toBeCalledWith({ logChannel: null })
  })

  it('Sets the log channel if a valid channel is specified', async () => {
    detaMock.Base.get.mockReturnValue({ inviteLogChannel: 'blah' }) // make sure it gets rid of this
    const expectedEmbed = {
      title: 'Success',
      description: 'Set the log channel to <#2>',
      color: 0x00ff00
    }
    await setLog(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({ embeds: [expectedEmbed], ephemeral: false })
    expect(detaMock.Base.put).toBeCalledWith({ logChannel: '2' })
  })
})

describe('Config Set Alerts Channel Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild })
    this.interaction.options.getChannel.mockReturnValue(channel)
  })

  beforeEach(() => {
    this.interaction.options.getChannel.mockClear()
  })

  it('Replies with an error if the specified channel cannot be found', async () => {
    this.interaction.options.getChannel.mockReturnValueOnce({ id: null })
    const expectedEmbed = {
      title: 'Error in configuration',
      description: 'Unable to find that channel',
      color: 0xff0000
    }
    await setAlerts(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      embeds: [expectedEmbed], ephemeral: true
    })
  })

  it('Replies with the current alerts channel when no channel is provided', async () => {
    this.interaction.options.getChannel.mockReturnValueOnce(undefined)
    const expectedNoSetup = {
      title: 'Config',
      description: 'You have not set up an alerts channel yet',
      color: 0x0088ff
    }
    await setAlerts(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({ embeds: [expectedNoSetup] })
    expect(detaMock.Base.put).toBeCalledWith({ logChannel: null })

    detaMock.Base.get.mockReturnValue({ alertsChannel: 'alerts' })
    this.interaction.options.getChannel.mockReturnValueOnce(undefined)
    const expectedEmbed = {
      title: 'Config',
      description: 'The alerts channel is currently set to <#alerts>',
      color: 0x0088ff
    }
    await setAlerts(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({ embeds: [expectedEmbed] })
    expect(detaMock.Base.put).toBeCalledWith({ logChannel: null })
  })

  it('Sets the alerts channel if a valid channel is specified', async () => {
    const expectedEmbed = {
      title: 'Success',
      description: 'Set the alerts channel to <#2>',
      color: 0x00ff00
    }
    await setAlerts(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({ embeds: [expectedEmbed], ephemeral: false })
    expect(detaMock.Base.put).toBeCalledWith({ alertsChannel: '2' })
  })
})

describe('Get Feature Config', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild })
  })

  it('Returns the correct reply object associated with a key', async () => {
    this.interaction.options.getSubcommand.mockReturnValueOnce('cool-feature')
    detaMock.Base.get.mockReturnValueOnce({
      coolFeature: { enabled: true },
      'cool-feature': { enabled: false } // it should not pick this one
    })
    const ftConfig = await getFeatureConfig(this.interaction, client)

    expect(ftConfig).toEqual({
      embeds: [{
        title: 'Config',
        description: 'cool-feature is currently enabled',
        fields: [{ name: 'enabled', value: 'true', inline: true }],
        color: 0x0088ff
      }]
    })
  })

  it('Returns a reply object containing proper mentions and values', async () => {
    this.interaction.options.getSubcommand.mockReturnValueOnce('feature')
    detaMock.Base.get.mockReturnValueOnce({
      feature: { enabled: true, channel: 'channel', category: 'cat', foo: 'bar' }
    })
    const ftConfig = await getFeatureConfig(this.interaction, client)

    expect(ftConfig).toEqual({
      embeds: [{
        title: 'Config',
        description: 'feature is currently enabled',
        fields: [
          { name: 'enabled', value: 'true', inline: true },
          { name: 'channel', value: '<#channel>', inline: true },
          { name: 'category', value: '<#cat>', inline: true },
          { name: 'foo', value: 'bar', inline: true }
        ],
        color: 0x0088ff
      }]
    })
  })
})

describe('Update Feature Config', () => {
  beforeAll(() => {
    this.command = { name: 'feature', type: 1, options: [] }
    Object.defineProperty(this, 'interaction', {
      get: () => discordMock.createInteraction(client, { guild, options: [this.command], resolved: [this.command] })
    })
    this.interaction.options.getSubcommand.mockReturnValue('feature')
    detaMock.Base.get.mockReturnValue({
      feature: { enabled: true, channel: 'channel', category: 'cat', foo: 'bar' }
    })
  })
  beforeEach(() => {
    detaMock.Base.get.mockClear()
    detaMock.Base.put.mockReset()
  })

  afterAll(() => {
    detaMock.Base.get.mockReset()
    this.interaction.options.getSubcommand.mockClear()
  })
  afterEach(() => {
    this.interaction.reply.mockClear()
  })

  it('Replies with the current config if no options are specified', async () => {
    this.command.options = []
    await updateFeatureConfig(this.interaction, client)
    const expected = await getFeatureConfig(this.interaction)
    expect(this.interaction.reply).toBeCalledWith(expected)

    // { name: 'enabled', type: 5, value: true }
  })

  it('Does not update the database if no options are changed', async () => {
    this.command.options = []
    await updateFeatureConfig(this.interaction, client)
    expect(detaMock.Base.put).not.toBeCalled()
  })

  it('Replies with the updated config if something changes', async () => {
    this.command.options = [
      { name: 'enabled', type: ApplicationCommandOptionType.Boolean, value: false },
      { name: 'foo', type: ApplicationCommandOptionType.String, value: 'baz' }
    ]
    const expectedReply = {
      embeds: [{
        title: 'Updated feature config',
        description: 'feature is currently disabled',
        fields: [
          { name: 'enabled', value: 'false', inline: true },
          { name: 'channel', value: '<#channel>', inline: true },
          { name: 'category', value: '<#cat>', inline: true },
          { name: 'foo', value: 'baz', inline: true }
        ],
        color: 0x0088ff
      }]
    }
    await updateFeatureConfig(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the database if something changes', async () => {
    this.command.options = [
      { name: 'channel', type: ApplicationCommandOptionType.Channel, value: 'ch2' }
    ]
    const expectedConfig = {
      feature: { enabled: false, channel: 'ch2', category: 'cat', foo: 'baz' }
    }
    await updateFeatureConfig(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith(expectedConfig)
  })
})
