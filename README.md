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
### `createGame(message: Message)`

To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).

### `addUser(message: Message)`

To add users to the current game, call the addUser() method. This method accepts one parameter, which is the Message object. This method handles adding users to the game in the current channel.



```js
createGame(message: Message): Promise<Message> // Handles the creation of the game and returns a message to let users know.

addUser(message: Message): Promise<Message> // Handles the addition of a new user and returns a message. If the game reaches 10 users, it will automatically start.

removeUser(message: Message): Promise<Message> // Handles the removal of a user and returns a message.

startGame(message: Message): Promise<Message> // Handles the starting of a game, DM's the users their cards and initializes the game state.

playCard(message: Message): Promise<Message> // Handles the playing of a card and returns a message dependent on if the card was special or not.

viewCards(message: Message): Promise<Message> // Allows a user to view their own cards.

viewTable(message: Message): Promise<Message> // Views the current state of the game, all users and their hand count, rotation, and whos turn it is.
```