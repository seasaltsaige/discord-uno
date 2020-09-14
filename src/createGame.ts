import { Client, Collection, Guild, Message, MessageEmbed, Snowflake } from "discord.js";
/**
 * 
 * @param client The current Client instance being used for the bot.
 * @param message The last sent message.
 * @param gameData A collection used to store all the current game data.
 */
export function createGame(client: Client, message: Message, gameData: Collection<Snowflake, object>): MessageEmbed {

    gameData.set(message.channel.id, {
        guild: (<Guild>message.guild).id,
        channel: message.channel.id,
        creator: message.author.id,
        waiting: true, 
        active: false,
        users: [{
            id: message.author.id,
            hand: "",
            safe: false,
        }],
        topCard: ""
    });

    const embed = new MessageEmbed()

    return embed;
}