import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login.jsx";
import ReleaseList from "./components/ReleaseList.jsx";
import EditRelease from "./components/EditRelease.jsx";
import NewRelease from "./components/NewRelease.jsx";
import axios from "axios";

import 'bulma/css/bulma.min.css';
import './index.css';

axios.defaults.withCredentials = true; // send cookies

export function useModal() {
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Cancel",
    onConfirm: null,
    onCancel: null,
  });

  const showConfirm = ({ title, message, confirmText = "OK", cancelText = "Cancel", onConfirm, onCancel }) => {
    setModal({
      show: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  const hideModal = () => setModal((prev) => ({ ...prev, show: false }));

  const ModalComponent = modal.show ? (
    <div className="modal is-active">
      <div
        className="modal-background"
        // onClick={hideModal}
      ></div>
      <div className="modal-content">
        <div className="box has-text-centered">
          {modal.title && <p className="is-size-5 mb-2">{modal.title}</p>}
          <p className="mb-4">{modal.message}</p>
          <button className="button is-danger is-dark mr-2" onClick={() => { hideModal(); modal.onConfirm && modal.onConfirm(); }}>
            {modal.confirmText}
          </button>
          <button className="button" onClick={() => { hideModal(); modal.onCancel && modal.onCancel(); }}>
            {modal.cancelText}
          </button>
        </div>
      </div>
      {/* <button className="modal-close is-large" aria-label="close" onClick={hideModal}></button> */}
    </div>
  ) : null;

  return [showConfirm, ModalComponent];
}

function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return show ? (
    <button
      className="back-to-top button is-info is-outlined is-position-fixed"
      onClick={scrollToTop}
      title="Back to top"
    >
      <span className="icon"><i className="fas fa-arrow-up"></i></span>
    </button>
  ) : null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, ModalComponent] = useModal();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/me");
        if (res.data.loggedIn) {
          setUser({
            username: res.data.user,
            repo: res.data.repo,
            token: res.data.token,
            canWrite: res.data.canWrite
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    showConfirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmText: "Yes, Logout",
      cancelText: "Cancel",
      onConfirm: async () => {
        await axios.post("/api/logout");
        setUser(null);
      }
    });
  };

  if (loading) return (
    <section className="section">
      <div className="is-flex is-justify-content-center is-align-items-center" style={{ minHeight: "100vh" }}>
        <div className="container has-text-centered">
          <span className="is-size-4 has-text-grey">Loading...</span>
        </div>
      </div>
    </section>
  );

  return (
    <Router>
      <section className="section">
        {user && (
          <div className="is-flex is-justify-content-end mb-4">
            <button className="button is-small is-danger" onClick={handleLogout}>
              <span className="icon"><i className="fas fa-sign-out-alt"></i></span>
              <span>Logout</span>
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login onLogin={u => setUser(u)} />}
          />
          <Route
            path="/"
            element={user ? <ReleaseList user={user} showConfirm={showConfirm} /> : <Navigate to="/login" />}
          />
          <Route
            path="/:repoName/edit/:releaseId"
            element={
              user
                ? <EditRelease user={user} showConfirm={showConfirm} />
                : <Navigate to="/login" />
            }
          />
          <Route
            path="/new"
            element={
              user
                ? <NewRelease user={user} showConfirm={showConfirm} />
                : <Navigate to="/login" />
            }
          />
        </Routes>
        {ModalComponent}
        <BackToTopButton />
      </section>
    </Router>
  );
}

export default App;
