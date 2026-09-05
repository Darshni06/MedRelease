import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ConfigurationItems from "./pages/ConfigurationItems";
import ConfigurationItemDetail from "./pages/ConfigurationItemDetail";
import DependencyGraph from "./pages/DependencyGraph";
import Baselines from "./pages/Baselines";
import ChangeRequests from "./pages/ChangeRequests";
import ChangeRequestDetail from "./pages/ChangeRequestDetail";
import Versions from "./pages/Versions";
import VersionDetail from "./pages/VersionDetail";
import GitHubIntegration from "./pages/GitHubIntegration";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/organizations"
                element={
                  <ProtectedRoute adminOnly>
                    <Organizations />
                  </ProtectedRoute>
                }
              />
              <Route path="/organizations/:id" element={<OrganizationDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/configuration-items" element={<ConfigurationItems />} />
              <Route path="/configuration-items/:id" element={<ConfigurationItemDetail />} />
              <Route path="/dependency-graph" element={<DependencyGraph />} />
              <Route path="/baselines" element={<Baselines />} />
              <Route path="/change-requests" element={<ChangeRequests />} />
              <Route path="/change-requests/:id" element={<ChangeRequestDetail />} />
              <Route path="/versions" element={<Versions />} />
              <Route path="/versions/:id" element={<VersionDetail />} />
              <Route path="/github" element={<GitHubIntegration />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute adminOnly>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
