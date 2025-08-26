import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { formatSize } from "../utils";

const REFRESH_KEY = "ghrm_refresh_interval";
const API_PER_PAGE = 100;

export default function ReleaseList({ user, showConfirm }) {
  const [releases, setReleases] = useState([]);
  const [apiNextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [latestId, setLatestId] = useState(null);
  const [search, setSearch] = useState("");
  const [deletingReleaseId, setDeletingReleaseId] = useState(null);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [refreshInterval, setRefreshInterval] = useState(
    Number(localStorage.getItem(REFRESH_KEY)) || 0
  );

  const location = useLocation();

  useEffect(() => {
    let interval;
    async function refreshList() {
      if (location.state?.new) {
        setWaiting(true);
        await new Promise(resolve => setTimeout(resolve, 1500)); // wait 1.5 seconds after creating new release
        fetchReleases();
        window.history.replaceState({}, document.title);
        setWaiting(false);
      } else {
        fetchReleases();
      }

      if (refreshInterval > 0) {
        interval = setInterval(fetchReleases, refreshInterval);
      }
    }
    refreshList();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refreshInterval]);

  const addNotification = (notification) => {
    setNotifications((prev) => [...prev, notification]);
    if (notification.timer) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n !== notification));
      }, notification.timer);
    }
  };

  const fetchReleases = async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/releases?per_page=${API_PER_PAGE}&page=${pageNum}`);
      if (res.data.error) {
        addNotification({
          type: "danger",
          message: res.data.error
        });
        if (!append) setReleases([]);
      } else {
        if (append) {
          setReleases(prev => [...prev, ...res.data.releases]);
        } else {
          setReleases(res.data.releases);
          setPage(1); // Reset to first page
        }
        setNextPage(res.data.next_page);
        fetchLatest();
      }
    } catch (err) {
      console.error("Failed to fetch releases", err);
      addNotification({
        type: "danger",
        message: err.response?.data?.error || err.message || "Unknown error"
      });
      if (!append) setReleases([]);
      setLoading(false);
    }
  };

  const fetchLatest = async () => {
    try {
      const res = await axios.get("/api/release/latest");
      setLatestId(res.data.id);
    } catch (err) {
      setLatestId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalChange = (e) => {
    const value = e.target.value === "manual" ? 0 : Number(e.target.value) * 1000;
    setRefreshInterval(value);
    localStorage.setItem(REFRESH_KEY, value);
  };

  // Filter releases by search (tag, name, or any asset digest)
  const filteredReleases = releases.filter(r =>
    (r.tag_name && r.tag_name.toLowerCase().includes(search.toLowerCase())) ||
    (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
    (Array.isArray(r.assets) &&
      r.assets.some(a =>
        a.digest && a.digest.toLowerCase().includes(search.toLowerCase())
      )
    )
  );

  const handleDeleteRelease = (release) => {
    setDeletingReleaseId(release.id);
    showConfirm({
      title: "Delete Release",
      message: `Are you sure you want to delete release "${release.name || release.tag_name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          await axios.delete(`/api/release/${release.id}`);
          addNotification({
            type: "success",
            message: `Release "${release.name || release.tag_name}" deleted.`,
            timer: 5000
          });
          // Refresh list after deletion
          fetchReleases();
        } catch (err) {
          addNotification({
            type: "danger",
            message: err.response?.data?.error || err.message || "Failed to delete release"
          });
        }
        setDeletingReleaseId(null);
      },
      onCancel: () => setDeletingReleaseId(null)
    });
  };

  const hasAccess = user.token && user.canWrite;
  const maxPage = Math.ceil(filteredReleases.length / pageSize);
  const pagedReleases = filteredReleases.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container">
      <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
        <h2 className="title is-4">
          <a
            href={`https://github.com/${user.username}/${user.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${user.username}/${user.repo} on GitHub`}
          >
            {user.repo}
          </a>{" "}
          <span className="has-text-weight-normal">/</span>{" "}
          Releases <span className="tag is-dark ml-2">{releases.length}</span>
        </h2>
        <div className="is-flex is-align-items-center">
          {/* Search box */}
          <div className="field has-addons mr-4 mb-0">
            <div className="control is-expanded">
              <input
                className="input"
                type="text"
                placeholder="tag, name, or digest..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page
                }}
                title="Search tag, name, or digest..."
              />
            </div>
            {search && (
              <div className="control">
                <button
                  className="button is-danger is-outlined"
                  title="Clear search"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                >
                  &#x2715;
                </button>
              </div>
            )}
          </div>
          <div className="mr-4">
            <div className="select">
              <select
                value={refreshInterval === 0 ? "manual" : refreshInterval / 1000}
                onChange={handleIntervalChange}
                title="Auto refresh interval"
              >
                <option value="manual">Manual</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1200}>20 minutes</option>
              </select>
            </div>
            {refreshInterval === 0 && (
              <button
                className="button is-info is-dark ml-2"
                onClick={() => {
                  fetchReleases();
                }}
                disabled={loading}
                title="Manual refresh"
              >
                <span className="icon">
                  <i className="fas fa-sync"></i>
                </span>
                <span>Refresh</span>
              </button>
            )}
          </div>
          {hasAccess && (
            <a
              href="/new"
              className="button is-success is-dark"
              style={{ textDecoration: "none" }}
            >
              <span className="icon">
                <i className="fas fa-plus"></i>
              </span>
              <span>New Release</span>
            </a>
          )}
        </div>
      </div>
      {loading || waiting || filteredReleases.length === 0 ? (
        <div className="has-text-centered">
          <p>
            {loading
              ? "Loading releases..."
              : waiting
              ? "Refreshing, please wait..."
              : "No releases found."
            }
          </p>
        </div>
      ) : (
        <>
          <table className="table is-hoverable is-fullwidth is-striped">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Name</th>
                <th>Assets</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagedReleases.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className={
                      deletingReleaseId === r.id
                        ? "has-background-danger-dark"
                        : r.showAssets
                          ? "has-background-grey-darker"
                          : undefined
                    }
                  >
                    <td>{r.tag_name}</td>
                    <td>
                      {r.name}
                      {r.id === latestId && (
                        <span className="tag is-success ml-2">latest</span>
                      )}
                      {r.draft && (
                        <span className="tag is-dark ml-2">draft</span>
                      )}
                      {r.prerelease && (
                        <span className="tag is-dark ml-2">pre-release</span>
                      )}
                    </td>
                    <td>
                      {r.assets?.length > 0 ? (
                        <div
                          className="is-clickable"
                          onClick={() =>
                            setReleases(prev =>
                              prev.map(rel =>
                                rel.id === r.id
                                  ? { ...rel, showAssets: !rel.showAssets }
                                  : rel
                              )
                            )
                          }
                        >
                          {r.showAssets ? "\u25BC" : "\u25B6"}&#x3164;Assets ({r.assets.length})
                        </div>
                      ) : (
                        <span className="has-text-grey-light">No assets</span>
                      )}
                    </td>
                    <td>
                      <a
                        href={r.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="button is-small is-info is-dark"
                        title="View Release"
                      >
                        <span className="icon">
                          <i className="fas fa-eye"></i>
                        </span>
                      </a>
                      {hasAccess && (
                        <>
                          <button
                            className="button is-small is-danger is-dark ml-3"
                            title="Delete Release"
                            onClick={() => handleDeleteRelease(r)}
                            disabled={deletingReleaseId === r.id}
                          >
                            <span className="icon">
                              <i className="fas fa-trash"></i>
                            </span>
                          </button>
                          <a
                            href={`/${user.repo}/edit/${r.id}`}
                            className="button is-small is-primary is-dark ml-3"
                            title="Edit Release"
                            rel="noopener"
                            style={{ textDecoration: "none" }}
                          >
                            Edit
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                  {r.showAssets && r.assets?.length > 0 && (
                    <tr className="has-background-grey-darker release-assets">
                      <td colSpan={4}>
                        <table className="table is-hoverable is-fullwidth">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Digest</th>
                              <th>Size</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.assets.map((a) => (
                              <tr key={a.id}>
                                <td>
                                  <a
                                    href={a.browser_download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {a.name}
                                  </a>
                                </td>
                                <td>
                                  <div className="truncate is-inline-flex">
                                    {a.digest ? (
                                      <span className="truncate-text">{a.digest}</span>
                                    ) : (
                                    <span className="has-text-grey-light">-</span>
                                    )}
                                  </div>
                                </td>
                                <td>{formatSize(a.size)}</td>
                                <td>{a.created_at ? new Date(a.created_at).toLocaleString() : <span className="has-text-grey-light">-</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="is-flex mt-4">
            <nav className="pagination is-right is-inline-flex m-0" role="navigation" aria-label="pagination">
              <button
                className="pagination-previous"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Prev
              </button>
              <button
                className="pagination-next"
                onClick={() => setPage(page + 1)}
                disabled={page >= maxPage}
              >
                Next
              </button>
              <ul className="pagination-list is-inline-flex ml-4">
                {/* Always show first page */}
                <li>
                  <button
                    className={`pagination-link${page === 1 ? " is-current" : ""}`}
                    onClick={() => setPage(1)}
                    aria-label="Goto page 1"
                  >
                    1
                  </button>
                </li>
                {/* Show ellipsis if current page > 3 */}
                {page > 3 && (
                  <li>
                    <span className="pagination-ellipsis">&hellip;</span>
                  </li>
                )}
                {/* Show 1 page before current */}
                {page - 1 > 1 && (
                  <li>
                    <button
                      className="pagination-link"
                      onClick={() => setPage(page - 1)}
                      aria-label={`Goto page ${page - 1}`}
                    >
                      {page - 1}
                    </button>
                  </li>
                )}
                {/* Current page */}
                {page !== 1 && page !== maxPage && (
                  <li>
                    <button
                      className="pagination-link is-current"
                      aria-label={`Page ${page}`}
                      aria-current="page"
                    >
                      {page}
                    </button>
                  </li>
                )}
                {/* Show 1 page after current */}
                {page + 1 < maxPage && (
                  <li>
                    <button
                      className="pagination-link"
                      onClick={() => setPage(page + 1)}
                      aria-label={`Goto page ${page + 1}`}
                    >
                      {page + 1}
                    </button>
                  </li>
                )}
                {/* Ellipsis before last page */}
                {page < maxPage - 2 && (
                  <li>
                    <span className="pagination-ellipsis">&hellip;</span>
                  </li>
                )}
                {/* Always show last page if more than one */}
                {maxPage > 1 && (
                  <li>
                    <button
                      className={`pagination-link${page === maxPage ? " is-current" : ""}`}
                      onClick={async () => {
                        setPage(maxPage);
                        // If on last page and apiNextPage exists, fetch and append next releases
                        if (apiNextPage) {
                          await fetchReleases(apiNextPage, true);
                        }
                      }}
                      aria-label={`Goto page ${maxPage}`}
                    >
                      {maxPage}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
            {/* Jump to page */}
            {maxPage >= 4 && (
              <div className="field is-grouped mb-0 ml-5">
                <div className="control">
                  <input
                    type="number"
                    min={1}
                    max={maxPage}
                    className="input"
                    placeholder={`Jump to page (1-${maxPage})`}
                    value={jumpPage}
                    onChange={e => setJumpPage(e.target.value)}
                    title={`Jump to page (1-${maxPage})`}
                  />
                </div>
                <div className="control">
                  <button
                    className="button is-primary is-dark"
                    disabled={
                      !jumpPage ||
                      isNaN(jumpPage) ||
                      Number(jumpPage) < 1 ||
                      Number(jumpPage) > maxPage
                    }
                    onClick={() => {
                      setPage(Number(jumpPage));
                      setJumpPage("");
                    }}
                  >
                    Go
                  </button>
                </div>
              </div>
            )}
            <span className="is-flex-grow-1"></span>
            <div className="select ml-4">
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1); // Reset to first page
                }}
                title="Rows per page"
              >
                <option value={10}>Rows: 10</option>
                <option value={20}>Rows: 20</option>
                <option value={50}>Rows: 50</option>
                <option value={100}>Rows: 100</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div className="notify is-overlay is-position-fixed">
        {notifications.map((n, idx) => (
          <div
            key={idx}
            className={`notification is-${n.type}`}
          >
            <button className="delete" onClick={() => setNotifications((prev) => prev.filter((_, i) => i !== idx))}></button>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}
