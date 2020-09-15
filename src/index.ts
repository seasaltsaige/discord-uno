import { Client, ClientUser, Collection, Guild, Message, MessageEmbed, MessageReaction, Snowflake, User } from "discord.js";
import { cards as gameCardsArray } from "./data/Cards";
import Card from "./data/interfaces/Card.interface";
import GameData from "./data/interfaces/GameData.interface";
import Settings from "./data/interfaces/Settings.interface";

export default class DiscordUNO {
    constructor(
        public client: Client, 
        private storage = new Collection<Snowflake, GameData>(), 
        private gameCards = gameCardsArray,
        private settings = new Collection<Snowflake, Settings>()
    ) { };
    
    public async createGame(message: Message): Promise<Message> {
        if (this.storage.get(message.channel.id)) return message.channel.send("There is already a game going on in this channel. Please join that one instead or create a new game in another channel.");
        this.storage.set(message.channel.id, {
            guild: (<Guild>message.guild).id,
            channel: message.channel.id,
            creator: message.author.id,
            active: false,
            users: [{
                id: message.author.id,
                hand: await this.createCards(7, false),
                safe: false,
            }],
            topCard: (await this.createCards(1, true))[0],
            currentPlayer: 1,
        });

        const embed = new MessageEmbed()
            .setAuthor("An UNO! Game Was Created!", message.author.displayAvatarURL({ format: "png" }))
            .setColor("RED")
            .setDescription(`${message.author} created an UNO! game! You can now join the game!`)
            .setFooter("Waiting for more users...", (<ClientUser>this.client.user).displayAvatarURL({ format: "png" }))
        return message.channel.send(embed);

    };

    public async addUser(message: Message): Promise<Message> {
        
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game in this channel. Instead you can create a new game!");

        if (foundGame.users.some(data => data.id === message.author.id)) return message.channel.send(`${message.author}, you are already in the current channels UNO! game`);

        if (foundGame.active) return message.channel.send("You can no longer join this UNO! game. Try making a new one in another channel.");

        foundGame.users.push({
            id: message.author.id,
            hand: await this.createCards(7, false),
            safe: false,
        });
        
        if (foundGame.users.length === 10) {
            foundGame.active = true;
            this.storage.set(message.channel.id, foundGame);
    
            for (const user of foundGame.users) {
                const userHand = user.hand;
                (<User>this.client.users.cache.get(user.id)).send(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`)
            };
            const embed = new MessageEmbed()
                .setAuthor("UNO! Game", <string>(<Guild>message.guild).iconURL({ format: "png" }))
                .setDescription(`Top Card: ${foundGame.topCard.name}`)
                .setFooter(`Current Player: ${(<User>this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`)
                .setColor("RED");
            return message.channel.send(embed);
        }

        this.storage.set(message.channel.id, foundGame);
            
        return message.channel.send(`${message.author} joined ${message.channel}'s UNO! game!`);
    }

    public async removeUser(message: Message): Promise<Message | void> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to leave from, try creating one instead!");
        
        if (!foundGame.users.some(data => data.id === message.author.id)) return message.channel.send("You can't leave a game that you haven't joined.");
        if (foundGame.creator === message.author.id) return message.channel.send("You can't leave your own game. Try ending the game instead.");

        const msg = await message.channel.send(`${message.author}, are you sure you want to leave the game?`);
        await Promise.all([msg.react("✅"), msg.react("❌")]);

        const filter = (reaction: MessageReaction, user: User) => user.id === message.author.id && ["✅", "❌"].includes(reaction.emoji.name);

        const response = await msg.awaitReactions(filter, { max: 1 });
        if (response.size > 0) {
            const reaction = <MessageReaction>response.first();
            if (reaction.emoji.name === "✅") {
                const userHand = <Card[]>(<{ id: string, hand: Card[], safe: boolean }>foundGame.users.find(user => user.id === message.author.id)).hand;
                this.returnCards(userHand);
                foundGame.users.splice(foundGame.users.findIndex(data => data.id === message.author.id), 1);
                this.storage.set(message.channel.id, foundGame);
                msg.edit(`${message.author} has been successfully removed from the game.`);
            } else {
                msg.edit("Cancelled removal.");
            }
        }
    }

    public viewCards(message: Message): Promise<Message> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game going on in this channel to view cards in. Try creating one instead.");
        const userHand = (<{ id: Snowflake, hand: Card[], safe: false }>foundGame.users.find(user => user.id === message.author.id)).hand;
        message.channel.send(`${message.author}, check your DMs!`);
        return message.author.send(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`);
    }

    public startGame(message: Message): Promise<Message> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game going on in this channel to start. Try creating one instead.");

        if (foundGame.creator !== message.author.id) return message.channel.send("Only the creator of the game can force start the game.");
        if (foundGame.users.length < 2) return message.channel.send("Please wait for at least 2 players before trying to start the game.");
        if (foundGame.active) return message.channel.send("You can't start an already active game.");

        foundGame.active = true;
        this.storage.set(message.channel.id, foundGame);

        for (const user of foundGame.users) {
            const userHand = user.hand;
            (<User>this.client.users.cache.get(user.id)).send(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`)
        };
        const embed = new MessageEmbed()
            .setAuthor("UNO! Game", <string>(<Guild>message.guild).iconURL({ format: "png" }))
            .setDescription(`Top Card: ${foundGame.topCard.name}`)
            .setFooter(`Current Player: ${(<User>this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`)
            .setColor("RED");
        return message.channel.send(embed);

    }
    
    private returnCards (cards: Card[]): void {
        for (const card of cards) {
            let userdCard;
            switch (card.color) {
                case "red":
                    userdCard = <Card>this.gameCards.red.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "yellow":
                    userdCard = <Card>this.gameCards.yellow.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "blue":
                    userdCard = <Card>this.gameCards.blue.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "green":
                    userdCard = <Card>this.gameCards.green.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case null:
                    userdCard = <Card>this.gameCards.wild.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
            }
        }
    }

    private async createCards(amount: number, topCard: boolean) {
        if (!topCard) topCard = false;
        let counter = 0;
        let cardHand: Card[] = [];
        let cards = this.gameCards;
        do {
            let math = Math.floor(Math.random() * 4) + 1;
            let math2 = Math.random();
            if (topCard == false) {
                if (math2 < 0.074) {
                    math = 5;
                }
            }
    
            switch (math) {
                case 1:
                    const yellowCard = async (): Promise<void> => {
                        let tempMath = Math.floor(Math.random() * cards.yellow.length);
                        if (cards.yellow[tempMath].inPlay >= cards.yellow[tempMath].count) return await yellowCard();
                        cardHand.push(cards.yellow[tempMath])
                        cards.yellow[tempMath].inPlay += 1;
                    }
                    await yellowCard();
                break;
                case 2:
                    let redCard = async (): Promise<void>  => {
                        let tempMath2 = Math.floor(Math.random() * cards.red.length);
                        if (cards.red[tempMath2].inPlay >= cards.red[tempMath2].count) return await redCard();
                        cardHand.push(cards.red[tempMath2]);
                        cards.red[tempMath2].inPlay += 1;
                    }
                    await redCard();
                break;
                case 3:
                    let greenCard = async (): Promise<void>  => {
                        let tempMath3 = Math.floor(Math.random() * cards.green.length);
                        if (cards.green[tempMath3].inPlay >= cards.green[tempMath3].count) return await greenCard();
                        cardHand.push(cards.green[tempMath3]);
                        cards.green[tempMath3].inPlay += 1;
                    }
                    await greenCard();
                break;
                case 4:
                    let blueCard = async (): Promise<void>  => {
                        let tempMath4 = Math.floor(Math.random() * cards.blue.length);
                        if (cards.blue[tempMath4].inPlay >= cards.blue[tempMath4].count) return await blueCard();
                        cardHand.push(cards.blue[tempMath4]);
                        cards.blue[tempMath4].inPlay += 1;
                    }
                    await blueCard();
                break;
                case 5:
                    let wildCard = async (): Promise<void>  => {
                        let tempMath5 = Math.floor(Math.random() * cards.wild.length);
                        if (cards.wild[tempMath5].inPlay >= cards.wild[tempMath5].count) return await wildCard();
                        cardHand.push(<Card>cards.wild[tempMath5]);
                        cards.wild[tempMath5].inPlay += 1;
                    }
                    await wildCard();
                break;
            }
            counter++
        } while (counter < amount)
    
        return cardHand;
    }
    private nextTurn(player: number, players: any[], type: "skip" | "normal") {
        
    }
}

// module.exports = DiscordUNO;