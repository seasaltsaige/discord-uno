import { Client, Collection, Guild, Message, MessageReaction, Snowflake, User } from "discord.js";
import { cards as gameCardsArray } from "./data/Cards";
import Card from "./data/interfaces/Card.interface";
import GameData from "./data/interfaces/GameData.interface";
import Settings from "./data/interfaces/Settings.interface";
import Player from "./data/interfaces/User.interface";

export class DiscordUNO {
    constructor(
        public client: Client, 
        private storage = new Collection<Snowflake, GameData>(), 
        private gameCards = new Collection<Snowflake, typeof gameCardsArray>(),
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

        this.gameCards.set(message.channel.id, gameCardsArray);

        if (this.storage.get(message.channel.id)) return message.channel.send("There is already a game going on in this channel. Please join that one instead or create a new game in another channel.");
        this.storage.set(message.channel.id, {
            guild: (<Guild>message.guild).id,
            channel: message.channel.id,
            creator: message.author.id,
            active: false,
            users: [{
                id: message.author.id,
                hand: this.createCards(message, 7, false),
                safe: false,
            }],
            topCard: (this.createCards(message, 1, true))[0],
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
            hand: this.createCards(message, 7, false),
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
                const userHand = <Card[]>(<Player>foundGame.users.find(user => user.id === message.author.id)).hand;
                this.returnCards(message, userHand);
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
        const userHand = (<Player>foundGame.users.find(user => user.id === message.author.id)).hand;
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
    public async playCard(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to play a card in! Try making a new game instead.");
        const settings = this.settings.get(message.guild.id);

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

        if (!this.checkTop(foundGame.topCard, cardObject)) return message.channel.send(`You can't play that card! Either play a ${foundGame.topCard.value} Card or a ${foundGame.topCard.color} Card.`);

        if (!cardObject) return message.channel.send("You don't have that card in your hand!");

        const lastPlayer = foundGame.currentPlayer;
        foundGame.topCard = cardObject;
        
        const special = await this.doSpecialCardAbility(message, cardObject, foundGame);

        if (special) {
            message.channel.send("Special Card Detected");
        } else {

            foundGame.currentPlayer = this.nextTurn(foundGame.currentPlayer, "normal", settings, foundGame);
            
            message.channel.send(`${this.client.users.cache.get(foundGame.users[lastPlayer].id).tag} played a ${cardObject.name}. It is now ${this.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).tag}'s turn.`);
        }


        
        foundGame.users[lastPlayer].hand.splice(foundGame.users[lastPlayer].hand.findIndex(crd => crd.name === cardObject.name), 1);

        this.storage.set(message.channel.id, foundGame);

        return this.client.users.cache.get(foundGame.users[lastPlayer].id).send(`Your new hand has ${foundGame.users[lastPlayer].hand.length} cards.\n${foundGame.users[lastPlayer].hand.map(crd => crd.name).join(" | ")}`);
    }
    /**
     * To view the current state of the game, call the viewTable() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image to the channel with all the current information of the game. Including rotation, whos turn it is, how many cards each user has, whos in the game, and the top card of the pile.
     */
    public viewTable(message: Message): Promise<Message> {
        return message.channel.send("lol");
    }
    /**
     * To end the game in its current state, call the endGame() method. This method accepts one parameter, which is the message object. This method will end the game in whatever the current state is. It will determine the winners based off of how many cards users have left in there hand, then it will return a message with the winners.
     */
    public endGame(message: Message): Promise<Message> {
        return message.channel.send("nice");
    }

    /**
     * To close the current game without scoring results, call the closeGame() method. This method accepts one parameter, which is the message object. This method will close the game without scoring any of the users and will immediately end the game. No score will be output and a new game can be created.
     */
    public closeGame(message: Message): Promise<Message> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to end in this channel.");

        if (foundGame.creator !== message.author.id) return message.channel.send("You can't close this game!");
        
        this.storage.delete(message.channel.id);
        this.gameCards.delete(message.channel.id);

        return message.channel.send(`Successfully closed ${message.channel}'s UNO! game.`);
    }
    /**
     * To add a card to your hand, call the draw() method. This method accepts one parameter, which is the message object. This method will handle adding cards to the users hand. Players can't draw if it isn't their turn and if they have a card they can play, they can't draw.
     */
    public draw(message: Message): Promise<Message> {
        
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("You can't draw cards from a game that doesn't exist! Try making one instead!");
        if (!foundGame.users.some(user => user.id === message.author.id)) return message.channel.send("You can't draw cards in this game! You aren't part of it!");
        if (!foundGame.active) return message.channel.send("You can't draw cards from a game that hasn't started yet!");
        if (foundGame.users[foundGame.currentPlayer].id !== message.author.id) return message.channel.send("You can't draw cards yet! It isn't your turn.");
        const newCard = this.createCards(message, 1, false);

        foundGame.users[foundGame.currentPlayer].hand.push(newCard[0]);

        message.channel.send(`${message.author}, check your DMs for your new hand!`);

        this.storage.set(message.channel.id, foundGame);

        return message.guild.members.cache.get(foundGame.users[foundGame.currentPlayer].id).send(`Your new hand has ${foundGame.users[foundGame.currentPlayer].hand.length}.\n\n${foundGame.users[foundGame.currentPlayer].hand.map(c => c.name).join(" | ")}`);
    }

    /**
     * To update the servers UNO! settings, call the updateSettings() method. This method has three parameters, the first one is the Message object, the second one is which setting you are updating, the third one is if you are turning it on or off. This method handles updating the servers UNO! settings. (The settings are stored by Guild ID)
     * @param message The message object.
     * @param setting Which setting you are updating.
     * @param set If you are turning it on or off.
     */
    public updateSettings(message: Message, setting: "jumpIns" | "seven" | "stacking" | "wildChallenge" | "zero", set: boolean): Promise<Message> {
        
        return message.channel.send("Nice")
    }


    // Public Methods Above
    // Private Methods Below


    private checkTop(topCard: Card, playedCard: Card): boolean {
        if ((topCard.color === playedCard.color || topCard.value === playedCard.value || playedCard.value === 'Wild' || playedCard.value === 'Wild Draw Four')) return true;
        else return false;
    }

    private async doSpecialCardAbility(message: Message, card: Card, data: GameData): Promise<boolean> {

        let special = false;
        const settings = this.settings.get(message.guild.id);
        let type: "normal" | "skip";

        if (card.name.toLowerCase() === "wild draw four") { // Done
            special = true;
            let color: "green" | "red" | "blue" | "yellow";
            const msg = await message.channel.send(`${message.author}, which color would you like to switch to? \🔴, \🟢, \🔵, or \🟡. You have 30 seconds to respond.`);
    
            const filter = (reaction: MessageReaction, user: User) => ["🔴", "🟢", "🔵", "🟡"].includes(reaction.emoji.name) && user.id === message.author.id;
            await Promise.all([msg.react("🔴"), msg.react("🟢"), msg.react("🔵"), msg.react("🟡"), ])

            
            const collected = await msg.awaitReactions(filter, { max: 1, time: 30000 });
            const reaction = collected.first();
            if (reaction !== undefined) {
                if (reaction.emoji.name === '🟢') {
                    color = 'green'
                } else if (reaction.emoji.name === '🔴') {
                    color = 'red'
                } else if (reaction.emoji.name === '🔵') {
                    color = 'blue'
                } else if (reaction.emoji.name === '🟡') {
                    color = 'yellow'
                }
            }

            const colors = { 1: "green", 2: "red", 3: "blue", 4: "yellow" };
            if (!color) {
                const math = <1 | 2 | 3 | 4>(Math.floor(Math.random() * 4) + 1);
                color = <"green" | "red" | "blue" | "yellow">(colors[math]);
            }

            data.topCard.color = color;

            const nextUser = this.nextTurn(data.currentPlayer, "normal", settings, data);

            const user = this.client.users.cache.get(data.users[nextUser].id)

            let challenge = false;
            if (settings.wildChallenge) {

                let msg = await message.channel.send(`${message.author.tag} has played a Wild Draw Four, ${user}, would you like to challenge this? If they had another card they could have played, they draw 6 instead, otherwise, you draw 6. If you decide not to challenge, you draw the normal 4 cards`)
                await Promise.all([msg.react("✅"), msg.react("❌")]);

                const f = (reaction: MessageReaction, user: User) => ["✅", "❌"].includes(reaction.emoji.name) && user.id === user.id;

                let collected2 = await msg.awaitReactions(f, { max: 1, time: 30000 });
                if (collected2.size > 0) {
                    const reaction2 = collected2.first();
                    switch (reaction2.emoji.name) {
                        case "✅":
                            challenge = true;
                        break;
                        case "❌":
                            challenge = false;
                        break;
                        default: challenge = false;
                        break;
                    }
                }

                const challenged = message.author;
                const challenger = user;
                const nextTurnUser = message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).user;

                let challengeWIN: boolean;
                if (challenge) {
                    if (data.users.find(user => user.id === challenged.id).hand.find(crd => crd.value === data.topCard.value) || data.users.find(user => user.id === challenged.id).hand.find(crd => crd.color === data.topCard.color)) {
                        type = "normal";
                        challengeWIN = true;
                        let newCards = this.createCards(message, 6, false);
                        newCards.forEach(c => {
                            data.users.find(user => user.id === challenged.id).hand.push(c);
                        });

                        challenged.send(data.users.find(u => u.id === user.id).hand.map(c => c.name).join(" - "));
                        message.channel.send(`${message.author.tag} just played a ${card.name} on ${challenger.tag} and lost the challege! ${challenged.tag} drew 6 cards. It is now ${challenger.tag}'s turn!`);

                    } else {
                        type = "skip";
                        challengeWIN = false;
                        let newCards = this.createCards(message, 6, false);
                        newCards.forEach(c => {
                            data.users.find(user => user.id === challenger.id).hand.push(c);
                        });

                        challenger.send(data.users.find(u => u.id === user.id).hand.map(c => c.name).join(" - "));
                        message.channel.send(`${message.author.tag} just played a ${card.name} on ${challenger.tag} and won the challenge! ${challenger.tag} drew 6 cards. It is now ${nextTurnUser.tag}'s turn!`);
                    }
                } else {
                    type = "skip";
                    challengeWIN = null;
                    let newCards = this.createCards(message, 4, false);
                    newCards.forEach(c => {
                        data.users[nextUser].hand.push(c);
                    });

                    const userToSend =  this.client.users.cache.get(data.users[nextUser].id)
                    userToSend.send(data.users[nextUser].hand.map(c => c.name).join(" - "));   
                    message.channel.send(`${message.author.tag} just played a ${card.name} on ${challenger.tag}. ${challenger.tag} decided not to challenge... They drew 4 cards and it is now ${nextTurnUser.tag}'s turn.`); 
                }

            } else { // Still need to do responses for the Draw Four
                const nextTurnUser = message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).user;
                type = "skip";
                let newCards = this.createCards(message, 4, false);
                newCards.forEach(c => {
                    data.users[nextUser].hand.push(c);
                });
    
                const userToSend = this.client.users.cache.get(data.users[nextUser].id)
                userToSend.send(data.users[nextUser].hand.map(c => c.name).join(" - "));
                message.channel.send(`${message.author.tag} just played a ${card.name} on ${userToSend.tag} and ${userToSend.tag} drew 4 cards. It is now ${nextTurnUser.tag}'s turn.`);
    
            }


        } else if (card.name.toLowerCase() === "wild") { // Done
            type = "normal";
            special = true;

            let color: "green" | "red" | "blue" | "yellow";
            const msg = await message.channel.send(`${message.author}, which color would you like to switch to? \🔴, \🟢, \🔵, or \🟡. You have 30 seconds to respond.`)
    
            const filter = (reaction: MessageReaction, user: User) => {
                if (user.bot) return;
                if (user.id !== message.author.id) return;
                return (["🔴", "🟢", "🔵", "🟡"].includes(reaction.emoji.name) && user.id === message.author.id);
            };
    
            await Promise.all([msg.react("🟢"), msg.react("🔴"), msg.react("🔵"), msg.react("🟡"), ])
    
            let collected = await msg.awaitReactions(filter, { max: 1, time: 30000 })
            const reaction = collected.first();
            if (reaction !== undefined) {
                if (reaction.emoji.name === '🟢') {
                    color = 'green'
                } else if (reaction.emoji.name === '🔴') {
                    color = 'red'
                } else if (reaction.emoji.name === '🔵') {
                    color = 'blue'
                } else if (reaction.emoji.name === '🟡') {
                    color = 'yellow'
                }
            }
    
            const colors = { 1: "green", 2: "red", 3: "blue", 4: "yellow" };
            if (!color) {
                const math = <1 | 2 | 3 | 4>(Math.floor(Math.random() * 4) + 1);
                color = <"green" | "red" | "blue" | "yellow">(colors[math]);
            } 

            data.topCard.color = color;

            message.channel.send(`${message.author.tag} played a ${card.name} and switched the color to ${color}. It is now ${message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.tag}'s turn`);

        } else if (card.name.toLowerCase().includes("reverse")) { // Done
            special = true;
            
            if (data.users.length === 2) type = "skip";
            else type = "normal";

            settings.reverse = !settings.reverse;
            message.channel.send(`${message.author.tag} played a ${card.name}. It is now ${this.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, type, settings, data)].id).tag}'s turn`);
            
        } else if (card.name.toLowerCase().includes("skip")) { // Done
            type = "skip";
            special = true;
            message.channel.send(`${message.author.tag} skipped ${this.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).tag} with a ${card.name}. It is now ${this.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).tag}'s turn!`);
        } else if (card.name.toLowerCase().includes("zero")) { // Done
            if (settings.zero) {
                type = "normal";
                special = true;


                const userCount = data.users.length;
                const reverse = settings.reverse;
                const tempHand = [];
                if (reverse) {
                    for (let i = userCount - 1; i >= 0; i--) {
                        tempHand.push(data.users[i].hand);
                        if (tempHand.length > 1) {
                            const toSet = tempHand.shift();
                            data.users[i].hand = toSet;
                        }

                        if (i === 0) {
                            const toSet = tempHand.pop();
                            data.users[userCount - 1].hand = toSet;
                        }
                    }
                } else {
                    for (let i = 0; i < userCount; i++) {
                        tempHand.push(data.users[i].hand);
                        if (tempHand.length > 1) {
                            const toSet = tempHand.shift();
                            data.users[i].hand = toSet;
                        }

                        if (i === userCount - 1) {
                            const toSet = tempHand.pop();
                            data.users[0].hand = toSet;
                        }
                    }
                }

                for (const u of data.users) {
                    const nUser = message.guild.members.cache.get(u.id);
                    nUser.send(`${message.author} played a ${card.name}. Your new hand has ${u.hand.length} cards.\n\n${u.hand.map(c => c.name).join(" | ")}.`);
                }

                message.channel.send(`${message.author.tag} played a ${card.name}. Everyone rotated their hand ${settings.reverse ? "counter clock-wise" : "clock-wise"}. It is now ${message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.tag}'s turn.`);
            }
        } else if (card.name.toLowerCase().includes("seven")) { // Not Done
            type = "normal";
            special = true;
        } else if (card.name.toLowerCase().includes("draw two")) { // Done
            type = "skip";
            special = true;

            const newCards = this.createCards(message, 2, false);

            const skippedUser = data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)];

            newCards.forEach(c => skippedUser.hand.push(c));

            message.guild.members.cache.get(skippedUser.id).send(``);

            message.channel.send(`${message.author.tag} played a ${card.name} on ${this.client.users.cache.get(skippedUser.id).tag}. They drew two cards and it is now ${this.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).tag}'s turn!`);

        }

        if (special) {
            data.currentPlayer = this.nextTurn(data.currentPlayer, type, settings, data);
            console.log(data.topCard);
            this.settings.set(message.guild.id, settings);
            this.storage.set(message.channel.id, data);
        }

        return special;
    }

    private returnCards (message: Message, cards: Card[]): void {
        const gameCards = this.gameCards.get(message.channel.id);
        for (const card of cards) {
            let userdCard;
            switch (card.color) {
                case "red":
                    userdCard = gameCards.red.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "yellow":
                    userdCard = gameCards.yellow.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "blue":
                    userdCard = gameCards.blue.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case "green":
                    userdCard = gameCards.green.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
                case null:
                    userdCard = gameCards.wild.find(c => c.name === card.name);
                    userdCard.inPlay -= 1;
                break;
            }
        }
    }

    private createCards(message: Message, amount: number, topCard: boolean) {
        if (!topCard) topCard = false;
        let counter = 0;
        let cardHand: Card[] = [];
        let cards = this.gameCards.get(message.channel.id);
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
                    const yellowCard = (): void => {
                        const tempMath = Math.floor(Math.random() * cards.yellow.length);
                        if (cards.yellow[tempMath].inPlay >= cards.yellow[tempMath].count) return yellowCard();
                        cardHand.push(cards.yellow[tempMath])
                        cards.yellow[tempMath].inPlay += 1;
                    }
                    yellowCard();
                break;
                case 2:
                    const redCard = (): void => {
                        const tempMath2 = Math.floor(Math.random() * cards.red.length);
                        if (cards.red[tempMath2].inPlay >= cards.red[tempMath2].count) return redCard();
                        cardHand.push(cards.red[tempMath2]);
                        cards.red[tempMath2].inPlay += 1;
                    }
                    redCard();
                break;
                case 3:
                    const greenCard = (): void => {
                        const tempMath3 = Math.floor(Math.random() * cards.green.length);
                        if (cards.green[tempMath3].inPlay >= cards.green[tempMath3].count) return greenCard();
                        cardHand.push(cards.green[tempMath3]);
                        cards.green[tempMath3].inPlay += 1;
                    }
                    greenCard();
                break;
                case 4:
                    const blueCard = (): void => {
                        const tempMath4 = Math.floor(Math.random() * cards.blue.length);
                        if (cards.blue[tempMath4].inPlay >= cards.blue[tempMath4].count) return blueCard();
                        cardHand.push(cards.blue[tempMath4]);
                        cards.blue[tempMath4].inPlay += 1;
                    }
                    blueCard();
                break;
                case 5:
                    const wildCard = (): void => {
                        const tempMath5 = Math.floor(Math.random() * cards.wild.length);
                        if (cards.wild[tempMath5].inPlay >= cards.wild[tempMath5].count) return wildCard();
                        cardHand.push(<Card>cards.wild[tempMath5]);
                        cards.wild[tempMath5].inPlay += 1;
                    }
                    wildCard();
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