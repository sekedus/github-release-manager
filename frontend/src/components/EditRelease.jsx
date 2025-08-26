import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { formatSize } from "../utils";

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

function buildForm(data) {
  return {
    tag_name: data.tag_name,
    name: data.name,
    body: data.body,
    file: data.file || null,
    assets: data.assets,
    draft: data.draft,
    prerelease: data.prerelease,
    is_latest: data.is_latest,
  };
}

export default function EditRelease({ user, showConfirm }) {
  const { repoName, releaseId } = useParams();
  const [form, setForm] = useState({});
  const [unsaved, setUnsaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [releaseData, setReleaseData] = useState(null);
  const [originalForm, setOriginalForm] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [deletingAssetId, setDeletingAssetId] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef();

  useUnsavedChangesPrompt(unsaved);

  useEffect(() => {
    setLoading(true);
    const fetchRelease = async () => {
      try {
        const res = await getRelease();
        const initialForm = buildForm(res.data);
        setForm(initialForm);
        setOriginalForm(initialForm);
        setUnsaved(false);
      } catch (err) {
        console.error("Failed to fetch release", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRelease();
  }, [releaseId]);

  // Compare form with originalForm whenever form changes
  useEffect(() => {
    if (!originalForm) return;
    const isSame =
      form.tag_name === originalForm.tag_name &&
      form.name === originalForm.name &&
      form.body === originalForm.body &&
      form.draft === originalForm.draft &&
      form.prerelease === originalForm.prerelease &&
      form.is_latest === originalForm.is_latest &&
      JSON.stringify(form.assets) === JSON.stringify(originalForm.assets);
    setUnsaved(!isSame);
  }, [form, originalForm]);

  const addNotification = (notification) => {
    setNotifications((prev) => [...prev, notification]);
    if (notification.timer) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n !== notification));
      }, notification.timer);
    }
  };

  const getRelease = async () => {
    const res = await axios.get(`/api/release/${releaseId}`);
    let isLatest = false;
    if (!res.data.draft && !res.data.prerelease) {
      const latestRes = await axios.get("/api/release/latest");
      if (latestRes.data.id == releaseId) {
        isLatest = true;
      }
    }
    setReleaseData({
      ...res.data,
      is_latest: isLatest
    });
    res.data.is_latest = isLatest;
    return res;
  };

  const refreshRelease = async () => {
    setLoading(true);
    try {
      const res = await getRelease();
      setForm(buildForm(res.data));
    } catch (err) {
      console.error("Failed to refresh release", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAssets = async () => {
    try {
      const res = await getRelease();
      setForm((prev) => ({
        ...prev,
        assets: res.data.assets,
      }));
    } catch (err) {
      console.error("Failed to refresh assets", err);
    }
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleUpload = async () => {
    if (!form.file) return;
    setUnsaved(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("asset", form.file);
      await axios.post(`/api/release/${releaseId}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          // 🚨 Doesn't work in local (development) environment
          const { loaded, total } = progressEvent;
          const percent = Math.round((loaded * 100) / total);
          setUploadProgress(percent);
        }
      });
      await refreshAssets();
      setForm((prev) => {
        const updatedForm = { ...prev, file: null };
        setOriginalForm(updatedForm);
        return updatedForm;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadProgress(null);
      addNotification({
        type: "success",
        message: "Asset uploaded successfully!",
        timer: 5000
      });
    } catch (err) {
      setUploadProgress(null);
      addNotification({
        type: "error",
        message: "Upload failed: " + (err.response?.data?.error || err.message)
      });
      console.error("Upload failed", err);
    }
    setUnsaved(false);
  };

  const handleDeleteAsset = async (assetId, assetName) => {
    setDeletingAssetId(assetId);
    showConfirm({
      title: "Delete Asset",
      message: `Are you sure you want to delete asset "${assetName}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setUnsaved(true);
        try {
          await axios.delete(`/api/release/${releaseId}/asset/${assetId}`);
          setForm((prev) => {
            const updatedForm = { ...prev, assets: prev.assets.filter((a) => a.id !== assetId) };
            setOriginalForm(updatedForm);
            return updatedForm;
          });
          addNotification({
            type: "success",
            message: "Asset deleted successfully!",
            timer: 5000
          });
        } catch (err) {
          addNotification({
            type: "error",
            message: "Failed to delete asset: " + (err.response?.data?.error || err.message)
          });
          console.error("Failed to delete asset", err);
        }
        setDeletingAssetId(null);
        setUnsaved(false);
      },
      onCancel: () => setDeletingAssetId(null)
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`/api/release/${releaseId}/edit`, {
        tag_name: form.tag_name,
        name: form.name,
        body: form.body,
        draft: form.draft,
        prerelease: form.prerelease,
        make_latest: form.is_latest ? "true" : "false",
      });
      await refreshRelease();
      setOriginalForm({ ...form });
      setUnsaved(false);
      addNotification({
        type: "success",
        message: "Release saved successfully!",
        timer: 5000
      });
    } catch (err) {
      addNotification({
        type: "error",
        message: "Save failed: " + (err.response?.data?.error || err.message)
      });
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="is-flex is-justify-content-center is-align-items-center" style={{ minHeight: "60vh" }}>
        <div className="box has-text-centered">
          <span className="is-size-4 has-text-grey">Loading release...</span>
        </div>
      </div>
    );
  }

  const disableLatest = !!form.draft || !!form.prerelease || !!releaseData.is_latest;

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
      <h2 className="title is-4">
        Edit Release <span className="has-text-grey">#{releaseId}</span>
      </h2>
      <div className="field">
        <label className="label">Tag</label>
        <div className="control">
          <input
            className="input"
            name="tag_name"
            value={form.tag_name}
            onChange={handleChange}
            placeholder="v1.0.0"
            readOnly={true}
            disabled={true}
            style={{ cursor: "auto" }}
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
            disabled={saving || loading}
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
            disabled={saving || loading}
          />
        </div>
      </div>
      <div className="field mt-5">
        <label className="label">Upload New Asset</label>
        <div className="control is-flex">
          <input
            type="file"
            className="input mr-2"
            name="file"
            ref={fileInputRef}
            onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files[0] }))}
            disabled={uploadProgress !== null || saving || loading}
          />
          <button
            className={`button ${uploadProgress !== null ? "is-danger" : "is-info"} is-outlined`}
            onClick={handleUpload}
            disabled={!form.file || uploadProgress !== null || saving || loading}
          >
            {uploadProgress !== null ? (
              <span className="icon is-small">
                <i className="fas fa-sync fa-spin"></i>
              </span>
            ) : (
              "Upload"
            )}
          </button>
        </div>
        {uploadProgress !== null && (
          <div className="is-flex is-align-items-center mt-2">
            <progress
              className="progress is-info mb-0"
              value={uploadProgress}
              max="100"
            />
            <span className="ml-2">{uploadProgress}%</span>
          </div>
        )}
      </div>
      <div className="field mt-5">
        <label className="label">Assets</label>
        {form.assets && form.assets.length > 0 ? (
          <table className="table is-fullwidth is-striped">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.assets.map((a) => (
                <tr
                  key={a.id}
                  className={deletingAssetId === a.id ? "has-background-danger-dark" : undefined}
                >
                  <td>{a.name}</td>
                  <td>{formatSize(a.size)}</td>
                  <td>
                    <a
                      href={a.browser_download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="button is-small is-info is-dark"
                      title="Download"
                    >
                      <span className="icon">
                        <i className="fas fa-download"></i>
                      </span>
                    </a>
                    <button
                      className="button is-small is-danger is-dark ml-3"
                      onClick={() => handleDeleteAsset(a.id, a.name)}
                      disabled={saving || loading || deletingAssetId === a.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="has-text-grey-light">No assets uploaded</p>
        )}
      </div>
      <div className="field is-grouped mt-5">
        <label className="label mr-4">Set as:</label>
        <div className="control">
          {releaseData.draft && (
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
                disabled={saving || loading}
              />{" "}
              Draft
            </label>
          )}
          <label className="checkbox mr-3">
            <input
              type="checkbox"
              name="prerelease"
              checked={!!form.prerelease}
              onChange={e => {
                const checked = e.target.checked;
                if (checked) {
                  // If prerelease is checked, disable and uncheck is_latest
                  setForm((prev) => ({
                    ...prev,
                    prerelease: checked,
                    is_latest: false
                  }));
                } else {
                  // If prerelease is unchecked, set is_latest back to "releaseData.is_latest"
                  setForm((prev) => ({
                    ...prev,
                    prerelease: checked,
                    is_latest: releaseData.is_latest
                  }));
                }
              }}
              disabled={saving || loading}
            />{" "}
            Pre-release
          </label>
          <label className="checkbox" disabled={disableLatest}>
            <input
              type="checkbox"
              name="is_latest"
              checked={!!form.is_latest}
              disabled={disableLatest || saving || loading}
              onChange={e => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  is_latest: checked,
                  draft: false,
                  prerelease: false
                }));
              }}
            />{" "}
            Latest release
          </label>
        </div>
      </div>
      <div className="field mt-5">
        <div className="control is-flex">
          <button className="button is-primary is-dark mr-2" onClick={handleSave} disabled={!unsaved || saving || loading}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="button is-danger is-dark"
            onClick={() => {
              if (unsaved) {
                showConfirm({
                  title: "Cancel Edit",
                  message: "You have unsaved changes. Are you sure you want to cancel?",
                  confirmText: "Yes, Cancel",
                  cancelText: "Back",
                  onConfirm: () => navigate("/"),
                });
              } else {
                navigate("/");
              }
            }}
            disabled={saving || loading}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="notify is-overlay is-position-fixed">
        {notifications.map((n, idx) => (
          <div
            key={idx}
            className={`notification is-${n.type === "success" ? "success" : "danger"}`}
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
