export type WorkEventDay = { date:string; works:Record<string,{views:number;downloadClicks:number}> };
export const workEventKey=(date:string)=>`metrics/works/${date}.json`;
