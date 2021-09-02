import {CommandInteraction, Message, MessageEmbed} from 'discord.js';
import {Guild} from '../../models/Guild';
import {author, reply} from '../../utils/messageUtils';
import IllegalArgumentError from '../../errors/IllegalArgumentError';


export default {
    name: 'help',
    description: 'Gets info about a command.',
    pattern: '[Command]?',
    examples: 'help censor',
    async execute(target: Message | CommandInteraction, parsed: {command?: string}, tag: Guild) {
        const client = target.client;
        const commands = client.commands;
        const name = parsed.command;

        let prefix = '!';
        const guild = target.guild;
        if (guild) prefix = tag.prefix;

        // If there were no arguments given
        if (!name) {
            // Return a list of all commands
            const commandListEmbed = new MessageEmbed()
                .setColor(0x333333)
                .setTitle('Command List')
                .setDescription(`Use \`${prefix}help [Command]\` for information about a command.`)
                .setFooter(`Requested by ${author(target).tag}`);

            for (const module of client.submodules)
                commandListEmbed.addField(module,
                    [...client.commands.values()]
                        .filter(cmd => cmd.commandGroup === module)
                        .map(cmd => cmd.name)
                        .join(', '), true);

            return reply(target, {embeds: [commandListEmbed]});
        }

        // If there were arguments given
        const command = commands.get(name.toLowerCase()) || commands.find(c => !!c.aliases && c.aliases.includes(name));
        if (!command) throw new IllegalArgumentError(this.name, `Command \`${name}\` not a valid command`);

        // If there were arguments given and the argument was a valid command
        const helpEmbed = new MessageEmbed()
            .setColor(0x333333)
            .setTitle(`${command.name}`)
            .setFooter(`Requested by ${author(target).tag}`);

        if (command.description) helpEmbed.setDescription(`${command.description}`);
        if (command.commandGroup) helpEmbed.addField('**Command Group:**', `${command.commandGroup}`);
        if (command.aliases) helpEmbed.addField('**Aliases:**', `${command.aliases.join(', ')}`);
        helpEmbed.addField('**Usage:**', `${prefix}${command.name} ${command.pattern || ''}`);

        if (command.examples) helpEmbed.addField('**Examples:**',
            Array.isArray(command.examples) ? command.examples.map(example => prefix + example).join('\n') : prefix + command.examples);
        if (command.permReqs) helpEmbed.addField('**Permissions Required:**',
            Array.isArray(command.permReqs) ? command.permReqs.join(', ') : command.permReqs.toString());

        await reply(target, {embeds: [helpEmbed]});
    }
}
