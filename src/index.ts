import { Client, ClientUser, Collection, Guild, Message, MessageEmbed, MessageReaction, Snowflake, User } from "discord.js";
import { cards as gameCardsArray } from "./data/Cards";
import Card from "./data/interfaces/Card.interface";
import GameData from "./data/interfaces/GameData.interface";
import Settings from "./data/interfaces/Settings.interface";

export class DiscordUNO {
    constructor(
        public client: Client, 
        private storage = new Collection<Snowflake, GameData>(), 
        private gameCards = gameCardsArray,
        private settings = new Collection<Snowflake, Settings>()
    ) { };
    

    /**
     * To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).
     */
    public async createGame(message: Message): Promise<Message> {
        if (!this.settings.get(message.guild.id)) {
            this.settings.set(message.guild.id, {
                jumpIns: false,
                reverse: false,
                seven: false,
                stacking: false,
                wildChallenge: false,
                zero: false,
            });
        }
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

        return message.channel.send(`${message.author} created an UNO! game! You can now join the game!`);

    };

    /**
     * To add a user to the current game, call the addUser() method. This method accepts one parameter, which is the Message object. This method handles adding users to the game in the current channel. This will automatically start the game if the user count reaches ten.
     */
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

            return message.channel.send(`Top Card: ${foundGame.topCard.name}\n\nCurrent Player: ${(<User>this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`)
        }

        this.storage.set(message.channel.id, foundGame);
            
        return message.channel.send(`${message.author} joined ${message.channel}'s UNO! game!`);
    }
    /**
     * To remove a user from the game, call the removeUser() method. This method accepts one parameter, whcih is the Message object. This method will handle removing users from the game and returning their cards to the "deck".
     */
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
    /**
     * To view your current hand in the game, call the viewCards() method. This method accepts one parameter, which is the Message object. This method will handle showing users the current cards that they have in their hand. It will return a dirrect message to the user with their hand.
     */
    public viewCards(message: Message): Promise<Message> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game going on in this channel to view cards in. Try creating one instead.");
        const userHand = (<{ id: Snowflake, hand: Card[], safe: false }>foundGame.users.find(user => user.id === message.author.id)).hand;
        message.channel.send(`${message.author}, check your DMs!`);
        return message.author.send(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`);
    }

    /**
     * To manually start the game, call the startGame() method. This method accepts one parameter, which is the message object. This method will only work if the game has at least two users entered. Otherwise it will return. On success this method will send each user their cards and a starting message to the game channel.
     */
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

        return message.channel.send(`Top Card: ${foundGame.topCard.name}\n\nCurrent Player: ${(<User>this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`)
    }
    /**
     * To play a card in your hand, call the playCard() method. This method accepts one parameter, which is the message object. This method will handle playing the card called. On success, it will remove the card from their hand and replace the top card. On fail it will return.
     */
    public playCard(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to play a card in! Try making a new game instead.");
        const settings = this.settings.get(message.channel.id);

        const user = foundGame.users[foundGame.currentPlayer];
        const card = message.content.split(" ").slice(1).join(" ");
        if (!card) return message.channel.send("Please provide a valid card.");

        const cardObject = user.hand.find(crd => crd.name.toLowerCase() === card.toLowerCase());

        let jumpedIn = false;

        if (settings.jumpIns) {
            if (cardObject.name === foundGame.topCard.name && user.id !== message.author.id) {
                jumpedIn = true;
                foundGame.currentPlayer = foundGame.users.findIndex(user => user.id === message.author.id);
            } else return message.channel.send("It isn't your turn yet!");
        } else if (user.id !== message.author.id) return message.channel.send("Jump in's are disabled in this game, and it isn't your turn yet!");
        
        const special = this.doSpecialCardAbility(cardObject, foundGame);

        if (special) {

        } else {

            const lastPlayer = foundGame.currentPlayer;
            foundGame.currentPlayer = this.nextTurn(foundGame.currentPlayer, "normal", settings, foundGame);


            this.storage.set(message.channel.id, foundGame);

            return message.channel.send(`${this.client.users.cache.get(foundGame.users[lastPlayer].id).tag} played a ${cardObject.name}. It is now ${this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).tag}'s turn.`);
        }

        return message.channel.send("");
    }
    /**
     * To view the current state of the game, call the viewTable() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image to the channel with all the current information of the game. Including rotation, whos turn it is, how many cards each user has, whos in the game, and the top card of the pile.
     */
    public viewTable(message: Message): Promise<Message> {
        return message.channel.send("lol");
    }

    private doSpecialCardAbility(card: Card, data: GameData): boolean {

        switch (card.name) {
            case "Wild Draw Four":

            break;
            case "":

            break;
        };

        return false;
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
    private nextTurn(player: number, type: "skip" | "normal", settings: Settings, storage: GameData): number {
        switch (type) {
            case "normal":
                return (settings.reverse ? player - 1 < 0 ? storage.users.length - 1 : player - 1 : player + 1 >= storage.users.length ? 0 : player + 1);
            case "skip":
                return (storage.users.length == 2 ? player : settings.reverse ? (player - 1) < 0 ? storage.users.length - 1 : player - 1 : (player + 1) > storage.users.length - 1 ? 0 : player + 1); 
        };
    }
}

module.exports.DiscordUNO = DiscordUNO;