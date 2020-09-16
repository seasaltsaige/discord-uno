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
### createGame(message: Message): Promise<Message>
To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        await discordUNO.createGame(message);
    }
});
```
___
### addUser(message: Message): Promise<Message>
To add a user to the current game, call the addUser() method. This method accepts one parameter, which is the Message object. This method handles adding users to the game in the current channel. This will automatically start the game if the user count reaches ten.
___
### removeUser(message: Message): Promise<Message>
To remove a user from the game, call the removeUser() method. This method accepts one parameter, whcih is the Message object. This method will handle removing users from the game and returning their cards to the "deck".
___
### startGame(message: Message): Promise<Message>
Place Holder Text
___
### playCard(message: Message): Promise<Message>
Place Holder Text
___
### viewCards(message: Message): Promise<Message>
Place Holder Text
___
### viewTable(message: Message): Promise<Message>
Place Holder Text 