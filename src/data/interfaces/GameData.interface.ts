import { Snowflake } from "discord.js";
import Card from "./Card.interface";

export default interface GameData {
    guild: Snowflake;
    channel: Snowflake;
    creator: Snowflake;
    active: boolean;
    users: {
        id: Snowflake;
        hand: Card[];
        safe: boolean;
    }[];
    topCard: Card;
}