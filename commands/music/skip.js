import { canModifyQueue } from "../utils/canModifyQueue.js";

export default {
    name: "skip",
    aliases: ["s"],
    description: 'Skips the currently playing song.',
    usage: 'skip',
    examples: 'skip',
    execute(message) {
        const queue = message.client.queue.get(message.guild.id);
        if (!queue)
            return message.reply("There is nothing playing that I could skip for you.").catch(console.error);
        if (!canModifyQueue(message.member)) return;

        queue.playing = true;
        queue.connection.dispatcher.end();
        queue.textChannel.send(`${message.author} ⏭ skipped the song`).catch(console.error);
    }
};