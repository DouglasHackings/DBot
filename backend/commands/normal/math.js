import { create, all } from 'mathjs';
import {MessageEmbed} from 'discord.js';

const config = { };
const math = create(all, config);


export default {
    name: 'math',
    aliases: ['calc'],
    description: 'Calculates a list of expressions using mathjs.',
    pattern: '[...Expressions]',
    examples: ['math "sqrt(3^2 + 4^2)"', 'math "x = 500" "x + 35"', 'math "f(x, y) = x^y" "f(2, 3)"'],
    async execute(message, parsed) {
        const parser = math.parser();

        const mathEmbed = new MessageEmbed()
            .setColor(0x333333)
            .setTitle('Eval Stack')
            .setFooter(`Requested by ${message.author.tag}`)

        for (const expression of parsed.expressions) {
            let parsed = parser.evaluate(expression);

            if (typeof parsed === 'function') parsed = '*Function definition*';
            mathEmbed.addField(`\\> ${expression}`, parsed);
        }

        message.channel.send(mathEmbed);
    }
}
