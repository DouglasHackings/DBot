// TODO: code cleanup
const Discord = require('discord.js');
const fs = require('fs');
const auth = require('./auth.json');
const fm = require('./fileManager.js');
//const parser = require('./toolkit/parser.js');
const client = new Discord.Client();

// Initialize Discord Bot
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity('!help'); // sets status
});

client.on("guildCreate", guild => {
  const path = `./tokens/${guild.id}.json`;
  if (!fs.existsSync(path)) { // checks if there's an already existing token for that server
    fm.writeFile(path, '{"logchannel": "", "censoredusers": ""}');
  }
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
});

client.on('message', async message => {
  if (message.author.bot) return; // Bot ignores itself and other bots

  // maybe move this code elsewhere? idk
  const guild = message.guild;
  const member = guild.member(message.author); // creates a GuildMember of the message's author, needed for the admin only commands

  // code block reads token and then gets log channel + censored users
  let tokenData = {}; // probably better way to do this
  const path = `./tokens/${guild.id}.json`;
  if (fs.existsSync(path)) { // checks if the token exists
    tokenData = await fm.readFile(`./tokens/${guild.id}.json`);
    tokenData = JSON.parse(tokenData);
  }
  const logChannel = tokenData.logchannel || false;
  const censoredUsers = tokenData.censoredusers || false;

  if (censoredUsers && censoredUsers.includes(message.author.id)) {
    const censoredEmbed = new Discord.MessageEmbed()
      .setColor(0x333333)
      .setAuthor(`\u200b${message.author.tag}`, message.author.avatarURL())
      .addField(`Message by ${message.author.tag} censored in ${message.channel.name}:`, `\u200b${message.content}`)
      .setFooter(`${new Date()}`);
    if (logChannel) {
      client.channels.cache.get(logChannel).send(censoredEmbed);
    }
    await message.delete()
      .catch(error => message.reply(`That message could not be censored because of ${error}!`));
  }

  // Bot listens to messages with the prefix !
  if (message.content.substring(0, 1) == '!') {
    const args = message.content.slice(1).trim().split(/ +/g); // removes the prefix, then the spaces, then splits into array
    const command = args.shift().toLowerCase(); // removes the command from the args array

    // Commands
    switch (command) {
      case 'ping':
        let m = await message.channel.send("Ping?");
        m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms`);
        break;

      case 'say':
        if (args.length > 0) {
          let msg = args.join(" ");
          message.channel.send(msg);
        } else {
          message.channel.send('You must specify what to say!');
        }
        break;

      case 'avatar':
        const user = message.mentions.users.first() || message.author;
        const avatarEmbed = new Discord.MessageEmbed()
          .setColor(0x333333)
          .setTitle(user.username)
          .setImage(user.avatarURL())
          .setFooter(`Requested by ${message.author.tag}`);
        message.channel.send(avatarEmbed);
        break;

      case 'help': // https://discordjs.guide/popular-topics/embeds.html#using-the-richembedmessageembed-constructor
        const helpEmbed = new Discord.MessageEmbed()
          .setColor(0x333333)
          .setTitle('Dashboard')
          .setDescription('My commands are:')
          .addFields(
            {name: '!ping:', value: 'Gets latency'},
            {name: '!say [message]:', value: 'Makes bot say what you tell it to say'},
            {name: '!avatar @[user]:', value: 'Gets the discord avatar of the mentioned user, defaults to get your avatar when no user is mentioned'},
            {name: '!censored:', value: 'Shows which users are currently censored'},
            {name: '!update:', value: 'Updates the server\'s token'},
            {name: '!set #[channel]:', value: 'Sets which channel RBot logs in'},
            {name: '!purge [2-100]:', value: 'Bulk deletes the specified number of messages in the channel the command is called in'},
            {name: '!kick @[user] [reason]:', value: 'Kicks the specified user from the server'},
            {name: '!ban @[user] [reason]:', value: 'Bans the specified user from the server'},
            {name: '!censor @[user]:', value: 'Censors the specified user (autodeletes their messages and logs it in the log channel)'},
            {name: '!uncensor @[user]:', value: 'Uncensors the specified user'}
            {name: '!makeaemote [link/file] [name]:', value: 'adds a emote with a given link or file, with a given name'}
          )
          .setFooter(`Requested by ${message.author.tag}`);
        message.channel.send(helpEmbed);
        break;

      case 'update': // TODO: make this actually update token, not just create one if the server was missing one (maybe check against an example token?)
        if (!fs.existsSync(path)) { // checks if there's an already existing token for that server
          fm.writeFile(path, '{"logchannel": "", "censoredusers": ""}');
        }
        message.channel.send('Token updated!');
        break;

      case 'set':
        if (!member.hasPermission('MANAGE_MESSAGES')) { // restricts this command to mods only, maybe require a different perm for this command?
          return message.reply('You do not have sufficient perms to do that!');
        }
        if (!fs.existsSync(path)) {
          return message.reply('This server does not have a valid token yet! Try doing !update!');
        }

        let channel = message.mentions.channels.first();
        if (!channel) {
          return message.reply("Please mention a valid channel in this server");
        }
        tokenData.logchannel = channel.id;
        await fm.writeFile(path, JSON.stringify(tokenData));
        message.channel.send(`Success! Log channel has been updated to ${channel.name}!`);
        break;

      case 'censor':
        if (!member.hasPermission('MANAGE_MESSAGES')) { // restricts this command to mods only, maybe add extra required perms?
          return message.reply('You do not have sufficient perms to do that!');
        }
        if (!fs.existsSync(path)) {
          return message.reply('This server does not have a valid token yet! Try doing !update!');
        }

        let censorTarget = message.mentions.members.first();
        if (!censorTarget) {
          return message.reply("Please mention a valid member of this server");
        }
        if (censorTarget.user.id === message.author.id) {
          return message.reply("You cannot censor yourself!");
        }
        if (tokenData.censoredusers.includes(censorTarget.id)) {
          return message.reply("That user is already censored!");
        }
        tokenData.censoredusers += censorTarget.id + ' ';
        await fm.writeFile(path, JSON.stringify(tokenData));
        message.channel.send(`Now censoring ${censorTarget.user.tag}!`);
        break;

      case 'uncensor':
        if (!member.hasPermission('MANAGE_MESSAGES')) { // restricts this command to mods only, maybe add extra required perms?
          return message.reply('You do not have sufficient perms to do that!');
        }
        if (!fs.existsSync(path)) {
          return message.reply('This server does not have a valid token yet! Try doing !update!');
        }

        let uncensorTarget = message.mentions.members.first();
        if (!uncensorTarget) {
          return message.reply("Please mention a valid member of this server");
        }
        if (!tokenData.censoredusers.includes(uncensorTarget.id)) {
          return message.reply("That user was not censored!");
        }
        tokenData.censoredusers = tokenData.censoredusers.replace(uncensorTarget.id + ' ', '');
        await fm.writeFile(path, JSON.stringify(tokenData));
        message.channel.send(`Now uncensoring ${uncensorTarget.user.tag}!`);
        break;

      case 'censored':
        const censoredListEmbed = new Discord.MessageEmbed()
          .setColor(0x333333)
          .setTitle('Censored Users:')
          .setFooter(`Requested by ${message.author.tag}`);

        if (!tokenData.censoredusers) {
          censoredListEmbed.setDescription('No one is censored!')
        } else {
          let censoredList = tokenData.censoredusers.trim().split(' ');
          censoredList.forEach(user =>
            censoredListEmbed.addField(`\u200b${client.users.cache.get(user).tag}`, `\u200b${client.users.cache.get(user).id}`)
          )
        }
        message.channel.send(censoredListEmbed);
        break;

      case 'purge':
        if (!member.hasPermission('MANAGE_MESSAGES')) { // restricts this command to mods only
          return message.reply('You do not have sufficient perms to do that!');
        }
        // get the delete count, as an actual number.
        const deleteCount = parseInt(args[0], 10);

        if(!deleteCount || deleteCount < 2 || deleteCount > 100) {
          return message.reply("Please provide a number between 2 and 100 for the number of messages to delete");
        }
        const fetched = await message.channel.messages.fetch({limit: deleteCount});
        message.channel.bulkDelete(fetched)
          .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));
        break;

      case 'kick':
        if (!member.hasPermission('KICK_MEMBERS')) { // restricts this command to mods only
          return message.reply('You do not have sufficient perms to do that!');
        }

        let kickTarget = message.mentions.members.first();
        if (!kickTarget) {
          return message.reply("Please mention a valid member of this server");
        }
        if (kickTarget.user.id === message.author.id) {
          return message.reply("You cannot kick yourself!");
        }
        if (!kickTarget.kickable) {
          return message.reply("I cannot kick this user!");
        }
        // joins remaining args for reason
        let kickReason = args.slice(1).join(' ');
        if (!kickReason) kickReason = "No reason provided";

        await kickTarget.kick(kickReason)
          .catch(error => message.reply(`Sorry ${message.author}, I couldn't kick because of : ${error}`));
        message.channel.send(`${kickTarget.user.tag} has been kicked by ${message.author.tag} for the reason: ${kickReason}`);
        break;

      case 'ban':
        if (!member.hasPermission('BAN_MEMBERS')) { // restricts this command to mods only
          return message.reply('You do not have sufficient perms to do that!');
        }

        let banTarget = message.mentions.members.first();
        if (!banTarget) {
          return message.reply("Please mention a valid member of this server");
        }
        if (banTarget.user.id === message.author.id) {
          return message.reply("You cannot ban yourself!");
        }
        if (!banTarget.bannable) {
          return message.reply("I cannot ban this user!");
        }
        // joins remaining args for reason
        let banReason = args.slice(1).join(' ');
        if (!banReason) banReason = "No reason provided";

        await banTarget.ban(banReason)
          .catch(error => message.reply(`Sorry ${message.author}, I couldn't ban because of : ${error}`));
        message.channel.send(`${banTarget.user.tag} has been banned by ${message.author.tag} for the reason: ${banReason}`);
        break;
      case 'makeaemote':
        guild.emojis.create(args[0], args[1])
          .then(emoji => message.channel.send(`Created new emoji with name ${emoji.name}!`))
          .catch(error => message.channel.send(`shit, well that didn't work. Try harder?`));
        break;
    }
  }
});

client.on("messageDelete", async message => {
  if (message.author.bot) return; // Bot ignores itself and other bots

  // code block reads token and then gets log channel + censored users
  const guild = message.guild;

  let tokenData = {}; // probably better way to do this
  const path = `./tokens/${guild.id}.json`;
  if (fs.existsSync(path)) { // checks if the token exists
    tokenData = await fm.readFile(`./tokens/${guild.id}.json`);
    tokenData = JSON.parse(tokenData);
  }
  const logChannel = tokenData.logchannel || false;
  const censoredUsers = tokenData.censoredusers || false;

  if (censoredUsers && censoredUsers.includes(message.author.id)) return; // prevents double logging of censored messages, probably better way of doing this

  if (logChannel) {
    const deleteEmbed = new Discord.MessageEmbed()
      .setColor(0x333333)
      .setAuthor(`Message by ${message.author} in ${message.channel.name} was deleted:`)
      .setDescription(`\u200b${message.content}`) // the \u200b is to not get RangeErrors from empty messages
      .setFooter(`${new Date()}`);
    client.channels.cache.get(logChannel).send(deleteEmbed);
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return; // Bot ignores itself and other bots
  if (oldMessage.content == newMessage.content) return; // fixes weird link preview glitch

  // code block reads token and then gets log channel + censored users
  const guild = oldMessage.guild;

  let tokenData = {}; // probably better way to do this
  const path = `./tokens/${guild.id}.json`;
  if (fs.existsSync(path)) { // checks if the token exists
    tokenData = await fm.readFile(`./tokens/${guild.id}.json`);
    tokenData = JSON.parse(tokenData);
  }
  const logChannel = tokenData.logchannel || false;

  if (logChannel) {
    const editEmbed = new Discord.MessageEmbed()
      .setColor(0x333333)
      .setAuthor(`Message by ${oldMessage.author} in ${oldMessage.channel.name} was edited:`)
      .addFields(
        {name: 'Before:', value: `\u200b${oldMessage.content}`}, // the \u200b is to not get RangeErrors from empty messages
        {name: 'After:', value: `\u200b${newMessage.content}`}
      )
      .setFooter(`${new Date()}`);
    client.channels.cache.get(logChannel).send(editEmbed);
  }
});

client.login(auth.token);
