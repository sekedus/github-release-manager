# GitHub Release Manager

A web-based tool to manage GitHub releases, assets, and tags for your repositories.

## Features

- List, search, and filter releases (by tag, name, or asset digest)
- Create new releases with assets
- Edit and delete releases
- Upload and delete release assets
- Mark releases as draft, pre-release, or latest
- Pagination and auto/manual refresh
- Login with GitHub Personal Access Token (PAT).  
  > required for private repositories or if you exceed the GitHub API rate limit

<!-- ㅤ
## Project Structure

```
github-release-manager/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── uploads/
├── frontend/
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   ├── index.css
│   │   ├── utils.js
│   │   └── components/
│   │       ├── EditRelease.jsx
│   │       ├── Login.jsx
│   │       ├── NewRelease.jsx
│   │       └── ReleaseList.jsx
├── package.json
``` -->

ㅤ
## Prerequisites

- Node.js (v20+)
- npm
- MongoDB (required for production)

ㅤ
## Local development

1. Clone repository
   ```sh
   git clone https://github.com/sekedus/github-release-manager.git
   cd github-release-manager
   ```

2. Install dependencies
   ```sh
   npm run dev:install
   ```

3. Configure backend environment

   Copy `backend/.env.example` to `backend/.env` (or create `backend/.env`) and set:

   ```
   NODE_ENV=development
   SESSION_SECRET=your_secret
   SESSION_NAME=your_session_name
   ```

   Keep `SESSION_SECRET` strong and private.

   You can leave `MONGO_URL` empty for local development (MemoryStore is used unless `NODE_ENV=production`).

4. Start development (runs backend + frontend)
   ```sh
   npm run dev:start
   ```
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

ㅤ
## Production / Deployment

In production you should enable MongoDB-backed sessions to avoid MemoryStore warnings and session loss across processes.

1. Prepare MongoDB

   - Use a managed MongoDB (Atlas) or self-hosted instance.
   - Example URI:
     ```
     mongodb://username:password@host:port/ghrm
     # or
     mongodb+srv://user:pass@cluster.mongodb.net/ghrm
     ```

2. Set production environment variables (set them on your server)

   ```
   NODE_ENV=production
   PORT=5000  # optional
   SESSION_SECRET=<strong_session_secret>
   SESSION_NAME=ghrm_connect.sid
   MONGO_URL=<your_mongo_connection_string>
   ```

   **Notes**:
   - Keep `SESSION_SECRET` strong and private.
   - Ensure the `uploads/` folder (backend/uploads) is writable by the server process.
   - Monitor disk usage of `uploads/` and implement cleanup if needed.

3. Install backend and build frontend

   ```sh
   npm run build
   ```

   This runs installs backend/frontend deps, builds the frontend and copies `frontend/build` to `backend/public`.

4. Start backend

   ```sh
   npm run start
   ```

5. Verify

   Open your server URL (port as configured). Sessions will be persisted to MongoDB when `NODE_ENV=production` and `MONGO_URL` is set.

ㅤ
> [!IMPORTANT]
> 
> If you use MongoDB Atlas in production you must allow your app to connect by configuring Atlas IP access. You can either:
> - Add your server IP(s) or CIDR to Atlas' IP Access List (or **allow access from anywhere**) — see: https://www.mongodb.com/docs/atlas/security/ip-access-list/#enter-an-ip-address---block--or-security-group-id.
> - Or avoid opening Atlas to `0.0.0.0/0` by using a helper that manages Atlas IP entries dynamically, for example `mongodbautoip`: https://www.npmjs.com/package/mongodbautoip
>
> Choose the approach that fits your security posture.

ㅤ
## Usage

- **Login:**
  - Public repositories, simply enter your GitHub `username` and `repository name`.
  - Private repositories, you must provide a GitHub `personal access token` (PAT).
- **View Releases:** See all releases for your repository.
- **Search:** Filter releases by tag, name, or asset digest.
- **Create/Edit/Delete:** Manage releases and assets easily.

ㅤ
## Configuration

- **Backend:**
  - Uses Express.js and Octokit for GitHub API.
  - `.env` required for session secrets
  - Sessions use MemoryStore in development and MongoStore in production when `MONGO_URL` is set.

- **Frontend:**
  - React + Bulma CSS.
  - Proxy set to backend for API calls.

<!-- ## Scripts

- `npm run dev:start` — Start both backend and frontend in development mode.
- `npm start` (in `frontend/`) — Start React app only.
- `npm start` (in `backend/`) — Start backend API only. -->

ㅤ
## License

This project is licensed under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See the [LICENSE](./LICENSE-CC-BY-NC-SA) file for more details.

[![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
