# What is discord-uno?
Discord-UNO is meant to be an easy to use, fast, and efficient way to create and handle your very own UNO! games in your Discord bot!
## Installation
```
npm install discord-uno
```
## Getting Started
```js
const Discord = require("discord.js");
const discord_uno = require("discord-uno");
const client = new Discord.Client();
const gameState = new Discord.Collection();

client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        const gameData = await discord_uno.createGame(client, message, gameState);
    }
});

client.login("token");
```