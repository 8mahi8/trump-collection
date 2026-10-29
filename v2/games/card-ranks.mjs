// Shared card ranking. The value depends on the rules of a game,
// not on a switch in the renderer or a string check in the card UI.
export const daifugoStrength = card => card.joker?13:
 card.rank===1?11:card.rank===2?12:card.rank-3;
