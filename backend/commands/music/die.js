import { canModifyQueue } from "../utils/canModifyQueue.js";
import {success} from '../../utils/messages.js';

import QueueNonexistentError from '../../errors/QueueNonexistentError.js';


export default {
    name: 'die',
    description: 'Kills the music.',
    examples: 'die',
    guildOnly: true,
    async execute(message) {
        const queue = message.client.queue.get(message.guild.id);

        if (!queue)
            throw new QueueNonexistentError(this.name);
        if (!canModifyQueue(message.member))
            return;

        queue.songs = [];
        queue.connection.dispatcher.end();
        queue.textChannel.send(success({desc: `⏹ Music queue ended`}));

        await message.guild.me.voice.channel.leave();
    }
};