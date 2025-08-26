import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function useUnsavedChangesPrompt(unsaved) {
  useEffect(() => {
    const handler = (e) => {
      if (unsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsaved]);
}

export default function NewRelease({ user, showConfirm }) {
  const [form, setForm] = useState({
    tag_name: "",
    name: "",
    body: "",
    draft: false,
    prerelease: false,
    is_latest: true
  });
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unsaved, setUnsaved] = useState(false);
  const navigate = useNavigate();

  useUnsavedChangesPrompt(unsaved);

  useEffect(() => {
    const hasUnsavedChanges =
      form.tag_name !== "" ||
      form.name !== "" ||
      form.body !== "" ||
      form.draft !== false ||
      form.prerelease !== false ||
      form.is_latest !== true;
    setUnsaved(hasUnsavedChanges);
  }, [form]);

  const addNotification = (notification) => {
    setNotifications((prev) => [...prev, notification]);
    if (notification.timer) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n !== notification));
      }, notification.timer);
    }
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleCreate = async () => {
    if (!form.tag_name.trim()) {
      addNotification({
        type: "error",
        message: "Tag name is required."
      });
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/release/new", {
        tag_name: form.tag_name,
        name: form.name,
        body: form.body,
        draft: form.draft,
        prerelease: form.prerelease,
        make_latest: form.is_latest ? "true" : "false"
      });
      navigate("/", { state: { new: true } });
    } catch (err) {
      addNotification({
        type: "error",
        message: "Failed to create release: " + (err.response?.data?.error || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (unsaved) {
      showConfirm({
        title: "Cancel New Release",
        message: "You have unsaved changes. Are you sure you want to cancel?",
        confirmText: "Yes, Cancel",
        cancelText: "Back",
        onConfirm: () => navigate("/"),
      });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="container">
      <div className="mb-4">
        <button
          className="button is-dark"
          onClick={() => {
            if (unsaved) {
              showConfirm({
                title: "Unsaved Changes",
                message: "You have unsaved changes. Are you sure you want to go back?",
                confirmText: "Yes, Go Back",
                cancelText: "Stay",
                onConfirm: () => navigate("/"),
              });
            } else {
              navigate("/");
            }
          }}
        >
          <span className="icon">
            <i className="fas fa-arrow-left"></i>
          </span>
          <span>Back</span>
        </button>
        <hr />
      </div>
      <h2 className="title is-4">New Release</h2>
      <div className="field">
        <label className="label">Tag</label>
        <div className="control">
          <input
            className="input"
            name="tag_name"
            value={form.tag_name}
            onChange={handleChange}
            placeholder="v1.0.0"
            disabled={loading}
          />
        </div>
      </div>
      <div className="field mt-5">
        <label className="label">Name</label>
        <div className="control">
          <input
            className="input"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Release name"
            disabled={loading}
          />
        </div>
      </div>
      <div className="field mt-5">
        <label className="label">Body</label>
        <div className="control">
          <textarea
            className="textarea"
            rows="5"
            name="body"
            value={form.body}
            onChange={handleChange}
            placeholder="Release notes..."
            disabled={loading}
          />
        </div>
      </div>
      <div className="field is-grouped mt-5">
        <label className="label mr-4">Set as:</label>
        <div className="control">
          <label className="checkbox mr-3">
            <input
              type="checkbox"
              name="draft"
              checked={!!form.draft}
              onChange={e => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  draft: checked,
                  is_latest: false
                }));
              }}
              disabled={loading}
            />{" "}
            Draft
          </label>
          <label className="checkbox mr-3">
            <input
              type="checkbox"
              name="prerelease"
              checked={!!form.prerelease}
              onChange={e => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  prerelease: checked,
                  is_latest: false
                }));
              }}
              disabled={loading}
            />{" "}
            Pre-release
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              name="is_latest"
              checked={!!form.is_latest}
              onChange={e => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  is_latest: checked,
                  draft: false,
                  prerelease: false
                }));
              }}
              disabled={loading}
            />{" "}
            Latest release
          </label>
        </div>
      </div>
      <div className="field mt-5">
        <div className="control is-flex">
          <button
            className="button is-primary is-dark mr-2"
            onClick={handleCreate}
            disabled={loading}
          >
            Create
          </button>
          <button
            className="button is-danger is-dark"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="notify is-overlay is-position-fixed">
        {notifications.map((n, idx) => (
          <div
            key={idx}
            className={`notification is-${n.type === "success" ? "success" : n.type === "info" ? "info" : "danger"}`}
          >
            <button className="delete" onClick={() => {
              setNotifications((prev) => prev.filter((_, i) => i !== idx));
            }}></button>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}