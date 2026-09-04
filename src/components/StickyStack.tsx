export function StickyStack({ cards }: { cards: React.ReactNode[] }) {
  return (
    <div className="relative flex flex-col gap-[5vh] pb-[20vh]">
      {cards.map((card, i) => {
        // Calculate a slightly different top for each card to create a layered effect
        // or just let them stack at the exact same spot.
        const topOffset = 20 + (i * 2); 
        return (
          <div
            key={i}
            className="stack-card sticky min-h-[50vh] flex items-center justify-center bg-paper dark:bg-obsidian border border-obsidian/10 dark:border-white/10 shadow-xl"
            style={{ 
              top: `${topOffset}vh`, 
              zIndex: i + 1
            }}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}
