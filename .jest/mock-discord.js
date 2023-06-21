const { PermissionOverwrites, PermissionsBitField, RoleManager, PermissionFlagsBits, BaseGuildTextChannel, TextChannel, VoiceChannel, StageChannel, ForumChannel, DirectoryChannel, CategoryChannel, PartialTextBasedChannel, BaseGuildVoiceChannel, GuildMemberManager, GuildChannelManager, BaseGuild } = require("discord.js")
const { ChannelType, Client, Guild, BaseInteraction, User,
  GuildChannel, ClientUser, Role, GuildMember, GuildMemberRoleManager, PermissionOverwriteManager
} = require("discord.js")


function resolveTo (value) {
  return new Promise(resolve => resolve(value))
}


function mockClass (cls) {
  if (!cls) return
  const descriptors = Object.getOwnPropertyDescriptors(cls.prototype)
  // console.log(`\x1b[35m${cls.name}\x1b[0m`)
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (typeof descriptor.value !== 'function') continue
    if (name.startsWith('_') || name === 'constructor') continue
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

const interaction = {
  // applicationId: Snowflake;
  // channelId: Snowflake | null;
  // get createdAt(): Date;
  // get createdTimestamp(): number;
  // get guild(): CacheTypeReducer<Cached, Guild, null>;
  // guildId: CacheTypeReducer<Cached, Snowflake>;
  // id: Snowflake;
  // member: CacheTypeReducer<Cached, GuildMember, APIInteractionGuildMember>;
  // readonly token: string;
  // type: InteractionType;
  // user: User,
  // version: number;
  // appPermissions: Readonly<PermissionsBitField> | null;
  // memberPermissions: CacheTypeReducer<Cached, Readonly<PermissionsBitField>>;
  // locale: Locale;
  // guildLocale: CacheTypeReducer<Cached, Locale>;
  inGuild: jest.fn(),
  inCachedGuild: jest.fn(),
  inRawGuild: jest.fn(),
  isButton: jest.fn(),
  isAutocomplete: jest.fn(),
  isChatInputCommand: jest.fn(),
  isCommand: jest.fn(),
  isContextMenuCommand: jest.fn(),
  isMessageComponent: jest.fn(),
  isMessageContextMenuCommand: jest.fn(),
  isModalSubmit: jest.fn(),
  isUserContextMenuCommand: jest.fn(),
  isAnySelectMenu: jest.fn(),
  isStringSelectMenu: jest.fn(),
  isUserSelectMenu: jest.fn(),
  isRoleSelectMenu: jest.fn(),
  isMentionableSelectMenu: jest.fn(),
  isChannelSelectMenu: jest.fn(),
  isRepliable: jest.fn(),
  options: {
    getString: jest.fn(),
    getChannel: jest.fn(),
    getInteger: jest.fn(),
    getRole: jest.fn(),
    getBoolean: jest.fn(),
    getSubcommand: jest.fn()
  },
  // Chat Input Command Interactions
  deferReply: jest.fn(),
  deleteReply: jest.fn(),
  editReply: jest.fn(),
  fetchReply: jest.fn(),
  followUp: jest.fn(),
  reply: jest.fn(),
  showModal: jest.fn(),
  awaitModalSubmit: jest.fn()
}
function createInteraction (client, options = {}, userData = {}) {
  const user = new User(client, userData)
  const i = new BaseInteraction(client, { user, ...options, options: interaction.options })
  const result = Object.assign({}, i, interaction, options)
  return result
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
  interaction, createInteraction,
  createRole,
  createUser,
  createMember,
  resolveTo
}
