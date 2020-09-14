import { Client, ClientUser, Collection, Guild, Message, MessageEmbed, Snowflake } from "discord.js";
import createCards from "./private/createCards";
/**
 * @param client The current Client instance being used for the bot.
 * @param message The last sent message.
 * @param gameData A collection used to store all the current game data.
 */
export async function createGame(client: Client, message: Message, gameData: Collection<Snowflake, object>): Promise<MessageEmbed> {

    gameData.set(message.channel.id, {
        guild: (<Guild>message.guild).id,
        channel: message.channel.id,
        creator: message.author.id,
        waiting: true, 
        active: false,
        users: [{
            id: message.author.id,
            hand: await createCards(7, false),
            safe: false,
        }],
        topCard: (await createCards(1, true))[0]
    });

    const embed = new MessageEmbed()
        .setAuthor("An UNO! Game Was Created!", message.author.displayAvatarURL({ format: "png" }))
        .setColor("RED")
        .setDescription(`${message.author} created an UNO! game! You can now join the game!`)
        .setFooter("Waiting for more users...", (<ClientUser>client.user).displayAvatarURL({ format: "png" }))
    return embed;
}