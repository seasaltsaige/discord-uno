import { Snowflake } from "discord.js";
import Card from "./Card.interface";
import User from "./User.interface";

export default interface GameData {
    guild: Snowflake;
    channel: Snowflake;
    creator: Snowflake;
    active: boolean;
    users: User[];
    topCard: Card;
    currentPlayer: number;
}