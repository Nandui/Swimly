import { formatDay, formatTimeRange } from "@/lib/format";

/** The card a cover request is in Google Chat (D31), pure. It says what is on, where, when and
 *  any note, never why anyone is off. While it is open it carries the two buttons; once it stops,
 *  it says how it ended and the buttons go. */

/** The button's function name, and its parameters, as Chat sends them back on a click. */
export const COVER_ANSWER_FUNCTION = "plan.cover.answer";

export type CoverCardInput = {
  id: string;
  title: string;
  dutyName: string;
  place: string;
  date: string;
  start: number;
  end: number;
  note: string;
  askedByName: string;
  /** The people who said they can cover, in the order they answered. */
  canCover: string[];
  /** Null while open. */
  outcome: "filled" | "stopped" | null;
  chosenName: string | null;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** The one line under the buttons: who can cover so far, or how it ended. */
export function coverStatus(card: Pick<CoverCardInput, "canCover" | "outcome" | "chosenName">): string {
  if (card.outcome === "filled") return `Covered by ${card.chosenName ?? "someone"}. Thank you.`;
  if (card.outcome === "stopped") return "No longer needed.";
  return card.canCover.length ? `Can cover: ${card.canCover.map(firstName).join(", ")}` : "Nobody has answered yet.";
}

/** The line of text Chat shows in a notification, where a card can't be seen. */
export function coverText(card: CoverCardInput): string {
  return `Cover needed: ${card.dutyName} for ${card.title}, ${formatDay(card.date)}, ${formatTimeRange(card.start, card.end)}`;
}

export function coverCard(card: CoverCardInput) {
  const answer = (text: string, value: "yes" | "no") => ({ text, onClick: { action: { function: COVER_ANSWER_FUNCTION,
    parameters: [{ key: "request", value: card.id }, { key: "answer", value }] } } });
  const line = (topLabel: string, text: string) => ({ decoratedText: { topLabel, text } });
  return {
    text: coverText(card),
    cardsV2: [{
      cardId: `cover-${card.id}`,
      card: {
        header: { title: card.outcome ? "Cover request" : "Cover needed", subtitle: `${card.dutyName} for ${card.title}` },
        sections: [{
          widgets: [
            line("When", `${formatDay(card.date)}, ${formatTimeRange(card.start, card.end)}`),
            ...(card.place ? [line("Where", card.place)] : []),
            ...(card.note ? [line("Note", card.note)] : []),
            line("Asked by", card.askedByName),
            ...(card.outcome ? [] : [{ buttonList: { buttons: [answer("I can cover", "yes"), answer("Can't", "no")] } }]),
            { textParagraph: { text: coverStatus(card) } },
          ],
        }],
      },
    }],
  };
}
