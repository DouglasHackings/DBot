export default {
    name: 'set',
    description: 'Sets new token data for this server.',
    usage: 'set [field] [value]',
    examples: ['set logchannel #logs', 'set prefix r'],
    guildOnly: true,
    permReqs: 'MANAGE_GUILD',
    async execute(message, parsed, client) {
        const args = parsed.raw;
        const guild = message.guild;
        const field = args.shift().toLowerCase();
        if (!field) return message.reply('you must specify the token field to modify!');

        const tag = await client.Tags.findOne({ where: { guildID: guild.id } });
        let updated; // better way of doing this, there is probably

        switch (field) {
            case 'logchannel':
                const channelTarget = parsed.channelTarget;
                if (!channelTarget) return message.reply("please mention a valid channel in this server");
                if (!(channelTarget.guild.id === guild.id)) return message.reply('you can only log to your own server!');

                tag.logchannel = channelTarget.id;
                updated = channelTarget;
                break;

            case 'prefix':
                const prefix = args.join(" ");
                if (!prefix) return message.reply('you must specify a prefix to set!')

                tag.prefix = prefix;
                updated = prefix;
                break;

            default:
                return message.reply('you must specify a valid token field to modify! Valid token fields: `logchannel, prefix`');
        }
        await tag.save();
        message.channel.send(`Success! ${field} has been updated to ${updated}!`);
    }
}
