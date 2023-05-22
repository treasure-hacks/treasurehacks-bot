const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { clearCategory, syncCategory } = require('../../../src/commands/chat-input/category')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })
const category = discordMock.createChannel(guild, { id: '1', type: ChannelType.GuildCategory, name: 'cat' })
const channels = [
  discordMock.createChannel(guild, { id: '2', parentId: '1', name: 'test-channel' }, client),
  discordMock.createChannel(guild, { id: '3', parentId: '1', name: 'test-channel' }, client),
  discordMock.createChannel(guild, { id: '4', parentId: '1', name: 'test-channel' }, client),
  discordMock.createChannel(guild, { id: '5', parentId: '1', name: 'test-channel' }, client),
  discordMock.createChannel(guild, { id: '6', parentId: 'g1', name: 'dont-delete' }, client),
  discordMock.createChannel(guild, { id: '7', parentId: 'g1', name: 'dont-delete' }, client)
]
guild.channels.cache.set(category.id, category)
channels.forEach(c => guild.channels.cache.set(c.id, c))
discordMock.interaction.options.getChannel.mockReturnValue(category)

describe('Category Clear Command', () => {
  beforeEach(() => {
    discordMock.channel.delete.mockClear()
  })

  it('Replies with an embed of channel IDs that it will delete', () => {
    const expectedReply = {
      embeds: [{
        title: 'Clearing Category',
        description: 'Deleting the following categories:\n<#2>\n<#3>\n<#4>\n<#5>'
      }],
      ephemeral: true
    }
    const interaction = discordMock.createInteraction(client, { guild })
    clearCategory(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Calls delete once for each channel it is deleting and no more', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    clearCategory(interaction, client)
    expect(discordMock.channel.delete).toBeCalledTimes(4) // 2, 3, 4, 5
  })

  it('Calls delete for every channel, plus one for category if specified', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    discordMock.interaction.options.getBoolean.mockReturnValueOnce(true)
    clearCategory(interaction, client)
    expect(discordMock.channel.delete).toBeCalledTimes(5) // 2, 3, 4, 5, 1
  })
})

describe('Category Sync Command', () => {
  beforeEach(() => {
    discordMock.channel.lockPermissions.mockClear()
  })

  it('Replies with an embed of channels that it will sync', () => {
    const expectedReply = {
      embeds: [{
        title: 'Synced Category',
        description: 'The following channels should now have the same permissions ' +
          'as `cat`:\n<#2>, <#3>, <#4>, <#5>',
        color: 0x00ffaa
      }],
      ephemeral: true
    }
    const interaction = discordMock.createInteraction(client, { guild })
    syncCategory(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Calls lockPermissions once for every channel in the category', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    syncCategory(interaction, client)
    expect(discordMock.channel.lockPermissions).toBeCalledTimes(4) // 2, 3, 4, 5
  })
})
