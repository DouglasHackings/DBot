import {CommandInteraction, Message, User} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';

// Utilities
import {replyEmbed} from '../../utils/messageUtils';
import {success} from '../../utils/messages';

// Errors
import IntegerRangeError from '../../errors/IntegerRangeError';


export default {
    data: new SlashCommandBuilder()
        .setName('expunge')
        .setDescription('Removes all reactions from the specified amount of messages in the channel.')
        .addIntegerOption(option => option
            .setName('count')
            .setDescription('The number of messages to expunge.')
            .setMinValue(1)
            .setMaxValue(99)
            .setRequired(true))
        .addUserOption(option => option
            .setName('target')
            .setDescription('The person to expunge reactions from.')),
    examples: 'expunge 80',
    guildOnly: true,
    permReqs: 'MANAGE_MESSAGES',
    clientPermReqs: 'MANAGE_MESSAGES',
    async execute(message: Message | CommandInteraction, parsed: {count: number, target?: User}) {
        const {count, target} = parsed;

        // TODO: see todo in `purge.ts`
        if (count < 1 || count > 99)
            throw new IntegerRangeError('expunge', 'count', 1, 99);

        if (!message.channel) return;
        let fetched = await message.channel.messages.fetch({limit: count + 1})
        if (target) fetched = fetched.filter(message => message.author.id === target.id); // Support expunge by user

        [...fetched.values()].forEach(message => {
            if (message.reactions.cache.size > 0) message.reactions.removeAll();
        });
        await replyEmbed(message, success().setDescription(`Expunged ${count} messages.`));
    }
}
