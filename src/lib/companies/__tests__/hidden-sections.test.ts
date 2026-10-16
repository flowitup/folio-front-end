import { describe, it, expect } from "vitest";
import {
  companiesShowingArea,
  hiddenCompanyAreas,
  hiddenProjectSections,
  projectRouteSection,
} from "../hidden-sections";

const A = { id: "a", hidden_sections: ["notes", "library"] };
const B = { id: "b", hidden_sections: ["photos", "library", "billing"] };
const C = { id: "c" };

describe("hiddenProjectSections", () => {
  it("follows the project's company, not the primary one", () => {
    expect([...hiddenProjectSections([A, B], "b")]).toEqual(["photos", "library", "billing"]);
    expect([...hiddenProjectSections([A, B], "a")]).toEqual(["notes", "library"]);
  });

  it("hides nothing while the project's company is unknown, unless there is one company", () => {
    expect(hiddenProjectSections([A, B], null).size).toBe(0);
    expect([...hiddenProjectSections([A], undefined)]).toEqual(["notes", "library"]);
    expect(hiddenProjectSections([C], "c").size).toBe(0);
  });
});

describe("hiddenCompanyAreas", () => {
  it("hides an area only when every company of the user hides it", () => {
    expect([...hiddenCompanyAreas([A, B])]).toEqual(["library"]);
    expect(hiddenCompanyAreas([A, B, C]).size).toBe(0);
    expect([...hiddenCompanyAreas([B])]).toEqual(["billing", "library"]);
    expect(hiddenCompanyAreas([]).size).toBe(0);
  });
});

describe("companiesShowingArea", () => {
  it("leaves out the companies that hide the area", () => {
    expect(companiesShowingArea([A, B, C], "library")).toEqual([C]);
    expect(companiesShowingArea([A, B], "inventory")).toEqual([A, B]);
  });
});

describe("projectRouteSection", () => {
  it("maps project routes to hideable sections", () => {
    expect(projectRouteSection("/projects/p1/photos")).toBe("photos");
    expect(projectRouteSection("/projects/p1/notes/n2")).toBe("notes");
    expect(projectRouteSection("/projects/p1/billing")).toBe("billing");
    expect(projectRouteSection("/projects/p1/labor")).toBeNull();
    expect(projectRouteSection("/projects/p1")).toBeNull();
    expect(projectRouteSection("/bibliotheque")).toBeNull();
  });
});
