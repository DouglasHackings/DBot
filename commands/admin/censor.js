import {readToken} from '../utils/tokenManager.js';
import {writeFile} from '../../fileManager.js';
import fs from 'fs';

export async function censor (message, guild, target) { // target = GuildMember
  if (!guild.member(message.author).hasPermission('MANAGE_MESSAGES')) return message.reply('you do not have sufficient perms to do that!'); // restricts this command to mods only, maybe add extra required perms?

  if (!target) return message.reply("please mention a valid member of this server");
  if (target.id === message.author.id) return message.reply("you cannot censor yourself!");
  if (target.user.bot) return message.reply("bots cannot be censored!"); // should bots be allowed to be censored?

  const path = `./tokens/${guild.id}.json`;
  if (!fs.existsSync(path)) return message.reply('this server does not have a valid token yet! Try doing !update!');

  const tokenData = await readToken(guild);
  if (tokenData.censoredusers.includes(target.id)) return message.reply("that user is already censored!");

  tokenData.censoredusers += target.id + ' ';
  await writeFile(path, JSON.stringify(tokenData));
  message.channel.send(`Now censoring ${target.user.tag}!`);
}
