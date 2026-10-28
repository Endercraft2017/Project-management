import { useEffect, useState, type FormEvent } from "react";
import { get, post, api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import "./ProjectsPage.css";
import { useCurrentUser } from "@/hooks/useUsers";
import { Notice } from "@/components/console/AccessFrame";

interface Project {
  id: string;
  name: string;
  description: string;
  createdById: string;
  archivedAt: string | null;
  updatedAt: string;
  _count: { tasks: number; sprints: number };
  tasks?: { id: string; taskName: string; progress: number }[];
}
interface ProjectList {
  projects: Project[];
  pagination: { page: number; limit: number; total: number };
}
function message(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 409)
    return "This project changed elsewhere. Your draft is still here. Load the latest version to compare before saving.";
  if (status === 403)
    return "You do not have permission to change this project.";
  if (status === 401)
    return "Your session expired. Log in again before continuing.";
  return "The request could not be completed. Please retry.";
}
export default function ProjectsPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [archived, setArchived] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Project | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [taskName, setTaskName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [compared, setCompared] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setListError("");
    get<ProjectList>("/api/projects", {
      page,
      limit: 12,
      archived: String(archived),
    })
      .then((result) => {
        if (live) {
          setProjects(result.projects);
          setTotal(result.pagination.total);
        }
      })
      .catch((failure) => {
        if (live) setListError(message(failure));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, archived, version]);
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetailLoading(true);
    setDetailError("");
    setError("");
    setSuccess("");
    setCompared(false);
    get<Project>(`/api/projects/${selectedId}`)
      .then((project) => {
        if (live) {
          setDetail(project);
          setName(project.name);
          setDescription(project.description || "");
          setTaskName("");
        }
      })
      .catch((failure) => {
        if (live) {
          setDetail(null);
          setDetailError(message(failure));
        }
      })
      .finally(() => {
        if (live) setDetailLoading(false);
      });
    return () => {
      live = false;
    };
  }, [selectedId]);
  const canEdit = Boolean(
    detail && user && (user.role === "ADMIN" || detail.createdById === user.id),
  );
  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending("create");
    setError("");
    setSuccess("");
    try {
      const project = await post<Project>("/api/projects", {
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setNewName("");
      setNewDescription("");
      setPage(1);
      setVersion((value) => value + 1);
      setSelectedId(project.id);
      setSuccess("Project created.");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(null);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!detail || pending) return;
    setPending("save");
    setError("");
    setSuccess("");
    try {
      const result = await api.patch<{ data: Project }>(
        `/api/projects/${detail.id}`,
        {
          name: name.trim(),
          description: description.trim(),
          expectedUpdatedAt: detail.updatedAt,
        },
      );
      setDetail({ ...result.data.data, tasks: detail.tasks });
      setName(result.data.data.name);
      setDescription(result.data.data.description || "");
      setCompared(false);
      setVersion((value) => value + 1);
      setSuccess("Project saved.");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(null);
    }
  }
  async function compare() {
    if (!detail || pending) return;
    setPending("compare");
    try {
      setDetail(await get<Project>(`/api/projects/${detail.id}`));
      setCompared(true);
      setError(
        "The latest saved version is shown below. Your draft has not been changed. Compare it before saving.",
      );
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(null);
    }
  }
  async function toggleArchive() {
    if (!detail || pending) return;
    setPending("archive");
    setError("");
    try {
      const result = await api.patch<{ data: Project }>(
        `/api/projects/${detail.id}`,
        { archived: !detail.archivedAt, expectedUpdatedAt: detail.updatedAt },
      );
      setDetail({ ...result.data.data, tasks: detail.tasks });
      setVersion((value) => value + 1);
      setSuccess(
        result.data.data.archivedAt
          ? "Project archived. Existing records are retained."
          : "Project restored.",
      );
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(null);
    }
  }
  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!detail || pending) return;
    setPending("task");
    setError("");
    try {
      await post(`/api/projects/${detail.id}/tasks`, {
        taskName: taskName.trim(),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tasks"],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["statistics"],
          refetchType: "all",
        }),
      ]);
      setTaskName("");
      setDetail(await get<Project>(`/api/projects/${detail.id}`));
      setVersion((value) => value + 1);
      setSuccess("Backlog task created and assigned to you.");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="ez-projects space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Projects are visible to your company. Only their creator or a company
          administrator can edit or archive them.
        </p>
      </header>
      {error && <Notice>{error}</Notice>}
      {success && <Notice success>{success}</Notice>}
      <section className="ez-card" aria-labelledby="new-project-heading">
        <h3 id="new-project-heading" className="font-semibold">
          Create a project
        </h3>
        <form
          className="ez-form"
          onSubmit={create}
          aria-busy={pending === "create"}
        >
          <div className="ez-grid-two">
            <div className="ez-field">
              <label htmlFor="new-project-name">Project name</label>
              <input
                id="new-project-name"
                required
                maxLength={120}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                disabled={Boolean(pending)}
              />
            </div>
            <div className="ez-field">
              <label htmlFor="new-project-description">Description</label>
              <input
                id="new-project-description"
                maxLength={5000}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                disabled={Boolean(pending)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="ez-button ez-button--primary"
              disabled={Boolean(pending)}
            >
              {pending === "create" ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </section>
      <div className="ez-section-header">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => {
              setArchived(event.target.checked);
              setPage(1);
            }}
          />
          Include archived projects
        </label>
        <button
          type="button"
          className="ez-button"
          onClick={() => setVersion((value) => value + 1)}
          disabled={loading}
        >
          Refresh projects
        </button>
      </div>
      {loading && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading projects…
        </p>
      )}
      {listError && <Notice>{listError}</Notice>}
      {!loading && !listError && projects.length === 0 && (
        <div className="ez-card">
          <p>
            No projects found. Create a project to organize your team's work.
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            aria-pressed={selectedId === project.id}
            onClick={() => setSelectedId(project.id)}
          >
            <span className="flex items-start justify-between gap-3">
              <strong>{project.name}</strong>
              {project.archivedAt && (
                <small className="text-muted-foreground">Archived</small>
              )}
            </span>
            <span className="mt-2 block text-sm text-muted-foreground line-clamp-2">
              {project.description || "No description yet."}
            </span>
            <span className="mt-4 block text-xs text-muted-foreground">
              {project._count.tasks} tasks · {project._count.sprints} sprints
            </span>
          </button>
        ))}
      </div>
      <div className="ez-actions">
        <button
          className="ez-button"
          disabled={page === 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous projects
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {Math.max(1, Math.ceil(total / 12))} · {total} projects
        </span>
        <button
          className="ez-button"
          disabled={page * 12 >= total || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next projects
        </button>
      </div>
      {detailLoading && <p role="status">Loading project details…</p>}
      {detailError && <Notice>{detailError}</Notice>}
      {detail && !detailLoading && (
        <section className="ez-card" aria-labelledby="project-detail-heading">
          <div className="ez-section-header">
            <h3 id="project-detail-heading" className="text-xl font-semibold">
              {detail.name}
              {detail.archivedAt ? " · Archived" : ""}
            </h3>
            {canEdit && (
              <button
                className="ez-button"
                disabled={Boolean(pending)}
                onClick={toggleArchive}
              >
                {pending === "archive"
                  ? "Saving…"
                  : detail.archivedAt
                    ? "Restore project"
                    : "Archive project"}
              </button>
            )}
          </div>
          {canEdit ? (
            <form
              className="ez-form"
              onSubmit={save}
              aria-busy={pending === "save"}
            >
              <div className="ez-field">
                <label htmlFor="edit-project-name">Edit project name</label>
                <input
                  id="edit-project-name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={Boolean(pending)}
                />
              </div>
              <div className="ez-field">
                <label htmlFor="edit-project-description">
                  Edit description
                </label>
                <textarea
                  id="edit-project-description"
                  maxLength={5000}
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={Boolean(pending)}
                />
              </div>
              <div className="ez-actions">
                <button
                  type="submit"
                  className="ez-button ez-button--primary"
                  disabled={Boolean(pending)}
                >
                  {pending === "save" ? "Saving…" : "Save project"}
                </button>
                <button
                  type="button"
                  className="ez-button"
                  disabled={Boolean(pending)}
                  onClick={compare}
                >
                  Load latest to compare
                </button>
              </div>
              {compared && (
                <div className="rounded-lg border border-border p-4 text-sm">
                  <strong>Latest saved version</strong>
                  <p>{detail.name}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {detail.description || "No description"}
                  </p>
                </div>
              )}
            </form>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.description || "No description yet."}
            </p>
          )}
          <div className="ez-section">
            <h4 className="font-semibold">Your visible tasks</h4>
            <p className="ez-help">
              Showing up to 100 recently updated tasks you are permitted to
              read.
            </p>
            {detail.tasks?.length ? (
              <ul className="mt-3 divide-y divide-border">
                {detail.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>{task.taskName}</span>
                    <span className="text-muted-foreground">
                      {task.progress}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No visible tasks in this project yet.
              </p>
            )}
          </div>
          {!detail.archivedAt && (
            <form
              className="ez-form"
              onSubmit={addTask}
              aria-busy={pending === "task"}
            >
              <div className="ez-field">
                <label htmlFor="project-task-name">New backlog task</label>
                <input
                  id="project-task-name"
                  required
                  maxLength={200}
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  disabled={Boolean(pending)}
                />
                <small>
                  The new task will be assigned to you. Add sprint details from
                  the Tasks view.
                </small>
              </div>
              <div>
                <button
                  type="submit"
                  className="ez-button"
                  disabled={Boolean(pending)}
                >
                  {pending === "task" ? "Adding…" : "Add backlog task"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
