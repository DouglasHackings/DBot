/*
    An argument parser to match message portions to argument patterns, somewhat inspired by HarVM's simpleArgumentParser.

    Parser Syntax:
    [field] = String field
    [field]? = Optional field
    [...field] = Repeating field
    @[user] = Mention field
    #[channel] = Channel field
    &[role] = Role field
    <rest> = Rest of the arguments, as a string

    Examples (argString, pattern => result):
    "add @role", "[action] &[role]"
        => { action: "add", role: Discord.Role }
    "something other else", "[field] [field2] [field3]?"
        => { field: "something", field2: "other", field3: "else" }
    "something other", "[field] [field2] [field3]?"
        => { field: "something", field2: "other" }
    "something other", "[field] [field2] [field3]"
        => MissingArgumentError
    "something other else", "<message>"
        => { message: "something other else" }
    "one two three", "[...numbers]"
        => { numbers: ["one", "two", "three"] }
    "@user @otheruser @thirduser", "@[...people]"
        => { people: [Discord.User, Discord.User, Discord.User] }

    TODO: add syntax for commands that can have multiple patterns
    Commands whose arguments can be one of multiple patterns: set, censor, uncensor, technically roll would benefit from it as well
*/

import MissingArgumentError from '../errors/MissingArgumentError.js';
import IllegalArgumentError from '../errors/IllegalArgumentError.js';


// Regexes to get ID from mention (<@!someid> => someid)
const mentionRegex = /^<@!?(\d+)>$/;
const channelRegex = /^<#(\d+)>$/;
const roleRegex = /^<@&(\d+)>$/;


export default function parse(argString, command, client, guild) {
    const returnObj = {};

    // Get argument patterns if they exist, return if the command takes in no arguments or if patterns are missing
    if (!command.pattern) return;
    const patterns = command.pattern.split(' ');

    // Split by spaces, but preserve sequences with spaces that are enclosed in quotes
    // Regex taken from HarVM
    const args = argString.match(/("(?:[^"\\]|\\.)*")|[^\s]+/g);

    // Go down the queue of args and attempt to match 1:1 to patterns
    for (let i = 0; i < patterns.length; i++) {

        const pattern = patterns[i].match(/^(?<prefix>[@#&]?)(?<bracket>[<\[])(?<repeating>(?:\.{3})?)(?<name>\w+)[\]>](?<optional>\??)$/);
        const { name, bracket, prefix, repeating, optional } = pattern.groups;

        // If no args were provided, or if none remain
        if (!args || !args.length) {
            // Throw MissingArgumentError if a required argument is not found
            if (!optional) throw new MissingArgumentError(command.name, name);
            // Break the loop as no arguments remaining means no more parsing can be done
            break;
        }

        let arg = args.shift();

        // Special case for <Rest> patterns
        // Can probably be simplified
        if (bracket === '<') {
            // Check for bad patterns
            if (repeating)
                console.warn(`Bad pattern in ${command.name}, field <${name}> cannot be repeating`);
            if (prefix)
                console.warn(`Bad pattern in ${command.name}, field <${name}> cannot have a prefix`);
            if (i !== patterns.length - 1)
                console.warn(`Bad pattern in ${command.name}, field <${name}> is not the last field`);

            args.unshift(arg)
            returnObj[name.toLowerCase()] = args.join(' ');

            return returnObj;
        }

        // If repeating, match remaining args and return
        if (repeating) {
            // Check for bad patterns
            if (i !== patterns.length - 1)
                console.warn(`Bad pattern in ${command.name}, repeating field ${name} is not the last field`);

            args.unshift(arg)
            returnObj[name.toLowerCase()] = args
                .map(arg => matchSingular(arg, prefix, name, client, guild, command));

            return returnObj;
        }

        // Otherwise, match arg based on prefix
        arg = arg.replace(/^"|"$/g, ''); // Sanitize quotes
        returnObj[name.toLowerCase()] = matchSingular(arg, prefix, name, client, guild, command);
    }

    return returnObj;
}

function matchSingular(arg, prefix, name, client, guild, command) {
    switch (prefix) {
        case '@': // Users
            let userID = arg.match(mentionRegex) ? arg.match(mentionRegex)[1] : arg;

            let user = client.users.cache.get(userID);
            if (!user) throw new IllegalArgumentError(command.name, `Field \`${name}\` must be a valid user`);
            return user;

        case '#': // Channels
            let channelID = arg.match(channelRegex) ? arg.match(channelRegex)[1] : arg;

            let channel = client.channels.cache.get(channelID);
            if (!channel) throw new IllegalArgumentError(command.name, `Field \`${name}\` must be a valid channel`);
            return channel;

        case '&': // Roles
            let roleID = arg.match(roleRegex) ? arg.match(roleRegex)[1] : arg;

            let role = guild.roles.cache.get(roleID);
            if (!role) throw new IllegalArgumentError(command.name, `Field \`${name}\` must be a valid role`);
            return role;

        default: // Default string field
            return arg;
    }
}