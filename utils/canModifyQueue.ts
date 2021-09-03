import {GuildMember} from 'discord.js';

export function canModifyQueue(member: GuildMember) {
    const { channel } = member.voice;
    const botChannel = member.guild.me!.voice.channel;

    return channel === botChannel;
}
