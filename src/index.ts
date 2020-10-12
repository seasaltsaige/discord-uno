import Canvas from "canvas";
import { Collection, ColorResolvable, DMChannel, Message, MessageAttachment, MessageEmbed, MessageReaction, Snowflake, TextChannel, User } from "discord.js";
import { cards as gameCardsArray } from "./data/Cards";
import Card from "./data/interfaces/Card.interface";
import GameData from "./data/interfaces/GameData.interface";
import Settings from "./data/interfaces/Settings.interface";
import Player from "./data/interfaces/User.interface";
import Winners from "./data/interfaces/Winners.interface";
import axios from "axios";

const NPMPackage = require("./package.json");

export class DiscordUNO {
    constructor(
        public embedColor?: ColorResolvable,
        private storage = new Collection<Snowflake, GameData>(), 
        private gameCards = new Collection<Snowflake, typeof gameCardsArray>(),
        private settings = new Collection<Snowflake, Settings>(),
        private winners = new Collection<Snowflake, Winners[]>(),
        public version = {
            current: NPMPackage.version,
            updates: async function(message?: Message) {
                const repsonse = await axios.get("https://registry.npmjs.org/discord-uno");
                const data = repsonse.data;
                const latest = data["dist-tags"].latest.split(".");
                const curr = NPMPackage.version.split(".");
                let update = false;
                if (parseInt(latest[0]) > parseInt(curr[0])) update = true;
                else if (parseInt(latest[1]) > parseInt(curr[1])) update = true;
                else if (parseInt(latest[2]) > parseInt(curr[2])) update = true;
                if (message) {
                    if (update) return message.channel.send("There is an update availiable! Consider checking it out!");
                    else return message.channel.send("You are up to date!");
                } else {
                    if (update) return "There is an update availiable for discord-uno! Consider checking it out!"
                }
            }
        }
    ) { if (!this.embedColor) this.embedColor = "#FF0000" };
    

    /**
     * To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).
     */
    public async createGame(message: Message): Promise<Message> {
        if (!this.settings.get(message.channel.id)) {
            this.settings.set(message.channel.id, {
                jumpIns: false,
                reverse: false,
                seven: false,
                stacking: false,
                wildChallenge: false,
                zero: false,
            });
        }

        if (!this.winners.get(message.channel.id)) {
            this.winners.set(message.channel.id, []);
        }

        this.gameCards.set(message.channel.id, gameCardsArray);

        if (this.storage.get(message.channel.id)) return message.channel.send("There is already a game going on in this channel. Please join that one instead or create a new game in another channel.");
        this.storage.set(message.channel.id, {
            guild: message.guild.id,
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

        const Embed = new MessageEmbed()
            .setColor(this.embedColor)
            .setAuthor(`${message.author.tag} created an UNO! game! You can now join the game!`, message.author.displayAvatarURL({ format: "png" }));
        return message.channel.send("", { embed: Embed });
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
            hand: this.createCards(message, 7, false),  // FRIKEN REMOVE THIS WHEN DONE TESTING PLEASE
            safe: false,
        });
        
        if (foundGame.users.length === 10) {
            foundGame.active = true;
            this.storage.set(message.channel.id, foundGame);
    
            for (const user of foundGame.users) {
                const userHand = user.hand;
                const userOb = message.client.users.cache.get(user.id);

                const Embed = new MessageEmbed()
                    .setDescription(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`)
                    .setColor(this.embedColor)
                    .setAuthor(userOb.username, userOb.displayAvatarURL({ format: "png" }));
                const m = await userOb.send("", { embed: Embed });
                user.DM = { channelId: m.channel.id, messageId: m.id };
            };

            const Embed = new MessageEmbed()
                .setColor(this.embedColor)
                .setDescription(`**Top Card:** ${foundGame.topCard.name}`)
                .setFooter(`Current Player: ${(<User>message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`);
            return message.channel.send("", { embed: Embed });
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
            const reaction = response.first();
            if (reaction.emoji.name === "✅") {
                const userHand = foundGame.users.find(user => user.id === message.author.id).hand;
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
        if (!foundGame.active) return message.channel.send("This game hasn't started yet, you can't do that in a game that hasn't started yet!");
        const userHand = foundGame.users.find(user => user.id === message.author.id).hand;
        
        const Embed = new MessageEmbed()
            .setColor(this.embedColor)
            .setDescription(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`)
            .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }));
        const authorChannel = <DMChannel>message.client.channels.cache.get(foundGame.users.find(u => u.id === message.author.id).DM.channelId);
        const authorMsg = authorChannel.messages.cache.get(foundGame.users.find(u => u.id === message.author.id).DM.messageId);

        message.channel.send(`${message.author}, check your DMs!`);
        return authorMsg.edit("", { embed: Embed });
    }

    /**
     * To manually start the game, call the startGame() method. This method accepts one parameter, which is the message object. This method will only work if the game has at least two users entered. Otherwise it will return. On success this method will send each user their cards and a starting message to the game channel.
     */
    public async startGame(message: Message): Promise<Message> {
        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game going on in this channel to start. Try creating one instead.");

        if (foundGame.creator !== message.author.id) return message.channel.send("Only the creator of the game can force start the game.");
        if (foundGame.users.length < 2) return message.channel.send("Please wait for at least 2 players before trying to start the game.");
        if (foundGame.active) return message.channel.send("You can't start an already active game.");

        foundGame.active = true;
        this.storage.set(message.channel.id, foundGame);

        for (const user of foundGame.users) {
            const userHand = user.hand;
            const userOb = message.client.users.cache.get(user.id);

            const Embed = new MessageEmbed()
                .setDescription(`Your current hand has ${userHand.length} cards. The cards are\n${userHand.map(data => data.name).join(" | ")}`)
                .setColor(this.embedColor)
                .setAuthor(userOb.username, userOb.displayAvatarURL({ format: "png" }));
            const m = await userOb.send("", { embed: Embed });
            user.DM = { channelId: m.channel.id, messageId: m.id };
        };

        const Embed = new MessageEmbed()
            .setColor(this.embedColor)
            .setDescription(`**Top Card:** ${foundGame.topCard.name}`)
            .setFooter(`Current Player: ${(<User>message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id)).tag}`);
        return message.channel.send("", { embed: Embed });
    }
    /**
     * To play a card in your hand, call the playCard() method. This method accepts one parameter, which is the message object. This method will handle playing the card called. On success, it will remove the card from their hand and replace the top card. On fail it will return.
     */
    public async playCard(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to play a card in! Try making a new game instead.");
        if (!foundGame.active) return message.channel.send("This game hasn't started yet, you can't do that in a game that hasn't started yet!");

        const settings = this.settings.get(message.channel.id);

        const user = foundGame.users.find(u => u.id === message.author.id);
        const card = message.content.split(" ").slice(1).join(" ");
        if (!card) return message.channel.send("Please provide a valid card.");

        const cardObject = user.hand.find(crd => crd.name.toLowerCase() === card.toLowerCase());

        if (!cardObject) return message.channel.send("You don't have that card in your hand!");
        
        let jumpedIn = false;
        if (settings.jumpIns) {
            if (cardObject.name === foundGame.topCard.name && foundGame.users[foundGame.currentPlayer].id !== message.author.id) {
                jumpedIn = true;
                foundGame.currentPlayer = foundGame.users.findIndex(u => u.id === message.author.id);
            } else if (cardObject.name !== foundGame.topCard.name && foundGame.users[foundGame.currentPlayer].id !== message.author.id) return message.channel.send("You can't jump in with that card...")
            else if (this.checkTop(foundGame.topCard, cardObject) && foundGame.users[foundGame.currentPlayer].id === message.author.id) jumpedIn = false;
        } else if (user.id !== message.author.id) return message.channel.send("Jump in's are disabled in this game, and it isn't your turn yet!");

        if (!this.checkTop(foundGame.topCard, cardObject) && jumpedIn === false) return message.channel.send(`You can't play that card! Either play a ${foundGame.topCard.value} Card or a ${foundGame.topCard.color} Card.`);



        const lastPlayer = foundGame.currentPlayer;
        foundGame.topCard = cardObject;

        foundGame.users[lastPlayer].hand.splice(foundGame.users[lastPlayer].hand.findIndex(crd => crd.name === cardObject.name), 1);

        foundGame.users[lastPlayer].safe = false;

        const special = await this.doSpecialCardAbility(message, cardObject, foundGame);

        if (!special) {
            foundGame.currentPlayer = this.nextTurn(foundGame.currentPlayer, "normal", settings, foundGame);
            this.storage.set(message.channel.id, foundGame);

            const Embed = new MessageEmbed()
                .setDescription(`${message.client.users.cache.get(foundGame.users[lastPlayer].id).tag} played a ${cardObject.name}. It is now ${message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).tag}'s turn.`)
                .setColor(this.embedColor)
                .setAuthor(message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).username, message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).displayAvatarURL({ format: "png" }));
            if (foundGame.users[lastPlayer].hand.length >= 1) message.channel.send("", { embed: Embed });
        }
        let gameLength = foundGame.users.length;
        for (let i = 0; i < gameLength; i++) {
            if (foundGame.users[i].hand.length < 1) {
                const winners = this.winners.get(message.channel.id);
                winners.push({ id: foundGame.users[i].id });
                this.winners.set(message.channel.id, winners);
                foundGame.users.splice(foundGame.users.findIndex(u => u.id === foundGame.users[i].id), 1);
                i--;
                gameLength--;
                const Embed = new MessageEmbed()
                    .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
                    .setColor(this.embedColor)
                    .setDescription(`${message.author} went out with 0 cards! It is now ${message.client.users.cache.get(foundGame.users[foundGame.currentPlayer].id).tag}'s turn!`);
                if (foundGame.users.length > 1) return message.channel.send("", { embed: Embed });
                else {
                    winners.push({ id: foundGame.users[i].id });
                    this.winners.set(message.channel.id, winners);
                    foundGame.users.splice(foundGame.users.findIndex(u => u.id === foundGame.users[i].id), 1);
                    const attach = new MessageAttachment(await this.displayWinners(message, winners), "Winners.png");
                    Embed.setAuthor(message.client.user.username, message.client.user.displayAvatarURL({ format: "png" }))
                        .attachFiles([attach])
                        .setImage(`attachment://Winners.png`)
                        .setDescription(`${message.author} went out with 0 cards! There was only one person left in the game so scores have been calculated!`)
                    return message.channel.send("", { embed: Embed });

                }
            }
        }

        const channel = <DMChannel>message.client.channels.cache.get(foundGame.users[lastPlayer].DM.channelId);
        const msg = channel.messages.cache.get(foundGame.users[lastPlayer].DM.messageId);
        msg.channel.send(`${message.client.users.cache.get(foundGame.users[lastPlayer].id)}`).then(m => m.delete());
        const Embed = new MessageEmbed()
            .setColor(this.embedColor)
            .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            .setDescription(`Your new hand has ${foundGame.users[lastPlayer].hand.length} cards.\n${foundGame.users[lastPlayer].hand.map(crd => crd.name).join(" | ")}`);
        return msg.edit("", { embed: Embed });
    }
    /**
     * To view the current state of the game, call the viewTable() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image to the channel with all the current information of the game. Including rotation, whos turn it is, how many cards each user has, whos in the game, and the top card of the pile.
     */
    public async viewTable(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game currently in this channel! Try creating one instead.");
        if (foundGame.users.length < 2) return message.channel.send("There are too few players in the game to view the current table status!");
        const settings = this.settings.get(message.channel.id);

        Canvas.registerFont('./node_modules/discord-uno/src/data/assets/fonts/Manrope-Bold.ttf', {
            family: 'manropebold'
        });

        Canvas.registerFont('./node_modules/discord-uno/src/data/assets/fonts/Manrope-Regular.ttf', {
            family: 'manroperegular'
        });

        const canvas = Canvas.createCanvas(2000, 1000);
        const ctx = canvas.getContext("2d");

        const random = Math.floor(Math.random() * 5); // Random from 0 - 4
        const fileName = `Table_${random}.png`;
        const image = await Canvas.loadImage(`./node_modules/discord-uno/src/data/assets/cards/table/${fileName}`);

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const table = await Canvas.loadImage("./node_modules/discord-uno/src/data/assets/cards/table/UNO_Table.png");

        ctx.drawImage(table, (canvas.width / 4) - 100, (canvas.height / 3) - 100, (canvas.width / 2) + 200, (canvas.height / 3) + 200);


        const TopCard = await Canvas.loadImage(foundGame.topCard.image);
        ctx.drawImage(TopCard, canvas.width / 2 + 35, canvas.height / 2 - TopCard.height / 5, 120.75, 175);
    
    
        const bcard = await Canvas.loadImage("./node_modules/discord-uno/src/data/assets/cards/table/deck/Deck.png");
    
        let x1 = (canvas.width / 2) - (120.75 + 28)
        let y1 = ((canvas.height / 2) - (TopCard.height / 5)) + 2
        for (let i = 0; i < 3; i++) {
            ctx.drawImage(bcard, x1, y1, 120.75, 175);
            x1 += 12
            y1 -= 12
        }

        let x = 330;
        let y = canvas.height / 2;
        let counter = 0;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';

        for (let i = 0; i < foundGame.users.length; i++) {
            ctx.font = `40px manropebold`;
            ctx.save()

            ctx.beginPath();
            ctx.arc(x, y, 60, 0, 2 * Math.PI, true)
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.clip();
            const image = await Canvas.loadImage(message.guild.members.cache.get(foundGame.users[i].id).user.displayAvatarURL({ format: 'png' }));

            ctx.drawImage(image, x - image.width / 2 + 4, y - image.height / 2 + 4, 120, 120)
            ctx.closePath();
            ctx.restore();

            if (foundGame.users[i] && foundGame.users[i].id === foundGame.users[foundGame.currentPlayer].id) {
                ctx.fillStyle = '#ffffff';
                ctx.save();
                const crown = await Canvas.loadImage('https://discordapp.com/assets/98fe9cdec2bf8ded782a7bf1e302b664.svg');
                ctx.translate(x - crown.width / 2 + 87, y - crown.height / 2 - 103);
                ctx.rotate(42 * Math.PI / 180);
                ctx.drawImage(crown, -5, 20, 60, 60)
                ctx.restore();
            }
            if (counter < 5) {
                const cardImage = await Canvas.loadImage("./node_modules/discord-uno/src/data/assets/cards/table/deck/Deck.png");
                ctx.drawImage(cardImage, x - cardImage.width / 2 + 60, y - 40, 55.2, 80);
                ctx.font = `70px manropebold`;
                ctx.fillText(foundGame.users[i] ? foundGame.users[i].hand.length.toString() : "X", x - 180, y + 25)
            } else {
                const cardImage = await Canvas.loadImage("./node_modules/discord-uno/src/data/assets/cards/table/deck/Deck.png");
                ctx.drawImage(cardImage, x + cardImage.width / 2 - 60, y - 40, 55.2, 80);
                ctx.font = `70px manropebold`;
                ctx.fillText(foundGame.users[i] ? foundGame.users[i].hand.length.toString() : "X", x + 105, y + 25)
            }
            switch (counter) {
                case 0:
                    x = x + 150;
                    y = y - 300
                break;
                case 1:
                    x = x + 350
                    y = y - 30
                break;
                case 2:
                    x = x + 370
                    y = y;
                break;
                case 3:
                    x = x + 350
                    y = y + 30
                break;
                case 4:
                    x = x + 120
                    y = y + 300
                break;
                case 5:
                    x = x - 120
                    y = y + 300
                break;
                case 6:
                    x = x - 350
                    y = y + 30
                break;
                case 7:
                    x = x - 370
                    y = y;
                break;
                case 8:
                    x = x - 350
                    y = y - 30
                break;
            }
            counter++;
        }

        
            ctx.fillStyle = '#ffffff';
            ctx.font = `70px manropebold`;
            ctx.textAlign = "left";
            const width = ctx.measureText("Rotation: ").width;
            ctx.fillText("Rotation: ", canvas.width - 200 - width - 30, canvas.height - 50);
            const IMAGE = await Canvas.loadImage(settings.reverse ? './node_modules/discord-uno/src/data/assets/rotation/counter_clock-wise.png' : './node_modules/discord-uno/src/data/assets/rotation/clock-wise.png');
            ctx.drawImage(IMAGE, canvas.width - 200, canvas.height - 120, 100, 87.36);

            ctx.fillText(`Turn: `, 120, canvas.height - 50);
            ctx.fillStyle = '#ffffff';
            const WIDTH = ctx.measureText('Turn: ').width
            ctx.fillText(`${message.guild.members.cache.get(foundGame.users[foundGame.currentPlayer].id).user.username}`, WIDTH + 105 + 10, canvas.height - 50)

        return message.channel.send("Current Game State", { files: [
            new MessageAttachment(canvas.toBuffer("image/png")),
        ] });
    }
    /**
     * To end the game in its current state, call the endGame() method. This method accepts one parameter, which is the message object. This method will end the game in whatever the current state is. It will determine the winners based off of how many cards users have left in there hand, then it will return a message with the winners.
     */
    public async endGame(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game to end... Try making one instead!");
        if (foundGame.creator !== message.author.id) return message.channel.send("You can't end this game! Only the creator can end this game!");
        if (!foundGame.active) return message.channel.send("You can't end a game that hansn't started yet!");
        const foundWinners = this.winners.get(message.channel.id);

        const sortedUsers = foundGame.users.sort((a, b) => a.hand.length - b.hand.length);
        const length = sortedUsers.length;
        for (let i = 0; i < length; i++) {
            foundWinners.push({ id: sortedUsers[i].id });
        }
        foundGame.users = [];
        this.storage.set(message.channel.id, foundGame);
        this.winners.set(message.channel.id, foundWinners);

        const winnersImage = await this.displayWinners(message, foundWinners);

        this.storage.delete(message.channel.id);
        this.winners.delete(message.channel.id);
        
        return message.channel.send(`The game has been ended by ${message.author}! Scores have been calculated.`, { files: [
            new MessageAttachment(winnersImage),
        ] });
    }

    /**
     * To both protect yourself from UNO! Callouts or call someone else out for having one card left, call the UNO() method. This method accepts one parameter, which is the message object. This method will handle both protecting yourself from future UNO! callouts, and calling other users out that haven't been protected.
     */
    public UNO(message: Message): Promise<Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (!foundGame) return message.channel.send("There is no game in this channel to call people out in!");
        if (!foundGame.active) return message.channel.send("This game hasn't started yet, you can't do that in a game that hasn't started yet!");

        const user = message.mentions.users.first() || message.author;

        const Embed = new MessageEmbed()
            .setAuthor(user.username, user.displayAvatarURL({ format: "png" }))
            .setColor(this.embedColor)

        if (user.id === message.author.id) {
            if (foundGame.users.find(u => u.id === user.id).safe) return message.channel.send("You are already safe, did you mean to mention someone?");
            if (foundGame.users.find(u => u.id === user.id).hand.length > 1) return message.channel.send("You can't use this command when you have more than one card left in your hand!");
            foundGame.users.find(u => u.id === user.id).safe = true;
            this.storage.set(message.channel.id, foundGame);
            return message.channel.send(`${user.tag}, you are now safe!`);
        } else {
            if (user.bot) return message.channel.send("Bots can't play this game silly.");
            if (!foundGame.users.some(u => u.id === user.id)) return message.channel.send("That user isn't in the game silly.");
            const playerData = foundGame.users.find(u => u.id === user.id);
            const authorData = foundGame.users.find(u => u.id === message.author.id);

            const newCards = this.createCards(message, 2, false);

            if (playerData.safe) {
                return message.channel.send(`OOPS! Looks like that person was safe ${message.author}!`);
            } else {
                if (playerData.hand.length === 1) {
                    newCards.forEach(c => playerData.hand.push(c));
                    this.storage.set(message.channel.id, foundGame);
                    const channel = <DMChannel>message.client.channels.cache.get(foundGame.users.find(u => u.id === user.id).DM.channelId);
                    const msg = channel.messages.cache.get(foundGame.users.find(u => u.id === user.id).DM.messageId);
                    msg.channel.send(`${user}`).then(m => m.delete());
                    Embed.setDescription(`Looks like you were called out on 1 card left! You drew 2 cards. Your new hand has ${playerData.hand.length} cards.\n\n${playerData.hand.map(c => c.name).join(" | ")}`);
                    msg.edit("", { embed: Embed });
                    return message.channel.send(`${user.tag} was called out by ${message.author.tag} on 1 card left! They drew 2 more cards.`);
                } else {
                    newCards.forEach(c => authorData.hand.push(c));
                    this.storage.set(message.channel.id, foundGame);
                    const channel = <DMChannel>message.client.channels.cache.get(foundGame.users.find(u => u.id === user.id).DM.channelId);
                    const msg = channel.messages.cache.get(foundGame.users.find(u => u.id === user.id).DM.messageId);
                    msg.channel.send(`${user}`).then(m => m.delete());
                    Embed.setDescription(`Oops! Looks like that person didn't have 1 card left! You drew 2 cards. Your new hand has ${authorData.hand.length} cards.\n\n${authorData.hand.map(c => c.name).join(" | ")}`);
                    msg.edit("", { embed: Embed });
                    return message.channel.send(`OOPS! Looks like that person didn't have 1 card left! ${message.author.tag} drew 2 cards!`);
                }
            }
        }
    }

    /**
     * To view the current winners of the game (if there are any), call the viewWinners() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image identical to the one sent in the endGame() method. The only difference is this method can be called at any time to view the current standings of the game.
     */
    public async viewWinners(message: Message): Promise<Message> {
        const foundWinners = this.winners.get(message.channel.id);
        const foundGame = this.storage.get(message.channel.id);
        if (!foundWinners) return message.channel.send("There is no game in this channel to view the winners of!");
        if (foundWinners.length < 1) return message.channel.send("No one has gone out yet!");
        if (!foundGame.active) return message.channel.send("This game hasn't started yet. Please wait until it starts!");

        const standings = await this.displayWinners(message, foundWinners);

        return message.channel.send("Here are the current UNO! Game standings!", { files: [
            new MessageAttachment(standings),
        ] });
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
        this.winners.delete(message.channel.id);

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

        const channel = <DMChannel>message.client.channels.cache.get(foundGame.users[foundGame.currentPlayer].DM.channelId);
        const msg = channel.messages.cache.get(foundGame.users[foundGame.currentPlayer].DM.messageId);

        msg.channel.send(`${message.author}`).then(m => m.delete());

        const Embed = new MessageEmbed()
            .setColor(this.embedColor)
            .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            .setDescription(`You drew 1 card. Your new hand has ${foundGame.users[foundGame.currentPlayer].hand.length}.\n\n${foundGame.users[foundGame.currentPlayer].hand.map(c => c.name).join(" | ")}`)
        return msg.edit("", { embed: Embed });
    }

    /**
     * To update the servers UNO! settings, call the updateSettings() method. This method has one parameter, which is the Message object. This method handles updating the servers UNO! settings. (The settings are stored by Channel ID). It will send a message and react to the message, allowing you to change settings based on reactions.
     */
    public async updateSettings(message: Message): Promise<void | Message> {

        const foundGame = this.storage.get(message.channel.id);
        if (foundGame && foundGame.active) return message.channel.send("You can't change the settings during the game!");

        let foundSettings = this.settings.get(message.channel.id);
        if (!foundSettings) {
            this.settings.set(message.channel.id, {
                jumpIns: false,
                reverse: false,
                seven: false,
                stacking: false,
                wildChallenge: false,
                zero: false,
            });
            foundSettings = this.settings.get(message.channel.id);
        }

        let jumpIns = foundSettings.jumpIns;
        let seven = foundSettings.seven;
        let wildChallenge = foundSettings.wildChallenge;
        let zero = foundSettings.zero;

        const Embed = new MessageEmbed()
            .setDescription(`1️⃣ - **Jump Ins:** ${foundSettings.jumpIns ? "On" : "Off"}\n2️⃣ - **Seven Swap:** ${foundSettings.seven ? "On" : "Off"}\n3️⃣ - **Wild Challenging:** ${foundSettings.wildChallenge ? "On" : "Off"}\n4️⃣ - **Zero Rotation:** ${foundSettings.zero ? "On" : "Off"}\n\n✅ - Confirm\n❌ - Cancel`)
            .setColor(this.embedColor)
            .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }));
        const react = await message.channel.send("", { embed: Embed });

        const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "✅", "❌"];

        emojis.forEach(e => react.react(e));

        const filter = (reaction: MessageReaction, user: User) => emojis.includes(reaction.emoji.name) && message.author.id === user.id;

        const collector = react.createReactionCollector(filter);

        collector.on("collect", (reaction, user) => {
            switch (reaction.emoji.name) {
                case "1️⃣":
                    jumpIns = !jumpIns;
                break;
                case "2️⃣":
                    seven = !seven;
                break;
                case "3️⃣":
                    wildChallenge = !wildChallenge;
                break;
                case "4️⃣":
                    zero = !zero;
                break;
                case "✅":
                    this.settings.set(message.channel.id, {
                        jumpIns,
                        reverse: foundSettings.reverse,
                        seven,
                        stacking: foundSettings.stacking,
                        wildChallenge,
                        zero,
                    });
                    react.edit(`Successfully updated UNO! settings for **${(<TextChannel>message.channel).name}**`, { embed: null });
                    react.reactions.removeAll().catch(console.log);
                return collector.stop();
                case "❌":
                    react.edit("Cancelled.", { embed: null });
                    react.reactions.removeAll().catch(console.log);
                return collector.stop("Cancelled");
            }

            Embed.setDescription(`1️⃣ - **Jump Ins:** ${jumpIns ? "On" : "Off"}\n2️⃣ - **Seven Swap:** ${seven ? "On" : "Off"}\n3️⃣ - **Wild Challenging:** ${wildChallenge ? "On" : "Off"}\n4️⃣ - **Zero Rotation:** ${zero ? "On" : "Off"}\n\n✅ - Confirm\n❌ - Cancel`)


            // Embed.setDescription(`1️⃣ - **Jump Ins:** ${foundSettings.jumpIns ? "On" : "Off"}\n2️⃣ - **Seven Swap:** ${foundSettings.seven ? "On" : "Off"}\n3️⃣ - **Wild Challenging:** ${foundSettings.wildChallenge ? "On" : "Off"}\n4️⃣ - **Zero Rotation:** ${foundSettings.zero ? "On" : "Off"}\n\n✅ - Confirm\n❌ - Cancel`)
            react.edit("", { embed: Embed });
            reaction.users.remove(user.id);
        });
    }

    /**
     * To view the current servers UNO! settings, call the viewSettings() method. This method has one parameter, which is the Message object. This method will return a message showing which customizable settings have been turned on or off.
     */
    public viewSettings(message: Message): Promise<Message> {

        let foundSettings = this.settings.get(message.channel.id);
        if (!foundSettings) {
            this.settings.set(message.channel.id, {
                jumpIns: false,
                reverse: false,
                seven: false,
                stacking: false,
                wildChallenge: false,
                zero: false,
            });
            foundSettings = this.settings.get(message.channel.id);
        }

        const msg = `**Jump Ins:** ${foundSettings.jumpIns ? "On" : "Off"}\n**Seven Swap:** ${foundSettings.seven ? "On" : "Off"}\n**Wild Challenging:** ${foundSettings.wildChallenge ? "On" : "Off"}\n**Zero Rotation:** ${foundSettings.zero ? "On" : "Off"}`;

        return message.channel.send(msg);
    }


    // Public Methods Above
    // Private Methods Below


    private checkTop(topCard: Card, playedCard: Card): boolean {
        if ((topCard.color === playedCard.color || topCard.value === playedCard.value || playedCard.value === 'Wild' || playedCard.value === 'Wild Draw Four')) return true;
        else return false;
    }

    private async doSpecialCardAbility(message: Message, card: Card, data: GameData): Promise<boolean> {

        let special = false;
        const settings = this.settings.get(message.channel.id);
        let type: "normal" | "skip";

        const authorChannel = <DMChannel>message.client.channels.cache.get(data.users.find(u => u.id === message.author.id).DM.channelId);
        const authorMsg = authorChannel.messages.cache.get(data.users.find(u => u.id === message.author.id).DM.messageId);

        const nextUserChannel = <DMChannel>message.client.channels.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].DM.channelId);
        const nextUserMsg = nextUserChannel.messages.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].DM.messageId);

        // const skipNextUserChannel = <DMChannel>message.client.channels.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].DM.channelId)
        // const skipNextUserMsg = skipNextUserChannel.messages.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].DM.messageId);

        const Embed = new MessageEmbed()
            .setColor(this.embedColor);


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

            const user = message.client.users.cache.get(data.users[nextUser].id)

            let challenge = false;
            if (settings.wildChallenge) {

                const ChallEmbed = new MessageEmbed()
                    .setColor(this.embedColor)
                    .setDescription(`${message.author.tag} has played a Wild Draw Four, ${user}, would you like to challenge this? If they had another card they could have played, they draw 6 instead, otherwise, you draw 6. If you decide not to challenge, you draw the normal 4 cards.`)
                    .setAuthor(user.username, user.displayAvatarURL({ format: "png" }));

                let msg = await message.channel.send("", ChallEmbed);
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

                        Embed.setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
                        .setDescription(`You've been caught! You drew 6 cards.\n\n${data.users.find(u => u.id === user.id).hand.map(c => c.name).join(" - ")}`);

                        authorMsg.edit("", { embed: Embed });
                        authorMsg.channel.send("Attention.").then(m => m.delete());

                        ChallEmbed.setDescription(`${message.author.tag} just played a ${card.name} on ${challenger.tag} and lost the challege! ${challenged.tag} drew 6 cards. It is now ${challenger.tag}'s turn!`)
                        msg.edit("", { embed: ChallEmbed });

                    } else {
                        type = "skip";
                        challengeWIN = false;
                        let newCards = this.createCards(message, 6, false);
                        newCards.forEach(c => {
                            data.users.find(user => user.id === challenger.id).hand.push(c);
                        });

                        Embed.setAuthor(challenger.username, challenger.displayAvatarURL({ format: "png" }))
                        .setDescription(`Looks like you lost the challenge! You drew 6 cards.\n\n${data.users.find(u => u.id === user.id).hand.map(c => c.name).join(" - ")}`)

                        nextUserMsg.edit("", { embed: Embed });
                        nextUserMsg.channel.send("Attention.").then(m => m.delete());

                        ChallEmbed.setDescription(`${message.author.tag} just played a ${card.name} on ${challenger.tag} and won the challenge! ${challenger.tag} drew 6 cards. It is now ${nextTurnUser.tag}'s turn!`);
                        msg.edit("", { embed: ChallEmbed });
                    }
                } else {
                    type = "skip";
                    challengeWIN = null;
                    let newCards = this.createCards(message, 4, false);
                    newCards.forEach(c => {
                        data.users[nextUser].hand.push(c);
                    });
                    const userToSend = message.client.users.cache.get(data.users[nextUser].id);

                    Embed.setAuthor(userToSend.username, userToSend.displayAvatarURL({ format: "png" }))
                    .setDescription(`Looks like you decided not to challenge. You drew 4 cards.\n\n${data.users[nextUser].hand.map(c => c.name).join(" - ")}`)

                    nextUserMsg.edit("", { embed: Embed });
                    nextUserMsg.channel.send(`${userToSend}`).then(m => m.delete());

                    ChallEmbed.setDescription(`${message.author.tag} just played a ${card.name} on ${challenger.tag}. ${challenger.tag} decided not to challenge... They drew 4 cards and it is now ${nextTurnUser.tag}'s turn.`)
                    msg.edit("", { embed: ChallEmbed });
                }

            } else {
                const nextTurnUser = message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).user;
                type = "skip";
                let newCards = this.createCards(message, 4, false);
                newCards.forEach(c => {
                    data.users[nextUser].hand.push(c);
                });
    
                const userToSend = message.client.users.cache.get(data.users[nextUser].id);

                Embed.setAuthor(userToSend.username, userToSend.displayAvatarURL({ format: "png" }))
                .setDescription(`Looks like you decided not to challenge. You drew 4 cards.\n\n${data.users[nextUser].hand.map(c => c.name).join(" - ")}`)

                nextUserMsg.edit("", { embed: Embed });
                nextUserMsg.channel.send(`${userToSend}`).then(m => m.delete());

                const RegEmbed = new MessageEmbed()
                    .setDescription(`${message.author.tag} just played a ${card.name} on ${userToSend.tag} and ${userToSend.tag} drew 4 cards. It is now ${nextTurnUser.tag}'s turn.`)
                    .setColor(this.embedColor)
                    .setAuthor(user.username, user.displayAvatarURL({ format: "png" }));
                message.channel.send("", { embed: RegEmbed });
            }


        } else if (card.name.toLowerCase() === "wild") { // Done
            type = "normal";
            special = true;

            let color: "green" | "red" | "blue" | "yellow";

            const EmMsg = new MessageEmbed()
                .setDescription(`${message.author}, which color would you like to switch to? \🔴, \🟢, \🔵, or \🟡. You have 30 seconds to respond.`)
                .setColor(this.embedColor)
                .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            const msg = await message.channel.send("", { embed: EmMsg });
    
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

            Embed.setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            .setDescription(`You played a Wild and changed the color to ${color}.\n\n${data.users.find(u => u.id === message.author.id).hand.map(c => c.name).join(" | ")}`)

            authorMsg.edit("", { embed: Embed });
            authorMsg.channel.send("Attention.").then(m => m.delete());

            const MsgEmbed = new MessageEmbed()
                .setDescription(`${message.author.tag} played a ${card.name} and switched the color to ${color}. It is now ${message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.tag}'s turn`)
                .setColor(this.embedColor)
                .setAuthor(message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.username, message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.displayAvatarURL({ format: "png" }));
            msg.edit("", { embed: MsgEmbed });

        } else if (card.name.toLowerCase().includes("reverse")) { // Done
            special = true;
            settings.reverse = !settings.reverse;

            if (data.users.length === 2) type = "skip";
            else type = "normal";

            authorMsg.channel.send("Attention.").then(m => m.delete());

            Embed.setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            .setDescription(`You played a ${card.name}. You now have ${data.users.find(u => u.id === message.author.id).hand.length} cards.\n\n${data.users.find(u => u.id === message.author.id).hand.map(c => c.name).join(" | ")}`)

            authorMsg.edit("", { embed: Embed });

            const MsgEmbed = new MessageEmbed()
                .setDescription(`${message.author.tag} played a ${card.name}. It is now ${message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, type, settings, data)].id).tag}'s turn`)
                .setAuthor(message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, type, settings, data)].id).username, message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, type, settings, data)].id).displayAvatarURL({ format: "png" }))
                .setColor(this.embedColor);
            message.channel.send("", { embed: MsgEmbed });
            
        } else if (card.name.toLowerCase().includes("skip")) { // Done
            type = "skip";
            special = true;
            authorMsg.channel.send("Attention.").then(m => m.delete());
            Embed.setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }))
            .setDescription(`You played a ${card.name}. You now have ${data.users.find(u => u.id === message.author.id).hand.length} cards.\n\n${data.users.find(u => u.id === message.author.id).hand.map(c => c.name).join(" | ")}`);

            authorMsg.edit("", { embed: Embed });

            const SendEmbed = new MessageEmbed()
                .setDescription(`${message.author.tag} skipped ${message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).tag} with a ${card.name}. It is now ${message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).tag}'s turn!`)
                .setAuthor(message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).username, message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).displayAvatarURL({ format: "png" }))
                .setColor(this.embedColor);
            message.channel.send("", { embed: SendEmbed });
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
                    const uChannel = <DMChannel>message.client.channels.cache.get(u.DM.channelId);
                    const uMsg = uChannel.messages.cache.get(u.DM.messageId);
                    uChannel.send("Attention.").then(m => m.delete());

                    Embed.setAuthor(message.client.users.cache.get(u.id).username, message.client.users.cache.get(u.id).displayAvatarURL({ format: "png" }))
                        .setDescription(`${message.author} played a ${card.name}. Your new hand has ${u.hand.length} cards.\n\n${u.hand.map(c => c.name).join(" | ")}.`)
                    uMsg.edit("", { embed: Embed });
                }

                const SendMessage = new MessageEmbed()
                    .setDescription(`${message.author.tag} played a ${card.name}. Everyone rotated their hand ${settings.reverse ? "counter clock-wise" : "clock-wise"}. It is now ${message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.tag}'s turn.`)
                    .setColor(this.embedColor)
                    .setAuthor(message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.username, message.guild.members.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).user.displayAvatarURL({ format: "png" }));
                message.channel.send("", { embed: SendMessage });
            }
        } else if (card.name.toLowerCase().includes("seven")) { // Done
            if (settings.seven) {
                type = "normal";
                special = true;

                const players = data.users.length;
                let reactions: Array<string>;
                const playerEmojis = { 
                    "2": ['1️⃣'], 
                    "3": ['1️⃣', '2️⃣'], 
                    "4": ['1️⃣', '2️⃣', '3️⃣'], 
                    "5": ['1️⃣', '2️⃣', '3️⃣', '4️⃣'], 
                    "6": ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'], 
                    "7": ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'], 
                    "8": ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'], 
                    "9": ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'], 
                    "10": ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
                };

                for (const string of Object.keys(playerEmojis)) {
                    if (parseInt(string) === players) {
                        //@ts-ignore
                        reactions = playerEmojis[string];
                    }
                };

                const dataToChooseFrom = data.users.filter(user => user.id !== message.author.id);


                const numbers = {  "0": "1️⃣", "1": "2️⃣", "2": "3️⃣", "3": "4️⃣", "4": "5️⃣", "5": "6️⃣", "6": "7️⃣", "7": "8️⃣", "8": "9️⃣" }
                //@ts-ignore
                const desciption = dataToChooseFrom.map(user => `${numbers[(dataToChooseFrom.findIndex(u => u.id === user.id) + 1).toString()]} - ${message.guild.members.cache.get(user.id).user.tag} has ${user.hand.length} cards`).join("\n");
                const EmbedMsg = new MessageEmbed()
                    .setDescription(`${message.author} who would you like to swap cards with?\n\n${desciption}`)
                    .setColor(this.embedColor)
                    .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }));
                const msg = await message.channel.send("", { embed: EmbedMsg });

                const filter = (reaction: MessageReaction, user: User) => reactions.includes(reaction.emoji.name) && message.author.id === user.id;

                reactions.forEach(e => {
                    msg.react(e);
                });

                const response = await msg.awaitReactions(filter, { max: 1 });
                const reaction = response.first();
                let swapToUser: Player;
                const emojis = { "1️⃣": 0, "2️⃣": 1, "3️⃣": 2, "4️⃣": 3, "5️⃣": 4, "6️⃣": 5, "7️⃣": 6, "8️⃣": 7, "9️⃣": 8 };
                if (reaction) {
                    const emoji = reaction.emoji.name;
                    //@ts-ignore
                    const num = <number>emojis[emoji];
                    swapToUser = dataToChooseFrom[num];
                } else {
                    const math = Math.floor(Math.random() * dataToChooseFrom.length) + 1;
                    swapToUser = dataToChooseFrom[math];
                }

                const authorHand = data.users.find(user => user.id === message.author.id).hand;
                const authorId = message.author.id;

                const toSwapHand = data.users.find(user => user.id === swapToUser.id).hand;
                const toSwapToId = swapToUser.id;

                const author = message.author;
                const user = message.guild.members.cache.get(swapToUser.id).user;

                data.users.find(user => user.id === authorId).hand = toSwapHand;
                data.users.find(u => u.id === toSwapToId).hand = authorHand;

                Embed.setDescription(`You swapped hands with ${user}! You now have ${data.users.find(u => u.id === author.id).hand.length} cards!\n\n${data.users.find(u => u.id === author.id).hand.map(c => c.name).join(" | ")}`)
                .setAuthor(message.author.username, message.author.displayAvatarURL({ format: "png" }));

                authorMsg.edit("", Embed);
                authorChannel.send("Attention.").then(m => m.delete());

                const userChannel = <DMChannel>message.client.channels.cache.get(data.users.find(u => u.id === user.id).DM.channelId);
                const userMsg = userChannel.messages.cache.get(data.users.find(u => u.id === user.id).DM.messageId);

                Embed.setDescription(`${author} swapped hands with you! You now have ${data.users.find(u => u.id === user.id).hand.length} cards!\n\n${data.users.find(u => u.id === user.id).hand.map(c => c.name).join(" | ")}`)
                .setAuthor(user.username, user.displayAvatarURL({ format: "png" }));

                userChannel.send("Attention.").then(m => m.delete());
                userMsg.edit("", { embed: Embed });

                EmbedMsg.setDescription(`${message.author} swapped hands with ${user}! It is now ${message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id)}'s turn!`)
                .setAuthor(message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).username, message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)].id).displayAvatarURL({ format: "png" }));
                msg.edit("", { embed: EmbedMsg }).then(m => m.reactions.removeAll());
            }
        } else if (card.name.toLowerCase().includes("draw two")) { // Done
            type = "skip";
            special = true;

            const newCards = this.createCards(message, 2, false);

            const skippedUser = data.users[this.nextTurn(data.currentPlayer, "normal", settings, data)];

            newCards.forEach(c => skippedUser.hand.push(c));

            Embed.setDescription(`${message.author} played a ${card.name}. You drew 2 cards. Your new hand has ${skippedUser.hand.length} cards.\n\n${skippedUser.hand.map(c => c.name).join(" | ")}`)
                .setAuthor(message.client.users.cache.get(skippedUser.id).username, message.client.users.cache.get(skippedUser.id).displayAvatarURL({ format: "png" }));
            nextUserMsg.edit("", { embed: Embed });
            nextUserChannel.send("Attention.").then(m => m.delete());
            const SendEmbed = new MessageEmbed()
                .setAuthor(message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).username, message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).displayAvatarURL({ format: "png" }))
                .setColor(this.embedColor)
                .setDescription(`${message.author.tag} played a ${card.name} on ${message.client.users.cache.get(skippedUser.id).tag}. They drew two cards and it is now ${message.client.users.cache.get(data.users[this.nextTurn(data.currentPlayer, "skip", settings, data)].id).tag}'s turn!`)
            message.channel.send("", { embed: SendEmbed });

        }

        if (special) {
            if (data.users[data.currentPlayer].hand.length < 1) type = "normal";
            data.currentPlayer = this.nextTurn(data.currentPlayer, type, settings, data);
            this.settings.set(message.channel.id, settings);
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
                return (storage.users.length == 2 ? player : settings.reverse ? (player - 2) < 0 ? storage.users.length - 2 : player - 2 : (player + 2) > storage.users.length - 1 ? 0 : (player + 2) > storage.users.length ? 1 : player + 2); 
        };
    }
    private async displayWinners(message: Message, foundWinners: Winners[]): Promise<Buffer> {
        const canvas = Canvas.createCanvas(700, 500);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#282a2c";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2e3033";
        ctx.fillRect(0, 0, canvas.width, 25);
        ctx.fillRect(0, 0, 25, canvas.height);
        ctx.fillRect(canvas.width - 25, 0, canvas.width, canvas.height);
        ctx.fillRect(0, canvas.height - 25, canvas.width, canvas.height);

        const podium = await Canvas.loadImage("./node_modules/discord-uno/src/data/assets/podium/podium.png");
        ctx.drawImage(podium, canvas.width / 7 + 5, canvas.height / 2 - 50, 500, 190);

        ctx.strokeStyle = '#282a2c';

        let x1 = 110;
        ctx.font = '15px manropebold';

        for (let i = 0; i < foundWinners.length; i++) {
            const winner = foundWinners[i];
            const avatarURL = message.guild.members.cache.get(winner.id).user.displayAvatarURL({ format: 'png' });
            const avatar = await Canvas.loadImage(avatarURL);

            ctx.save();
        switch (i) {
            case 0:
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 - 100, 50, 0, 2 * Math.PI, true);
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(avatar, canvas.width / 2 - 50, canvas.height / 2 - 150, 100, 100);
                ctx.closePath();
            break;
            case 1:
                ctx.beginPath();
                ctx.arc((355 / 2) + 20, canvas.height / 2 - 50, 50, 0, 2 * Math.PI, true);
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(avatar, (355 / 2) + 20 - 50, canvas.height / 2 - 100, 100, 100)
                ctx.closePath();
            break;
            case 2:
                ctx.beginPath();
                ctx.arc((canvas.width / 2) + (355 / 2) - 20, canvas.height / 2 - 35, 50, 0, 2 * Math.PI, true);
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(avatar, (canvas.width / 2) + (355 / 2) - 20 - 50, canvas.height / 2 - 35 - 50, 100, 100);
                ctx.closePath();
            break;
            default:
                const placement = i === 3 ? '4th' : i === 4 ? '5th' : i === 5 ? '6th' : i === 6 ? '7th' : i === 7 ? '8th' : i === 8 ? '9th' : '10th'
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.textAlign = 'center';
                ctx.fillText(placement, x1, canvas.height - 70 - 25);
                ctx.arc(x1, canvas.height - 60, 25, 0, Math.PI * 2, true);
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(avatar, x1 - 25, canvas.height - 60 - 25, 50, 50);
                ctx.closePath();
                x1 += 80;
            break;
        }
        ctx.restore();

        }
        return canvas.toBuffer("image/png");
    }
}

module.exports.DiscordUNO = DiscordUNO;