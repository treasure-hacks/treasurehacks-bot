const { ChannelType, ChannelFlagsBitField, PermissionOverwriteManager, Client, Guild, BaseInteraction, User, GuildChannel, ChatInputCommandInteraction, ClientUser
} = require("discord.js")


const channel = {
  createdAt: new Date(0),
  createdTimestamp: 0,
  id: '0',
  // flags: ChannelFlagsBitField,
  partial: false,
  type: ChannelType.GuildText,
  url: 'https://discord.com/channels/0/0',
  delete: jest.fn(),
  fetch: jest.fn(),
  isThread: jest.fn(),
  isTextBased: jest.fn(),
  isDMBased: jest.fn(),
  isVoiceBased: jest.fn(),
  toString: jest.fn(),
  // Guild Channels
  memberPermissions: jest.fn(),
  rolePermissions: jest.fn(),
  deletable: true,
  guild: null,
  guildId: '',
  manageable: true,
  members: [],
  name: '',
  parent: null,
  parentId: null,
  // permissionOverwrites: PermissionOverwriteManager,
  permissionsLocked: jest.fn(),
  position: 0,
  rawPosition: 0,
  viewable: true,
  clone: jest.fn(),
  delete: jest.fn(),
  edit: jest.fn(),
  equals: jest.fn(),
  lockPermissions: jest.fn(),
  permissionsFor: jest.fn(),
  permissionsFor: jest.fn(),
  setName: jest.fn(),
  setParent: jest.fn(),
  setPosition: jest.fn(),
  isTextBased: jest.fn(),
  toString: jest.fn()
}

/**
 * Creates a mock channel
 * @param {Guild} guild The guild the channel belongs to
 * @param {{id: string, name: string, type: number, [key: string]: any}} options The channel properties
 */
function createChannel (guild, options = {}, client) {
  const id = options.id || Date.now().toString()
  const config = Object.assign({}, channel, options, { id })
  const result = new GuildChannel(guild, config, client)
  return result
}

const client = {
  // application: ClientApplication,
  // channels: ChannelManager,
  // emojis: BaseGuildEmojiManager,
  // guilds: GuildManager,
  // options: { intents: IntentsBitField },
  // readyAt: new Date(),
  // readyTimestamp: Date.now(),
  // sweepers: Sweepers,
  // shard: null,
  // token: '',
  // uptime: 0,
  // user: ClientUser,
  // users: UserManager,
  // voice: ClientVoiceManager,
  // ws: WebSocketManager,
  destroy: jest.fn(),
  fetchGuildPreview: jest.fn(),
  fetchInvite: jest.fn(),
  fetchGuildTemplate: jest.fn(),
  fetchVoiceRegions: jest.fn(),
  fetchSticker: jest.fn(),
  fetchPremiumStickerPacks: jest.fn(),
  fetchWebhook: jest.fn(),
  fetchGuildWidget: jest.fn(),
  generateInvite: jest.fn(),
  login: jest.fn(),
  isReady: jest.fn(),
  toJSON: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
}
const clientUser = {
  edit: jest.fn(),
  setActivity: jest.fn(),
  setActivity: jest.fn(),
  setAFK: jest.fn(),
  setAvatar: jest.fn(),
  setPresence: jest.fn(),
  setStatus: jest.fn(),
  setUsername: jest.fn()
}
function createClient (options = {}, intents = []) {
  const result = new Client({ ...options, intents })
  result.user = new ClientUser(result, {})
  Object.assign(result.user, clientUser)
  Object.assign(result, client, options)
  return result
}

const guild = {
  // afkTimeout: number | null,
  // autoModerationRules: AutoModerationRuleManager,
  // bans: GuildBanManager,
  // channels: GuildChannelManager,
  // commands: GuildApplicationCommandManager,
  // defaultMessageNotifications: GuildDefaultMessageNotifications,
  // discoverySplash: string | null,
  // emojis: GuildEmojiManager,
  // explicitContentFilter: GuildExplicitContentFilter,
  // invites: GuildInviteManager,
  // joinedTimestamp: number,
  // large: boolean,
  // maximumMembers: number | null,
  // maximumPresences: number | null,
  // maxStageVideoChannelUsers: number | null,
  // memberCount: number,
  // members: GuildMemberManager,
  // mfaLevel: GuildMFALevel,
  // ownerId: Snowflake,
  // preferredLocale: Locale,
  // premiumProgressBarEnabled: boolean,
  // premiumTier: GuildPremiumTier,
  // presences: PresenceManager,
  // publicUpdatesChannelId: Snowflake | null,
  // roles: RoleManager,
  // rulesChannelId: Snowflake | null,
  // scheduledEvents: GuildScheduledEventManager,
  // stageInstances: StageInstanceManager,
  // stickers: GuildStickerManager,
  // systemChannelFlags: Readonly<SystemChannelFlagsBitField>,
  // systemChannelId: Snowflake | null,
  // vanityURLUses: number | null,
  // voiceStates: VoiceStateManager,
  // widgetChannelId: Snowflake | null,
  // widgetEnabled: boolean | null,
  createTemplate: jest.fn(),
  delete: jest.fn(),
  discoverySplashURL: jest.fn(),
  edit: jest.fn(),
  editWelcomeScreen: jest.fn(),
  equals: jest.fn(),
  fetch: jest.fn(),
  fetchAuditLogs: jest.fn(),
  fetchIntegrations: jest.fn(),
  fetchOwner: jest.fn(),
  fetchPreview: jest.fn(),
  fetchTemplates: jest.fn(),
  fetchVanityData: jest.fn(),
  fetchWebhooks: jest.fn(),
  fetchWelcomeScreen: jest.fn(),
  fetchWidget: jest.fn(),
  fetchWidgetSettings: jest.fn(),
  leave: jest.fn(),
  disableInvites: jest.fn(),
  setAFKChannel: jest.fn(),
  setAFKTimeout: jest.fn(),
  setBanner: jest.fn(),
  setDefaultMessageNotifications: jest.fn(),
  setDiscoverySplash: jest.fn(),
  setExplicitContentFilter: jest.fn(),
  setIcon: jest.fn(),
  setName: jest.fn(),
  setOwner: jest.fn(),
  setPreferredLocale: jest.fn(),
  setPublicUpdatesChannel: jest.fn(),
  setRulesChannel: jest.fn(),
  setSplash: jest.fn(),
  setSystemChannel: jest.fn(),
  setSystemChannelFlags: jest.fn(),
  setVerificationLevel: jest.fn(),
  setPremiumProgressBarEnabled: jest.fn(),
  setWidgetSettings: jest.fn(),
  setMFALevel: jest.fn(),
  toJSON: jest.fn(),
}
function createGuild(client, options = {}) {
  const result = new Guild(client, { makeCache: jest.fn() })
  Object.assign(result, guild, options)
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

module.exports = {
  channel, createChannel,
  client, createClient,
  guild, createGuild,
  interaction, createInteraction
}
