// Libraries
import Discord, {MessageEmbed} from 'discord.js';
import Sequelize from 'sequelize';
import fs from 'fs';

// Auth
import {token} from './auth.js';

// Utils
import {log} from "./commands/utils/logger.js";
import {parseArgs} from './utils/argumentParser.js';
import {update, isInField} from './utils/tokenManager.js';
import {truncateMessage} from './commands/utils/messageTruncator.js';

// Models
import loadGuilds from './models/Guild.js';


const client = new Discord.Client({
    ws: { intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES"] }
});

// Models
const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.sqlite',
});
client.GuildTags = loadGuilds(sequelize, Sequelize);


// Dynamic command handling
client.commands = new Discord.Collection();
client.loadCommands = async function() {
    const dirnames = ['admin', 'music', 'normal', 'owner', 'presets'];

    for (let dir of dirnames) {
        const commands = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));

        for (let file of commands) {
            let command = await import(`./backend/commands`);
            command = command.default; // Required because of default exports
            command.commandGroup = dir; // Dynamic commandgroups
            client.commands.set(command.name, command);
        }
    }
    console.log('Commands loaded!');
}


client.ownerID = '355534246439419904'; // For owner only commands
client.queue = new Map(); // For music commands
const talkedRecently = new Set(); // For global cooldowns; consider switching to command specific cooldowns?


// Run initial stuff
client.once('ready', async () => {
    await client.loadCommands(); // Load commands
    client.GuildTags.sync(); // Sync database
    console.log(`Logged in as ${client.user.tag}!`);
    await client.user.setActivity('!help', {type: "LISTENING"});
});

client.on("guildCreate", async guild => {
    await update(guild, client);
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
        await client.users.cache.get(client.ownerID).send(dmEmbed);
    }

    if (talkedRecently.has(message.author.id)) return; // Global spam prevention

    let prefix = '!';
    let tag;
    let member;
    let guild;

    if (message.guild) {
        // Server specific Tag reliant things (censorship, custom prefix)
        guild = message.guild;
        member = guild.member(message.author);

        await update(guild, client);
        tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });
        prefix = tag.prefix;

        // Handles censorship
        if (
            (tag.censored_users || tag.censored_words)
            && (isInField(tag, 'censored_users', message.author.id)
                || isInField(tag, 'censored_words', message.content.split(' ')))
            && !member.hasPermission('ADMINISTRATOR')
        ) {
            await message.delete()
                .catch(error => console.error(`message in ${guild} could not be censored because of ${error}!`));

            await log(client, guild, 0x7f0000, message.author.tag, message.author.avatarURL(), `**Message by ${message.author} censored in ${message.channel}:**\n${message.content}`)
            return;
        }
    }

    if (message.content.substring(0, prefix.length) === prefix) {
        const parsed = parseArgs(message, prefix, client);

        const commandName = parsed.commandName;
        if (message.guild
            && tag.disabled_commands
            && isInField(tag, 'disabled_commands', commandName)
        ) return message.reply('that command is disabled!'); // Handles command disabling

        const command = client.commands.get(commandName)
            || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        if (command.guildOnly && message.channel.type === 'dm')
            return message.reply('I can\'t execute that command inside DMs!');
        if (command.permReqs && !member.hasPermission(command.permReqs))
            return message.reply(`you do not have sufficient perms to do that! Perms required for this command: ${command.permReqs}`);
        if (command.clientPermReqs && !guild.member(client.user).hasPermission(command.clientPermReqs))
            return message.reply(`I do not have sufficient perms to do that! Perms I need for this command: ${command.clientPermReqs}`);
        if (command.ownerOnly && message.author.id !== client.ownerID)
            return message.reply('you must be the bot owner to use this command!');

        try {
            await command.execute(message, parsed, client, tag);
        } catch (error) {
            console.error(error);
            message.reply('there was an error trying to execute that command!');
        }

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
    if (!message.guild) return; // Ignores DMs
    if (message.author.bot) return; // Bot ignores itself and other bots

    const guild = message.guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });

    if (tag.censored_users && isInField(tag, 'censored_users', message.author.id)) return; // prevents double logging of censored messages, probably better way of doing this
    if (!(tag.logchannel && tag.log_message_delete)) return;

    let desc = truncateMessage(`**Message by ${message.author} in ${message.channel} was deleted:**\n${message.content}`, -48) // Unlike messages, embed descriptions have a character limit of 2048
    await log(client, guild, 0xb50300, message.author.tag, message.author.avatarURL(), desc);
});

client.on("messageDeleteBulk", async messages => {
    const guild = messages.first().guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });
    if (!(tag.logchannel && tag.log_message_delete_bulk)) return;

    // temporary Dyno-like bulkdelete logging system, will convert into superior system later
    await log(client, guild, 0xb50300, guild.name, guild.iconURL(), `**${messages.array().length} messages were deleted in ${messages.first().channel}**`);
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
    if (!oldMessage.guild) return; // Ignores DMs
    if (oldMessage.author.bot) return; // Bot ignores itself and other bots
    if (oldMessage.content === newMessage.content) return; // fixes weird link preview glitch

    const guild = oldMessage.guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });
    if (!(tag.logchannel && tag.log_message_edit)) return;

    let desc = `**Message by ${oldMessage.author} in ${oldMessage.channel} was edited:** [Jump to message](${newMessage.url})`;
    let truncatedBefore = truncateMessage(oldMessage.content, 976); // Unlike messages, embed fields have a character limit of 1024
    let truncatedAfter = truncateMessage(newMessage.content, 976);
    let fields = [{name: 'Before:', value: truncatedBefore}, {name: 'After:', value: truncatedAfter}];

    await log(client, guild, 0xed7501, oldMessage.author.tag, oldMessage.author.avatarURL(), desc, fields);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => { // TODO: finish this by adding role logging
    if (oldMember.user.bot) return;

    const guild = oldMember.guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });
    if (!(tag.logchannel && tag.log_nickname_change)) return; // will have to update later if I wish to use this for more things than nickname changes

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
        client.channels.cache.get(tag.logchannel).send(updateEmbed).catch(error => console.error(`guildMemberUpdate in ${guild} could not be logged because of ${error}!`));
    }
});

client.on("guildMemberAdd", async (member) => {
    const guild = member.guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });

    if (tag.blacklist.includes(member.id)) { // Enforces blacklist
        await member.ban('Blacklisted user');
        await log(client, guild, 0x7f0000, member.user.tag, member.user.avatarURL(), `**User ${member.user} has been banned on join (blacklist)**`);
        return;
    }

    if (tag.autoroles) { // Adds autoroles
        const autoroles = tag.autoroles.trim().split(' ');
        await member.edit({roles: member.roles.cache.array().concat(autoroles)});
    }
    if (!(tag.logchannel && tag.log_member_join)) return;

    await log(client, guild, 0x79ff3b, 'Member joined the server', member.user.avatarURL(), `${member.user} ${member.user.tag}`);
    // add potential welcome messages later
});

client.on("guildMemberRemove", async (member) => {
    const guild = member.guild;
    const tag = await client.GuildTags.findOne({ where: { guildID: guild.id } });
    if (!(guild.systemChannel && tag.log_member_leave)) return;

    const leaveEmbed = new MessageEmbed()
        .setColor(0x333333)
        .setAuthor('Member left the server', member.user.avatarURL())
        .setDescription(`${member.user} ${member.user.tag}`)
        .setFooter(`${new Date()}`);

    guild.systemChannel.send(leaveEmbed).catch(error => console.error(`guildMemberRemove in ${guild} could not be logged because of ${error}!`));
});

// Error handling
client.on("warn", info => console.log(info));
client.on("error", error => console.error(error));

client.login(token);
