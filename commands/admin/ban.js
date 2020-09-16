import {log} from "../utils/logger.js";

export default {
  name: 'ban',
  guildOnly: true,
  permReqs: 'BAN_MEMBERS',
  async execute(message, args, userTarget, memberTarget, channelTarget, roleTarget, client) { // target = GuildMember
    const guild = message.guild;

    if (!memberTarget) return message.reply("please mention a valid member of this server");
    if (memberTarget.user.id === message.author.id) return message.reply("you cannot ban yourself!");
    if (!memberTarget.bannable) return message.reply("I cannot ban this user!");

    let reason = args.join(' ');
    if (!reason) reason = "No reason provided";

    await memberTarget.ban(reason)
        .catch(error => message.reply(`sorry, I couldn't ban because of : ${error}`));

    await log(client, guild, 0x7f0000, memberTarget.user.tag, memberTarget.user.avatarURL(), `**${memberTarget.user} has been banned by ${message.author} for the reason:**\n${reason}`);
    await message.react('👌');
  }
}
