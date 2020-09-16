# What is discord-uno?
Discord-UNO is meant to be an easy to use, fast, and efficient way to create and handle your very own UNO! games in your Discord bot!
## Table of Contents
1. [What is discord-uno](https://github.com/Maxisthemoose/discord-uno#what-is-discord-uno)
2. [Table of Contents](https://github.com/Maxisthemoose/discord-uno#table-of-contents)
3. [Installation](https://github.com/Maxisthemoose/discord-uno#installation)
4. [Getting Started](https://github.com/Maxisthemoose/discord-uno#getting-started)
5. [Documentation](https://github.com/Maxisthemoose/discord-uno#documentation)
## Installation
```
npm install discord-uno
```
## Getting Started
Make sure you have installed the latest stable version of [Node.js](https://nodejs.org/en/)
```js
const Discord = require("discord.js");
const { DiscordUNO } = require("discord-uno");
const client = new Discord.Client();
let discordUNO;

client.on("ready", () => {
    discordUNO = new DiscordUNO(client);
    console.log("Ready!");
});

client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        await discordUNO.createGame(message);
    }
});

client.login("token");
```

# Documentation
### createGame(message: Message): Promise\<Message\>
To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame")
        await discordUNO.createGame(message);
});
```
### addUser(message: Message): Promise\<Message\>
To add a user to the current game, call the addUser() method. This method accepts one parameter, which is the Message object. This method handles adding users to the game in the current channel. This will automatically start the game if the user count reaches ten.
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!join")
        await discordUNO.addUser(message);
});
```
### removeUser(message: Message): Promise\<Message\>
To remove a user from the game, call the removeUser() method. This method accepts one parameter, whcih is the Message object. This method will handle removing users from the game and returning their cards to the "deck".
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!leave")
        await discordUNO.removeUser(message);
});
```
### startGame(message: Message): Promise\<Message\>
To manually start the game, call the startGame() method. This method accepts one parameter, which is the message object. This method will only work if the game has at least two users entered. Otherwise it will return. On success this method will send each user their cards and a starting message to the game channel.
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!startgame")
        await discordUNO.startGame(message);
});
```
### playCard(message: Message): Promise\<Message\>
To play a card in your hand, call the playCard() method. This method accepts one parameter, which is the message object. This method will handle playing the card called. On success, it will remove the card from their hand and replace the top card. On fail it will return.
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!play")
        await discordUNO.playCard(message);
});
```
### viewCards(message: Message): Promise\<Message\>
To view your current hand in the game, call the viewCards() method. This method accepts one parameter, which is the Message object. This method will handle showing users the current cards that they have in their hand. It will return a dirrect message to the user with their hand.
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!cards")
        await discordUNO.viewCards(message);
});
```
### viewTable(message: Message): Promise\<Message\>
To view the current state of the game, call the viewTable() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image to the channel with all the current information of the game. Including rotation, whos turn it is, how many cards each user has, whos in the game, and the top card of the pile.
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!table")
        await discordUNO.viewTable(message);
});
```