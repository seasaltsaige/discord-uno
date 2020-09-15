export default interface Card {
    name: string;
    color: string | null;
    value: number | string;
    count: number;
    inPlay: number;
    image: string;
}