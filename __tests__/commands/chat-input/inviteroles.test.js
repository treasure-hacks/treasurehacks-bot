const { PermissionFlagsBits } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
jest.spyOn(Date, 'now').mockImplementation(() => 1234)
// Command Imports must come after mocks
const { addInviteRule, listInviteRoles, removeInviteRule } = require('../../../src/commands/chat-input/inviteroles')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: '0' })
client.guilds.cache.set(guild.id, guild)

const channel = discordMock.createChannel(client, guild, { id: '1', guild, name: 'main' })
client.channels.cache.set(channel.id, channel)
guild.channels.cache.set(channel.id, channel)
guild.invites.fetch.mockImplementation(async () => guild.invites.cache)

const invite = discordMock.createInvite(client, { channel, guild, code: 'INV', id: '11' }, guild)
guild.invites.cache.set(invite.id, invite)

detaMock.Base.get.mockReturnValue({ inviteRoles: [] })

const permissions = PermissionFlagsBits.ViewChannel
const role = discordMock.createRole(client, { name: 'ten', id: '10', permissions }, guild)
const badRole = discordMock.createRole(client, { name: 'twelvebot', id: '12', permissions, managed: true }, guild)
guild.roles.cache.set(role.id, role)
guild.roles.cache.set(badRole.id, badRole)

/** @todo check that an invite actually gets created */
describe('Inviteroles add command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    this.interaction.options.getString.mockImplementation(opt => this.options[opt])
    this.interaction.options.getBoolean.mockReturnValue(true) // enabled
    guild.invites.create.mockImplementation(async (channel, opts) => {
      const invite = discordMock.createInvite(client, { ...opts, channel, code: 'newInv', id: '12' }, guild)
      guild.invites.cache.set(invite.id, invite)
      return invite
    })
  })

  beforeEach(() => {
    this.options = {
      name: 'tens',
      rename: 'ten-people',
      description: 'Gives someone the role with ID 10',
      invites: invite.code
    }
    this.interaction.reply.mockClear()
  })

  it('Replies with an error if the rule name is invalid', async () => {
    this.options.name = 'invalid name because there are spaces'

    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with an error if roles are not formatted correctly', async () => {
    // this is different from the role not existing
    this.options['add-roles'] = '<BAD_FORMAT>'
    const expectedAddReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedAddReply)

    delete this.options['add-roles']
    this.options['remove-roles'] = '<BAD_FORMAT>'
    const expectedRemoveReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedRemoveReply)
  })

  it('Replies with an error if you try to assign managed roles', async () => {
    this.options['add-roles'] = '<@&12>'
    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Invalid roles: you cannot assign @everyone or managed roles.'
      }],
      ephemeral: true
    }
    badRole.toJSON.mockReset()
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with an error if the rule already exists', async () => {
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [{ name: 'tens' }] })
    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Error while creating rule `tens`',
        description: 'Rule already exists'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with a message that the rule was created (and appropriate warnings)', async () => {
    this.options['add-roles'] = '<@&111>'
    const expectedReply = {
      embeds: [
        {
          color: 15775744,
          description: 'Could not find the following channels or roles: <@&111>',
          title: 'Warnings'
        },
        {
          title: 'Created `tens`',
          color: undefined,
          description: 'Gives someone the role with ID 10\n\n' +
            'Applies to invites: INV' +
            '\nPeople invited will have these roles: ' +
            '\nPeople invited will lose these roles: ',
          footer: { text: 'Created just now • Updated just now • 0 uses' }
        }
      ],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Adds the new invite role assignment rule to the database', async () => {
    const expectedConfig = {
      name: 'tens',
      description: 'Gives someone the role with ID 10',
      invites: ['INV'],
      rolesToAdd: [],
      rolesToRemove: [],
      occurrences: 0,
      enabled: true,
      created_at: 1234,
      updated_at: 1234
    }
    await addInviteRule(this.interaction, client, false)
    expect(detaMock.Base.put).toBeCalledWith({ inviteRoles: [expectedConfig] })
  })
})

describe('Inviteroles details command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    this.interaction.options.getString.mockImplementation(opt => this.options[opt])
    this.interaction.options.getBoolean.mockReturnValue(true) // enabled
  })

  beforeEach(() => {
    this.options = { name: 'tens' }
    this.interaction.reply.mockClear()
  })

  it('Replies with errors when there are no matches', async () => {
    this.options.name = 'nonexistent'
    const expectedNoMatchReply = {
      embeds: [{
        title: 'Command Failed: No Matching Rule',
        description: 'There was no invite role assignment rule with the name that was provided'
      }],
      ephemeral: false
    }
    await listInviteRoles(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedNoMatchReply)
    this.interaction.reply.mockClear()

    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [] })
    delete this.options.name
    const expectedNoRulesReply = {
      content: 'Details of all role assignments:',
      embeds: [{
        title: 'Command Failed: No Invite Role Assignments',
        description: 'Your server does not have any invite role assignment rules associated with it.\nTry adding one with the `/inviteroles add` command!'
      }],
      ephemeral: false
    }
    await listInviteRoles(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedNoRulesReply)
  })

  it('Replies with all invite role assignment rules if no name is specified', async () => {
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [] })
    this.options = {
      name: 'tens',
      rename: 'ten-people',
      description: 'Gives someone the role with ID 10',
      invites: invite.code
    }
    await addInviteRule(this.interaction, client, false)

    this.options = { name: 'tens' }
    const expectedReply = {
      embeds: [{
        title: 'Invite Role Assignment: tens',
        color: undefined,
        description: 'Gives someone the role with ID 10\n\n' +
          'Applies to invites: INV' +
          '\nPeople invited will have these roles: ' +
          '\nPeople invited will lose these roles: ',
        footer: {
          text: 'Created just now • Updated just now • 0 uses'
        }
      }],
      ephemeral: false
    }
    badRole.toJSON.mockReset()
    await listInviteRoles(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })
})

describe('Inviteroles delete command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    this.interaction.options.getString.mockReturnValue('tens')
    this.interaction.options.getBoolean.mockReturnValue(true) // enabled
    this.rule = {
      name: 'tens',
      occurrences: 0,
      invites: ['INV'],
      rolesToAdd: [],
      rolesToRemove: ['99'],
      created_at: 1234
    }
  })

  beforeEach(() => {
    this.interaction.reply.mockClear()
  })

  it('Replies with an error if that invite role assignment does not exist', async () => {
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [] })
    const expectedNoMatchReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Unable to delete tens',
        description: 'This invite role assignment rule does not exist'
      }],
      ephemeral: true
    }
    await removeInviteRule(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedNoMatchReply)
    this.interaction.reply.mockClear()
  })

  it('Replies with the rule that was deleted', async () => {
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [this.rule] })
    const expectedNoMatchReply = {
      embeds: [{
        title: 'Deleted `tens`',
        description:
          'Applies to invites: INV' +
          '\nPeople invited will have these roles: ' +
          '\nPeople invited will lose these roles: <@&99>',
        footer: { text: 'Created just now • Deleted just now • 0 uses' }
      }],
      ephemeral: true
    }
    await removeInviteRule(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedNoMatchReply)
  })

  it('Removees the role assigment rule from the database', async () => {
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [this.rule] })
    await removeInviteRule(this.interaction, client)
    expect(detaMock.Base.put).toBeCalledWith({ inviteRoles: [] })
  })
})

describe('Inviteroles update command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { guild, channel })
    this.interaction.options.getString.mockImplementation(opt => this.options[opt])
    this.interaction.options.getBoolean.mockReturnValue(true) // enabled
    guild.invites.create.mockImplementation(async (channel, opts) => {
      const invite = discordMock.createInvite(client, { ...opts, channel, code: 'newInv', id: '12' }, guild)
      guild.invites.cache.set(invite.id, invite)
      return invite
    })
    this.rule = {
      name: 'tens',
      occurrences: 0,
      invites: ['INV'],
      rolesToAdd: [],
      rolesToRemove: ['99'],
      created_at: 1234
    }
  })

  beforeEach(() => {
    this.options = {
      name: 'tens',
      rename: 'ten-people',
      description: 'Gives someone the role with ID 10',
      invites: invite.code
    }
    this.interaction.reply.mockClear()
    detaMock.Base.put.mockClear()
  })

  it('Replies with an error if the rule name is invalid', async () => {
    this.options.name = 'invalid name because there are spaces'

    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with an error if roles are not formatted correctly', async () => {
    // this is different from the role not existing
    this.options['add-roles'] = '<BAD_FORMAT>'
    const expectedAddReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedAddReply)

    delete this.options['add-roles']
    this.options['remove-roles'] = '<BAD_FORMAT>'
    const expectedRemoveReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedRemoveReply)
  })

  it('Replies with an error if you try to assign managed roles', async () => {
    this.options['add-roles'] = '<@&12>'
    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Invalid roles: you cannot assign @everyone or managed roles.'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with an error if the rule does not exist', async () => {
    this.options.name = 'nonexistent'
    const expectedReply = {
      embeds: [{
        color: 0xff0000,
        title: 'Error while updating rule `nonexistent`',
        description: 'Rule does not exist'
      }],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with a message that the rule was updated (and appropriate warnings)', async () => {
    this.options['add-roles'] = '<@&111>'
    const expectedReply = {
      embeds: [
        {
          color: 15775744,
          description: 'Could not find the following channels or roles: <@&111>',
          title: 'Warnings'
        },
        {
          title: 'Updated `ten-people` (renamed from tens)',
          color: undefined,
          description: 'Gives someone the role with ID 10\n\n' +
            'Applies to invites: INV' +
            '\nPeople invited will have these roles: ' +
            '\nPeople invited will lose these roles: ',
          footer: { text: 'Created just now • Updated just now • 0 uses' }
        }
      ],
      ephemeral: true
    }
    await addInviteRule(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the invite role assignment rule in the database', async () => {
    this.options['remove-roles'] = 'None'
    detaMock.Base.get.mockReturnValueOnce({ inviteRoles: [this.rule] })
    const expectedConfig = {
      name: 'ten-people',
      invites: ['INV'],
      rolesToAdd: [],
      rolesToRemove: [],
      occurrences: 0,
      enabled: true,
      created_at: 1234,
      updated_at: 1234
    }
    this.interaction.reply.mockImplementation(x => console.log(x))
    await addInviteRule(this.interaction, client, true)
    expect(detaMock.Base.put).toBeCalledWith({ inviteRoles: [expectedConfig] })
  })
})
