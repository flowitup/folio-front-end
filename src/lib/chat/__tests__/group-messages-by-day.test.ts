import { describe, expect, it } from "vitest";
import {
  dayDividerLabel,
  groupMessagesByDay,
  showsSender,
  timeOf,
  toLocalDayKey,
} from "@/lib/chat/group-messages-by-day";

const at = (iso: string, sender = "u1", mine = false) => ({
  id: iso,
  created_at: iso,
  sender_id: sender,
  mine,
});

describe("groupMessagesByDay", () => {
  it("groups consecutive messages of the same local day", () => {
    const d1 = new Date(2026, 8, 7, 9, 0).toISOString();
    const d2 = new Date(2026, 8, 7, 18, 30).toISOString();
    const d3 = new Date(2026, 8, 8, 8, 0).toISOString();
    const groups = groupMessagesByDay([at(d1), at(d2), at(d3)]);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-09-07", "2026-09-08"]);
    expect(groups[0].messages).toHaveLength(2);
  });

  it("labels today / yesterday with tokens and older days with dd/mm", () => {
    const today = new Date(2026, 8, 8);
    expect(dayDividerLabel("2026-09-08", today)).toEqual({ token: "today" });
    expect(dayDividerLabel("2026-09-07", today)).toEqual({ token: "yesterday" });
    expect(dayDividerLabel("2026-08-30", today)).toEqual({ date: "30/08" });
    expect(toLocalDayKey(today)).toBe("2026-09-08");
  });

  it("formats the local HH:mm", () => {
    expect(timeOf(new Date(2026, 8, 8, 7, 5).toISOString())).toBe("07:05");
  });

  it("shows the sender header only on the first message of a run, never on mine", () => {
    const list = [at("a", "u1"), at("b", "u1"), at("c", "u2"), at("d", "me", true)];
    expect(showsSender(list, 0)).toBe(true);
    expect(showsSender(list, 1)).toBe(false);
    expect(showsSender(list, 2)).toBe(true);
    expect(showsSender(list, 3)).toBe(false);
  });
});
