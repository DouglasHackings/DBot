import {Message, MessageEmbed} from 'discord.js';
import { create, all } from 'mathjs';
import {requestedBy} from '../../utils/messages';

const config = { };
const math = create(all, config);


export default {
    name: 'math',
    aliases: ['calc'],
    description: 'Calculates a list of expressions using mathjs.',
    pattern: '[...expressions]',
    examples: ['math "sqrt(3^2 + 4^2)"', 'math "x = 500" "x + 35"', 'math "f(x, y) = x^y" "f(2, 3)"'],
    async execute(message: Message, parsed: {expressions: string[]}) {
        if (!math.parser) return; // unsure why math is a partial
        const parser = math.parser();

        const mathEmbed = requestedBy(message.author)
            .setTitle('Eval Stack');

        for (const expression of parsed.expressions) {
            let parsed = parser.evaluate(expression);
            if (typeof parsed === 'function') parsed = '*Function definition*';

            mathEmbed.addField(`\\> ${expression}`, String(parsed));
        }

        message.channel.send({embeds: [mathEmbed]});
    }
}
