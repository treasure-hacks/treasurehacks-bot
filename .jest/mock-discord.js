const { PermissionOverwrites, PermissionsBitField, RoleManager, PermissionFlagsBits, BaseGuildTextChannel, TextChannel, VoiceChannel, StageChannel, ForumChannel, DirectoryChannel, CategoryChannel, PartialTextBasedChannel, BaseGuildVoiceChannel, GuildMemberManager, GuildChannelManager, BaseGuild, InteractionType, CommandInteraction, ModalSubmitInteraction, MessageComponentInteraction, ChatInputCommandInteraction, ApplicationCommandType, UserContextMenuCommandInteraction, MessageContextMenuCommandInteraction, Message, CommandInteractionOptionResolver } = require("discord.js")
const { ChannelType, Client, Guild, BaseInteraction, User,
  GuildChannel, ClientUser, Role, GuildMember, GuildMemberRoleManager, PermissionOverwriteManager
} = require("discord.js")
const InteractionResponses = require("discord.js/src/structures/interfaces/InteractionResponses")


function resolveTo (value) {
  return new Promise(resolve => resolve(value))
}


function mockClass (cls) {
  if (!cls) return
  const descriptors = Object.getOwnPropertyDescriptors(cls.prototype)
  // console.log(`\x1b[35m${cls.name}\x1b[0m`)
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (typeof descriptor.value !== 'function') continue
    if (name.match(/^_|^transform|^constructor$/)) continue
    // console.log(`  ${name}:`, descriptor.value)
    jest.spyOn(cls.prototype, name)
    cls.prototype[name].mockImplementation(() => {})
  }
}
mockClass(PermissionOverwriteManager)
mockClass(PermissionOverwrites)
mockClass(GuildChannel)
mockClass(BaseGuildTextChannel)
mockClass(BaseGuildVoiceChannel)

const channelType = {
  [ChannelType.GuildAnnouncement]: TextChannel,
  [ChannelType.GuildCategory]: CategoryChannel,
  [ChannelType.GuildDirectory]: DirectoryChannel,
  [ChannelType.GuildForum]: ForumChannel,
  [ChannelType.GuildStageVoice]: StageChannel,
  [ChannelType.GuildText]: TextChannel,
  [ChannelType.GuildVoice]: VoiceChannel
}
Object.values(channelType).forEach(v => mockClass(v))

/**
 * Creates a mock channel
 * @param {Guild} guild The guild the channel belongs to
 * @param {{id: string, name: string, type: number, [key: string]: any}} options The channel properties
 */
function createChannel (guild, options = {}, client) {
  const id = options.id || Date.now().toString()
  const config = Object.assign({}, options, { id })
  const Channel = channelType[options.type] || TextChannel
  const result = new Channel(guild, config, client)
  Object.assign(result, config)
  return result
}
function createPermissionOverwrites(client, channel, options = {}) {
  options.allow ??= 0
  options.deny ??= 0
  const result = new PermissionOverwrites(client, options, channel)
  return result
}

mockClass(Client)
mockClass(ClientUser)
function createClient (options = {}, intents = []) {
  const result = new Client({ ...options, intents })
  result.user = new ClientUser(result, {})
  return result
}

mockClass(BaseGuild)
mockClass(Guild)
mockClass(GuildMemberManager)
mockClass(GuildChannelManager)
mockClass(RoleManager)

function createGuild(client, options = {}) {
  const result = new Guild(client, { makeCache: jest.fn(), ...options })
  const ev = options.everyoneRole || {}
  const permissions = new PermissionsBitField(PermissionFlagsBits.ViewChannel)
  const everyoneRole = createRole(client, { id: result.id, name: '@everyone', permissions, ...ev }, result)
  result.roles.cache.set(everyoneRole.id, everyoneRole)
  return result
}

const interactionType = {
  [InteractionType.ApplicationCommand]: CommandInteraction,
  [InteractionType.MessageComponent]: MessageComponentInteraction,
  [InteractionType.ModalSubmit]: ModalSubmitInteraction
}

mockClass(CommandInteraction)
mockClass(InteractionResponses)
mockClass(ChatInputCommandInteraction)
mockClass(UserContextMenuCommandInteraction)
mockClass(MessageContextMenuCommandInteraction)
mockClass(MessageComponentInteraction)
mockClass(ModalSubmitInteraction)
mockClass(CommandInteractionOptionResolver)

function createInteraction (client, options = {}, userData = {}) {
  const type = options.type || InteractionType.ApplicationCommand
  const cmdType = options.commandType || ApplicationCommandType.ChatInput
  
  const user = new User(client, userData)
  const Class = interactionType[type]
  const interactionData = { user, data: { ...options }, type, ...options }
  if (type === InteractionType.ApplicationCommand) interactionData.data.type = cmdType
  let i = new Class(client, interactionData, options.guild, options.guild?.id || options.guildId)

  if (i.isCommand()) {
    if (i.isChatInputCommand()) i = new ChatInputCommandInteraction(client, interactionData)
    else if (i.isUserContextMenuCommand()) i = new UserContextMenuCommandInteraction(client, interactionData)
    else if (i.isMessageContextMenuCommand()) i = new MessageContextMenuCommandInteraction(client, interactionData)
    i.guildId = options.guild?.id || options.guildId
    i.channelId = options.channel?.id || options.channelId
  } else {
    console.log('is not a command', type, i.isCommand())
  }

  return i
}

mockClass(Role)
Role.prototype.toString.mockReset() // use original implementation

function createRole (client, options = {}, guild) {
  const result = new Role(client, options, guild)
  return result
}

mockClass(User)
User.prototype.toString.mockReset()

function createUser (client, options = {}) {
  const result = new User(client, options)
  return result
}

mockClass(GuildMember)
mockClass(GuildMemberRoleManager)

GuildMember.prototype.toString.mockReset()

function createMember (client, options = {}, guild) {
  const result = new GuildMember(client, options, guild)
  result.roles = new GuildMemberRoleManager(result)
  return result
}

module.exports = {
  createChannel,
  createPermissionOverwrites,
  createClient,
  createGuild,
  createInteraction,
  createRole,
  createUser,
  createMember,
  resolveTo
}
