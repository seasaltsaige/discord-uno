import { cards } from "./gameCards";
/**
 * @param {Number} amount - The number of cards to make 
 * @param {Boolean} topCard - If the card being created will be the top of the face up cards
 */
export default async function createCards(amount: number, topCard: boolean) {
    if (!topCard) topCard = false;
    let counter = 0;
    let cardHand: {

    }[] = [];
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
                    cardHand.push(cards.wild[tempMath5]);
                    cards.wild[tempMath5].inPlay += 1;
                }
                await wildCard();
            break;
        }
        counter++
    } while (counter < amount)

    return cardHand;

}