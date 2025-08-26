import { useState } from "react";
import axios from "axios";

export default function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    try {
      await axios.post("/api/login", { user, repo, token });
      // Fetch user info including token after login
      const res = await axios.get("/api/me");
      if (res.data.loggedIn) {
        onLogin({
          username: res.data.user,
          repo: res.data.repo,
          token: res.data.token,
          canWrite: res.data.canWrite
        });
      } else {
        setError("Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="container">
      <h1 className="title">GitHub Release Manager Login</h1>
      <form onSubmit={handleSubmit} autoComplete="on">
        {error && <div className="notification is-danger">{error}</div>}

        <div className="field">
          <label className="label">Username</label>
          <div className="control">
            <input
              className="input"
              name="username"
              autoComplete="username"
              value={user}
              onChange={e => setUser(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Repository</label>
          <div className="control">
            <input
              className="input"
              name="repository"
              autoComplete="repository"
              value={repo}
              onChange={e => setRepo(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Personal Access Token (optional)</label>
          <div className="control">
            <input
              className="input"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <div className="control">
            <button className="button is-primary is-dark" type="submit">Login</button>
          </div>
        </div>
      </form>
    </div>
  );
}
