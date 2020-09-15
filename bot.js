// TODO: add in catchs on commands that require token information to check for if a token is lacking the field that command requires (currently only have checks for if a server is missing a token)
const { CommandoClient } = require('discord.js-commando');
const { Structures, MessageEmbed } = require('discord.js');
const path = require('path');
const fs = require('fs');
const {token} = require('./auth.js');
const {writeFile, readFile} = require('./fileManager.js');
const {readToken} = require('./commands/utils/tokenManager.js');
const {log} = require("./commands/utils/logger.js");


Structures.extend('Guild', Guild => {
  class MusicGuild extends Guild {
    constructor(client, data) {
      super(client, data);
      this.musicData = {
        queue: [],
        isPlaying: false,
        volume: 1,
        songDispatcher: null
      };
    }
  }
  return MusicGuild;
});

// Initialize Discord Bot
const client = new CommandoClient({
  commandPrefix: '!',
  owner: '355534246439419904',
  unknownCommandResponse: false
});

client.registry
  .registerDefaultTypes()
  .registerGroups([
    ['normal', 'Regular commands anyone can use'],
    ['admin', 'Moderator commands'],
    ['token', 'Server preset commands'],
    ['music', 'Music bot commands']
  ])
  .registerDefaultGroups()
  .registerDefaultCommands()
  .registerCommandsIn(path.join(__dirname, 'commands'));

const talkedRecently = new Set();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await client.user.setActivity('!help', { type: "LISTENING" });
});

client.on("guildCreate", async guild => { // does !update upon joining new server
  const exTokenContents = await readFile('./tokens/example.json');
  const exTokenData = JSON.parse(exTokenContents); // my variable names are so horrible

  let tokenData = await readToken(guild);
  const tokenDataKeys = Object.keys(tokenData);
  const exTokenDataKeys = Object.keys(exTokenData);

  const path = `./tokens/${guild.id}.json`;

  if (!fs.existsSync(path)) { // checks if there's an already existing token for that server
    writeFile(path, exTokenContents)
    console.log(`Token generated for ${guild.name}`);

  } else if (JSON.stringify(tokenDataKeys) !== JSON.stringify(exTokenDataKeys)) {
    tokenData = { ...exTokenData, ...tokenData}; // credit to Sean for this fantastically simple but amazing code
    writeFile(path, JSON.stringify(tokenData));
    console.log(`Token updated for ${guild.name}`); // maybe add in fields so that people know exactly which fields were updated? seems super complicated tho

  }
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
});

client.on('message', async message => {
  if (message.author.bot) return; // Bot ignores itself and other bots

  if (message.channel.type === 'dm') { // DM forwarding
    const dmEmbed = new MessageEmbed()
      .setColor(0x7f0000)
      .setAuthor(message.author.tag, message.author.avatarURL())
      .setDescription(`**${message.author} DMed RBot this message:**\n${message.content}`)
      .setFooter(`${new Date()}`);
    await client.users.cache.get('355534246439419904').send(dmEmbed);
    return;
  }

  if (talkedRecently.has(message.author.id)) return; // Spam prevention

  // maybe move this code elsewhere? idk
  const guild = message.guild;
  const member = guild.member(message.author);

  const tokenData = await readToken(guild);
  const prefix = tokenData.prefix || '!'; // maybe move somewhere else?

  // Handles censorship
  if (tokenData.censoredusers && tokenData.censoredusers.includes(message.author.id) && !member.hasPermission('ADMINISTRATOR')) {
    await message.delete()
      .catch(error => console.error(`message in ${guild} could not be censored because of ${error}!`));

    if (tokenData.logchannel) await log(client, guild, 0x7f0000, message.author.tag, message.author.avatarURL(), `**Message by ${message.author} censored in ${message.channel}:**\n${message.content}`)
    return;
  }

  if (message.content.substring(0, prefix.length) === prefix) {
    const args = message.content.slice(prefix.length).trim().split(/ +/g); // removes the prefix, then the spaces, then splits into array

    const command = args.shift().toLowerCase(); // removes the command from the args array
    if (tokenData.disabledcommands && tokenData.disabledcommands.includes(command)) return; //command disabling

    const snowflakes = args.filter(arg => Number(arg));

    const userTarget = message.mentions.users.first() || client.users.cache.get(snowflakes[0]) || client.users.cache.find(user => user.username === args[0]);
    const channelTarget = message.mentions.channels.first() || client.channels.cache.get(snowflakes[0]);
    const roleTarget = message.mentions.roles.first() || guild.roles.cache.get(snowflakes[0]);

    const path = `./tokens/${guild.id}.json`; // needed for existssync

    // adds user to set if they have used a command recently
    talkedRecently.add(message.author.id);
    setTimeout(() => {
      // Removes the user from the set after 1 second
      talkedRecently.delete(message.author.id);
    }, 1000);
  }
});

// Bot logs the following events:

client.on("messageDelete", async message => {
  if (message.author.bot) return; // Bot ignores itself and other bots

  const guild = message.guild;
  const tokenData = await readToken(guild);
  if (tokenData.censoredusers && tokenData.censoredusers.includes(message.author.id)) return; // prevents double logging of censored messages, probably better way of doing this
  if (!(tokenData.logchannel && tokenData.logmessagedelete)) return;

  await log(client, guild,0xb50300, message.author.tag, message.author.avatarURL(), `**Message by ${message.author} in ${message.channel} was deleted:**\n${message.content}`);
});

client.on("messageDeleteBulk", async messages => {
  const guild = messages.first().guild;
  const tokenData = await readToken(guild);
  if (!(tokenData.logchannel && tokenData.logmessagedeletebulk)) return;

  // temporary Dyno-like bulkdelete logging system, will convert into superior system later
  await log(client, guild, 0xb50300, guild.name, guild.iconURL(), `**${messages.array().length} messages were deleted in ${messages.first().channel}**`);
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return; // Bot ignores itself and other bots
  if (oldMessage.content === newMessage.content) return; // fixes weird link preview glitch

  const guild = oldMessage.guild;
  const tokenData = await readToken(guild);
  if (!(tokenData.logchannel && tokenData.logmessageedit)) return;

  await log(client, guild, 0xed7501, oldMessage.author.tag, oldMessage.author.avatarURL(), `**Message by ${oldMessage.author} in ${oldMessage.channel} was edited:** [Jump to message](${newMessage.url})`, [{name: 'Before:', value: oldMessage.content}, {name: 'After:', value: newMessage.content}]);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => { // TODO: finish this by adding role logging
  if (oldMember.user.bot) return;

  const guild = oldMember.guild;
  const tokenData = await readToken(guild);
  if (!(tokenData.logchannel && tokenData.lognicknamechange)) return; // will have to update later if I wish to use this for more things than nickname changes

  // not sure how compatible this is with new log function
  const updateEmbed = new MessageEmbed()
    .setColor(0xf6b40c)
    .setAuthor(newMember.user.tag, newMember.user.avatarURL())
    .setFooter(`${new Date()}`);

  if (oldMember.nickname !== newMember.nickname) {
    updateEmbed
      .setDescription(`**${newMember.user} changed their nickname:**`)
      .addFields(
        {name: 'Before:', value: oldMember.nickname || 'None'},
        {name: 'After:', value: newMember.nickname || 'None'}
      );
    client.channels.cache.get(tokenData.logchannel).send(updateEmbed).catch(error => console.error(`guildMemberUpdate in ${guild} could not be logged because of ${error}!`));
  }
});

client.on("guildMemberAdd", async (member) => {
  const guild = member.guild;
  const tokenData = await readToken(guild);

  if (tokenData.autoroles) {
    const autoroles = tokenData.autoroles.trim().split(' ');
    await member.edit({roles: member.roles.cache.array().concat(autoroles)});
  }
  if (!(tokenData.logchannel && tokenData.logmemberjoin)) return;

  await log(client, guild, 0x79ff3b, 'Member joined the server', member.user.avatarURL(), `${member.user} ${member.user.tag}`);
  // add potential welcome messages later
});

client.on("guildMemberRemove", async (member) => {
  const guild = member.guild;
  const tokenData = await readToken(guild);
  if (!(guild.systemChannel && tokenData.logmemberleave)) return;

  const leaveEmbed = new MessageEmbed()
    .setColor(0x333333)
    .setAuthor('Member left the server', member.user.avatarURL())
    .setDescription(`${member.user} ${member.user.tag}`)
    .setFooter(`${new Date()}`);

  guild.systemChannel.send(leaveEmbed).catch(error => console.error(`guildMemberRemove in ${guild} could not be logged because of ${error}!`));
});

// Error handling
client.on('error', console.error);

client.login(token);
