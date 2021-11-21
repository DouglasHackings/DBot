import {CommandInteraction, GuildMember, Message} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import { canModifyQueue } from '../utils/canModifyQueue';
import {skip} from '../../utils/messages';

import QueueNonexistentError from '../../errors/QueueNonexistentError';


export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the currently playing song.'),
    aliases: ['s'],
    guildOnly: true,
    async execute(message: Message | CommandInteraction) {
        if (!message.member || !(message.member instanceof GuildMember)) return;

        const subscription = message.client.subscriptions.get(message.guild!.id);

        if (!subscription) throw new QueueNonexistentError('skip');
        if (!canModifyQueue(message.member)) return;

        // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
        // listener defined in `subscription.ts`, transitions into the Idle state mean the next track from the queue
        // will be loaded and played.
        subscription.audioPlayer.stop();
        await message.reply({embeds: [skip()]});
    }
};
