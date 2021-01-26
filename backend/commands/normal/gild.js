// consider using !react for this
export default {
    name: 'gild',
    aliases: ['award'],
    description: 'Gives some reddit gold to the previous message.',
    examples: 'gild',
    clientPermReqs: 'ADD_REACTIONS',
    async execute(message) {
        message.channel.messages.fetch({limit: 2}).then(messages => {
            let gildTarget = messages.last();
            Promise.all([
                gildTarget.react('727100873016344687'),
                gildTarget.react('726691291970404353'),
                gildTarget.react('726691292020736110'),
            ])
            messages.first().delete();
        });
    }
}
