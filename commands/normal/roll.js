export default {
    name: 'roll',
    aliases: ['rng', 'dice'],
    description: 'rolls an x sided dice.',
    usage: 'roll [sides]',
    execute(message, parsed, client) {
        let sides = parsed.first;
        if (!sides || !Number(sides)) sides = 6;

        let roll = Math.floor(Math.random() * Math.floor(sides)) + 1;
        message.channel.send(`Rolled a **${sides}** sided die and got **${roll}**!`);
    }
}