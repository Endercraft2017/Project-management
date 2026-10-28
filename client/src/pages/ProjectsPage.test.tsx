import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProjectsPage from "./ProjectsPage";
import { api, get, post } from "@/lib/api";
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  api: { patch: vi.fn() },
}));
vi.mock("@/hooks/useUsers", () => ({
  useCurrentUser: () => ({ data: { id: "owner", role: "MEMBER" } }),
}));
const project = {
  id: "project-1",
  name: "Example project",
  description: "Original description",
  createdById: "owner",
  archivedAt: null,
  updatedAt: "2026-10-28T00:00:00.000Z",
  _count: { tasks: 0, sprints: 0 },
  tasks: [],
};
function view() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectsPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(get).mockImplementation(async (path: string) =>
    path === "/api/projects"
      ? { projects: [project], pagination: { page: 1, limit: 12, total: 1 } }
      : project,
  );
});
it("preserves a failed new-project draft", async () => {
  vi.mocked(post).mockRejectedValue({ response: { status: 500 } });
  view();
  fireEvent.change(screen.getByLabelText("Project name"), {
    target: { value: "Unsaved project" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Unsaved detail" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Project name")).toHaveValue("Unsaved project");
  expect(screen.getByLabelText("Description")).toHaveValue("Unsaved detail");
});
it("keeps an edit draft on conflict and requires the latest version for the next save", async () => {
  vi.mocked(api.patch)
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValue({
      data: {
        data: {
          ...project,
          name: "My draft",
          updatedAt: "2026-10-28T02:00:00.000Z",
        },
      },
    });
  view();
  fireEvent.click(
    await screen.findByRole("button", { name: /^Example project/ }),
  );
  await screen.findByLabelText("Edit project name");
  fireEvent.change(screen.getByLabelText("Edit project name"), {
    target: { value: "My draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "draft is still here",
  );
  expect(screen.getByLabelText("Edit project name")).toHaveValue("My draft");
  vi.mocked(get).mockResolvedValueOnce({
    ...project,
    name: "Server version",
    updatedAt: "2026-10-28T01:00:00.000Z",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Load latest to compare" }),
  );
  await screen.findByText("Latest saved version");
  expect(screen.getByLabelText("Edit project name")).toHaveValue("My draft");
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  await waitFor(() =>
    expect(api.patch).toHaveBeenLastCalledWith("/api/projects/project-1", {
      name: "My draft",
      description: "Original description",
      expectedUpdatedAt: "2026-10-28T01:00:00.000Z",
    }),
  );
});
it("keeps a failed backlog-task draft instead of claiming it was saved", async () => {
  vi.mocked(post).mockRejectedValue({ response: { status: 500 } });
  view();
  fireEvent.click(
    await screen.findByRole("button", { name: /^Example project/ }),
  );
  await screen.findByLabelText("New backlog task");
  fireEvent.change(screen.getByLabelText("New backlog task"), {
    target: { value: "Task draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add backlog task" }));
  await screen.findByRole("alert");
  expect(post).toHaveBeenCalledWith("/api/projects/project-1/tasks", {
    taskName: "Task draft",
  });
  expect(screen.getByLabelText("New backlog task")).toHaveValue("Task draft");
  expect(
    screen.queryByText("Backlog task created and assigned to you."),
  ).not.toBeInTheDocument();
});
