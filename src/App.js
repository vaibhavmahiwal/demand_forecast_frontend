import React, { useState, useEffect } from "react";
import Map from './Map';
import { BASE_URL } from "./config";
const API_URL = BASE_URL;

// Keyframes for Tailwind CSS animations (must be defined in head or style tag)
const tailwindConfig = `
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes blob {
      0% {
        transform: translate(0px, 0px) scale(1);
      }
      33% {
        transform: translate(30px, -50px) scale(1.1);
      }
      66% {
        transform: translate(-20px, 20px) scale(0.9);
      }
      100% {
        transform: translate(0px, 0px) scale(1);
      }
    }
    .animate-blob {
      animation: blob 7s infinite;
    }
    .animation-delay-2000 {
      animation-delay: 2s;
    }
    .animation-delay-4000 {
      animation-delay: 4s;
    }
    .animate-fadeInUp {
        animation: fadeInUp 0.3s ease-out forwards;
    }
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
  </style>
`;

function App() {
  // States
  const [userData, setUserData] = useState({});
  const [projects, setProjects] = useState([]);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [modals, setModals] = useState({
    project: false,
    signup: false,
    login: false,
    projectDetails: false,
  });
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedAdminLevel, setSelectedAdminLevel] = useState("");

  // Flask API URL (FIXED: Using 127.0.0.1 for stability)

  // State mapping for admin oversight
  const stateMapping = {
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Meerut", "Agra", "Varanasi"],
    Maharashtra: ["Mumbai", "Pune", "Nagpur"],
    Karnataka: ["Bengaluru", "Mysore"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "West Bengal": ["Kolkata", "Siliguri"],
    Rajasthan: ["Jaipur", "Jodhpur"],
    Gujarat: ["Ahmedabad", "Surat"],
    Telangana: ["Hyderabad", "Warangal"],
    Delhi: ["Delhi"],
  };

  // Custom message box function
  const showCustomMessage = (msg) => {
    setMessage(msg);
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
      setMessage("");
    }, 3000);
  };

  // Add activity log
  const logActivity = (msg) => {
    setActivityLog((prev) => [msg, ...prev]);
  };

  // --- Data Fetching Function (Refreshes project list from DB) ---
  const fetchProjects = async (email) => {
    if (!email) {
      setProjects([]);
      return;
    }
    try {
      // SECURED GET: Pass email in query parameter for authorization/filtering
      const response = await fetch(`${API_URL}/projects?email=${email}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch projects.");
      }
      
      const fetchedProjects = await response.json();
      setProjects(fetchedProjects);
    } catch (error) {
      showCustomMessage(`Error loading projects: ${error.message}`);
      console.error("Error loading projects:", error);
    }
  };

  // --- useEffect to load data on login ---
  useEffect(() => {
    // Fetch projects whenever the user logs in/changes
    if (userData.email) {
      fetchProjects(userData.email);
    } else {
      setProjects([]); // Clear projects on logout
    }
  }, [userData.email]);


  // Get user's state based on role and location
  const getUserState = (location) => {
    for (const [state, cities] of Object.entries(stateMapping)) {
      if (cities.includes(location)) {
        return state;
      }
    }
    return "Unknown";
  };

  // Filter projects for admin based on their admin level and state
  const getAdminProjects = () => {
    if (userData.role !== "admin") return [];
    
    // The backend now handles filtering, but we can add additional filtering here if needed
    return projects.map(project => {
      // Add a status label for display
      let statusLabel = project.status;
      if (project.status === 'pending') {
        statusLabel = 'Pending State Approval';
      } else if (project.status === 'pending central approval') {
        statusLabel = 'Pending Central Approval';
      } else if (project.status === 'approved') {
        statusLabel = 'Approved';
      } else if (project.status === 'declined') {
        statusLabel = 'Declined';
      }
      
      return {
        ...project,
        statusLabel
      };
    });
  };

  // --- FIXED: Project Creation Handler (POST to Flask) ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    if (!userData.email) {
        showCustomMessage("Error: You must be logged in to create a project.");
        return;
    }

    // 1. Prepare input features (for ML model)
    const inputFeatures = {
      projectName: form.projectName.value,
      budget: form.budget.value,
      location: form.location.value,
      towerType: form.towerType.value,
      substationType: form.substationType.value,
      geo: form.geo.value,
      taxes: form.taxes.value,
    };

    // 2. Prepare project details (for DB save)
    let status = "pending"; // Default for employees
    
    if (userData.role === "admin") {
      if (userData.admin_level === "central") {
        status = "approved"; // Central admin projects are auto-approved
      } else if (userData.admin_level === "state") {
        status = "pending central approval"; // State admin projects need central approval
      }
    }
    
    const projectDetails = {
      createdBy: userData.email, 
      status: status,
      createdAt: new Date().toLocaleString(),
    };

    // 3. Prepare authenticated payload
    const payload = {
        email: userData.email, // <-- AUTHENTICATION PROXY
        input_features: inputFeatures, // <-- ML FEATURES
        project_details: projectDetails, // <-- DB DETAILS
    };

    try {
      // POST to unified endpoint /api/projects
      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Prediction and save failed.");
      }

      const responseData = await response.json();
      const newProject = responseData.project; 

      // Refresh projects to get the official data list from DB
      await fetchProjects(userData.email);
      
      logActivity(`Created project ID ${newProject.id} for: ${newProject.location} (Status: ${newProject.status})`);
      form.reset();
      setModals({ ...modals, project: false });

      setShowDashboard(true);
      let successMessage = `Demand forecasted! (DB ID: ${newProject.id})`;
      
      if (userData.role === "admin") {
        if (userData.admin_level === "central") {
          successMessage = `Demand forecasted and auto-approved! (DB ID: ${newProject.id})`;
        } else if (userData.admin_level === "state") {
          successMessage = `Demand forecasted! Awaiting central admin approval. (DB ID: ${newProject.id})`;
        }
      } else {
        successMessage = `Demand forecasted! Awaiting state admin approval. (DB ID: ${newProject.id})`;
      }
      
      showCustomMessage(successMessage);
    } catch (error) {
      showCustomMessage(`Error: ${error.message}`);
      console.error("Error creating project:", error);
    }
  };

  // --- FIXED: Project detail lookup ---
  const handleOpenProjectDetails = (projectToOpen) => {
    // Find the project index based on the ID after a potential re-fetch
    const index = projects.findIndex(p => p.id === projectToOpen.id);
    if (index === -1) {
        showCustomMessage("Error: Could not find project details.");
        return;
    }
    setCurrentProjectIndex(index);
    setModals({ ...modals, projectDetails: true });
  };

  // --- FIXED: Project Deletion Handler (DELETE to Flask for persistence) ---
  const handleDeleteProject = async () => {
    if (currentProjectIndex === null) return;

    const projectToDelete = projects[currentProjectIndex];
    const projectId = projectToDelete.id;

    try {
      // SECURED DELETE: Pass email in body for authorization check
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userData.email }), 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Deletion failed due to authorization.");
      }

      // Deletion successful on server, refresh the local list from DB
      await fetchProjects(userData.email);

      logActivity(`Deleted project ID ${projectId} for: ${projectToDelete.location}`);
      setModals({ ...modals, projectDetails: false });
      setCurrentProjectIndex(null);
      showCustomMessage(`Project ID ${projectId} deleted successfully.`);

    } catch (error) {
      showCustomMessage(`Error: ${error.message}`);
      console.error("Error deleting project:", error);
    }
  };

  // --- Enhanced Admin project action with role-based validation ---
  const handleProjectAction = async (projectId, action) => {
    // Check if the current user is an Admin
    if (userData.role !== 'admin') {
      showCustomMessage("Error: Only Administrators can perform project actions.");
      return;
    }

    // Find the project being acted upon
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      showCustomMessage('Error: Project not found');
      return;
    }

    // State admin validations
    if (userData.admin_level === 'state') {
      // State admins can only approve pending projects in their state
      if (action === 'approved' && project.status !== 'pending') {
        showCustomMessage('Only pending projects can be approved at state level');
        return;
      }
      
      // Check if project is in admin's state
      const projectState = Object.entries(stateMapping).find(([state, cities]) => 
        cities.includes(project.location)
      )?.[0];
      
      if (projectState !== userData.state) {
        showCustomMessage('You can only approve projects in your state');
        return;
      }
    }

    // Central admin validations
    if (userData.admin_level === 'central' && action === 'approved' && 
        project.status !== 'pending central approval') {
      showCustomMessage('Only projects pending central approval can be approved at central level');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: userData.email,
          status: action
        }), 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} project.`);
      }

      // Refresh projects after successful update
      await fetchProjects(userData.email); 
      
      // Show appropriate success message
      const actionText = action === 'approved' ? 'approved' : 'rejected';
      logActivity(`${actionText} project ID: ${projectId}`);
      showCustomMessage(`Project ${actionText} successfully!`);

    } catch (error) {
      console.error(`Error updating project ${projectId}:`, error);
      showCustomMessage(`Error: ${error.message}`);
      
      // Fallback for demonstration if API fails (temporarily update local state)
      setProjects((prev) =>
        prev.map((project) => {
          if (project.id === projectId) {
            return { ...project, status: action };
          }
          return project;
        })
      );
    }
  };

// --- UPDATED: User signup using API instead of MOCK_USERS ---
const handleSignup = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;
    const role = form.role.value;
    const adminLevel = form.admin_level ? form.admin_level.value : null;
    
    // Only include state if not a central admin
    const signupData = { 
      name, 
      email, 
      password, 
      role, 
      admin_level: adminLevel 
    };
    
    // Add state only if not a central admin
    if (role === 'employee' || (role === 'admin' && adminLevel === 'state')) {
      signupData.state = form.state.value;
    }

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send all registration fields to the Flask backend including admin_level
        body: JSON.stringify(signupData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Throw an error if the HTTP status is not 2xx
        throw new Error(responseData.message || "Failed to create account. User might already exist.");
      }

      // Assuming successful signup auto-logs in and returns user details
      const loggedInUser = {
        name: responseData.user.name,
        email: responseData.user.email,
        role: responseData.user.role,
        state: responseData.user.state,
        admin_level: responseData.user.admin_level,
      };

      setUserData(loggedInUser);
      logActivity("Account created and logged in via API.");
      showCustomMessage(`Account created successfully! Welcome, ${loggedInUser.name}.`);
      setModals({ project: false, signup: false, login: false, projectDetails: false });
      setSelectedRole("");

    } catch (error) {
      showCustomMessage(`Signup Error: ${error.message}`);
      console.error("Signup error:", error);
    }
};

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;
    
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send credentials to the Flask backend for verification
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Throw an error if authentication failed
        throw new Error(responseData.message || "Invalid credentials. Please check your email and password.");
      }

      // Assuming successful login returns user details
      const loggedInUser = {
        name: responseData.user.name,
        email: responseData.user.email,
        role: responseData.user.role,
        state: responseData.user.state,
        admin_level: responseData.user.admin_level,
      };
      
      setUserData(loggedInUser);
      logActivity(`Logged in successfully as ${loggedInUser.role} via API`);
      showCustomMessage(`Login successful! Role: ${loggedInUser.role}`);
      setModals({ ...modals, login: false });

    } catch (error) {
      showCustomMessage(`Login Error: ${error.message}`);
      console.error("Login error:", error);
    }
};

  // Render functions
  const renderForecasts = (forecasts) => {
    if (!forecasts) return <p className="text-gray-500">N/A</p>;
    const modelNames = Object.keys(forecasts).sort();

    return (
      <div className="pt-5 space-y-3">
        <h4 className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent tracking-tight">
          Material Forecasts (MT)
        </h4>
        <div className="grid grid-cols-2 gap-4 text-gray-800">
          {modelNames.map((modelName) => (
            <p
              key={modelName}
              className="relative p-[1px] rounded-xl bg-gradient-to-tr from-emerald-400/70 via-teal-500/70 to-lime-500/70 transition-transform hover:scale-[1.01]"
            >
              <span className="block bg-white/80 backdrop-blur-sm rounded-[11px] p-3 shadow-sm">
                <strong className="text-gray-900">{modelName.charAt(0).toUpperCase() + modelName.slice(1)}:</strong>
                {forecasts[modelName] ? ` ${parseFloat(forecasts[modelName]).toFixed(2)}` : " N/A"}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const statusText = status?.toLowerCase() || '';
    
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 ring-yellow-300/50",
      'pending state approval': "bg-yellow-100 text-yellow-800 ring-yellow-300/50",
      'pending central approval': "bg-orange-100 text-orange-800 ring-orange-300/50",
      'pending central': "bg-orange-100 text-orange-800 ring-orange-300/50",
      approved: "bg-green-100 text-green-800 ring-green-300/50",
      "auto-approved": "bg-emerald-100 text-emerald-800 ring-emerald-300/50",
      declined: "bg-red-100 text-red-800 ring-red-300/50",
      deleted: "bg-gray-100 text-gray-800 ring-gray-300/50",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ring-1 shadow-sm ${colors[status] || colors.pending} uppercase tracking-wide`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Dashboard Component
  const Dashboard = ({ projects, goBack }) => {
    // Filter projects to ensure we only show the *user's* latest project for the dashboard view
    const userProjects = projects.filter(p => p.createdBy === userData.email);
    const lastProject = userProjects.length > 0 ? userProjects[userProjects.length - 1] : null;

    return (
      <div className="p-8 flex-1">
        <div className="relative rounded-3xl p-8 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-gray-200/50 border border-white/20 h-full">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-lime-400/5" />
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Forecast Dashboard</h2>
              <p className="text-gray-600">AI-powered material demand predictions</p>
            </div>
          </div>
          {lastProject ? (
            <div className="space-y-6">
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50">
                <p className="text-gray-700 text-lg">
                  ✅ The prediction engine successfully ran forecasts for all 7 key materials.
                </p>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {lastProject.projectName || 'Project Details'}
              </h3>
              <p className="text-gray-600 mb-6 flex items-center gap-2">
                <span className="text-sm bg-gray-100 px-2 py-1 rounded-full">ID: {lastProject.id}</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Project Information</h4>
                  <div className="space-y-3">
                    <div><span className="text-gray-600">Location:</span> <span className="font-semibold text-gray-900">{lastProject.location}</span></div>
                    <div><span className="text-gray-600">Budget:</span> <span className="font-semibold text-gray-900">{lastProject.budget}</span></div>
                    <div><span className="text-gray-600">Tower Type:</span> <span className="font-semibold text-gray-900">{lastProject.towerType}</span></div>
                    <div><span className="text-gray-600">Substation:</span> <span className="font-semibold text-gray-900">{lastProject.substationType}</span></div>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Additional Details</h4>
                  <div className="space-y-3">
                    <div><span className="text-gray-600">Geography:</span> <span className="font-semibold text-gray-900">{lastProject.geo}</span></div>
                    <div><span className="text-gray-600">Taxes:</span> <span className="font-semibold text-gray-900">{lastProject.taxes}</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Status:</span> 
                      {getStatusBadge(lastProject.status)}
                    </div>
                  </div>
                </div>
              </div>
              {renderForecasts(lastProject.allForecasts)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600 text-lg">No project data to display. Create a new project!</p>
              </div>
            </div>
          )}
          <button
            onClick={goBack}
            className="mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    );
  };

  // Admin Dashboard Component
  const AdminDashboard = () => {
    const adminProjects = getAdminProjects();
    return (
        <div className="p-8 flex-1">
        <div className="relative rounded-3xl p-8 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-gray-200/50 border border-white/20 h-full">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-red-400/5" />
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-sm opacity-75"></div>
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
              <p className="text-gray-600">
                {userData.admin_level === "central" 
                  ? "Managing projects requiring central approval" 
                  : `Managing projects in ${userData.state}`}
              </p>
            </div>
          </div>
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/50">
            <p className="text-gray-700 text-lg">
              🔧 {userData.admin_level === "central" 
                  ? "Manage projects submitted by state admins requiring central approval." 
                  : "Manage projects submitted by employees in your state requiring approval."} 
              Total Projects: {adminProjects.length}
            </p>
          </div>

          {adminProjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-20 w-20 mx-auto mb-6 rounded-3xl bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center">
                <svg className="h-10 w-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
                <p className="text-gray-600">No projects have been submitted in your state yet.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {adminProjects.map((project) => (
                <div
                  key={project.id}
                  className="group relative p-6 rounded-3xl bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:border-purple-200 transition-all duration-200 hover:shadow-lg"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                        <h4 className="text-xl font-bold text-gray-900">Project ID: {project.id} in {project.location} - {project.projectName || ''}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Created by:</span>
                          <span className="font-medium text-gray-900 ml-2">{project.createdBy}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Budget:</span>
                          <span className="font-medium text-gray-900 ml-2">{project.budget}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="font-medium text-gray-900 ml-2">{project.createdAt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Status:</span>
                          {getStatusBadge(project.statusLabel || project.status)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {((project.status === "pending" && userData.role === 'admin' && userData.admin_level === 'state') || 
                     (project.status === "pending central approval" && userData.role === 'admin' && userData.admin_level === 'central')) && (
                      <>
                        <button
                          onClick={() => handleProjectAction(project.id, "approved")}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {project.status === 'pending' ? 'Approve (State)' : 'Approve (Central)'}
                        </button>
                        <button
                          onClick={() => handleProjectAction(project.id, "declined")}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Decline
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleOpenProjectDetails(project)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12h-6m6 0h6m-6 0v6m0-6V6"/>
                        </svg>
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowAdminDashboard(false)}
            className="mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    );
  };


  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-emerald-300/40 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30"
    >
      {/* Tailwind CSS config and keyframes */}
      <div dangerouslySetInnerHTML={{ __html: tailwindConfig }} />
      
      {/* Modern animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-10 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-lime-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </div>
      
      <nav className="relative z-10 mx-4 mt-4 rounded-3xl bg-white/80 backdrop-blur-xl text-gray-900 px-8 py-5 flex justify-between items-center shadow-2xl ring-1 ring-gray-200/50 border border-white/20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg">
              <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 300.000000 300.000000" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(0.000000,300.000000) scale(0.050000,-0.050000)" fill="#ffffff" stroke="none">
                  <path d="M2870 4775 c-5 -14 -17 -61 -26 -105 l-16 -80 -345 -5 -346 -6 -103 -69 -103 -70 159 1 c109 0 172 10 199 30 30 22 105 29 335 29 l296 0 -2 -55 c0 -30 -6 -44 -11 -30 -18 44 -162 31 -177 -15 -12 -38 -30 -40 -452 -40 l-440 0 -49 -53 c-27 -29 -45 -58 -39 -64 18 -17 198 -2 219 19 31 30 956 23 946 -7 -5 -15 -53 -27 -123 -31 -78 -4 -118 -15 -125 -36 -10 -25 -88 -29 -513 -27 l-502 2 -35 -47 c-58 -75 -47 -96 52 -96 59 0 95 10 106 30 20 37 1101 37 1110 0 3 -12 -56 -22 -138 -26 -95 -4 -152 -15 -168 -35 -20 -24 -113 -29 -544 -29 -542 0 -571 -5 -574 -88 -1 -11 286 -13 709 -6 618 11 710 9 710 -17 0 -23 -34 -29 -178 -29 -132 0 -183 -8 -202 -30 -20 -24 -116 -30 -565 -35 l-540 -5 -17 -46 -17 -45 759 5 c673 5 760 2 760 -25 0 -26 -30 -29 -196 -23 -162 7 -200 3 -222 -24 -24 -28 -96 -32 -582 -32 -580 0 -580 0 -580 -82 0 -10 324 -18 790 -18 706 0 790 -3 790 -32 0 -27 -30 -30 -209 -26 -174 4 -216 -1 -247 -28 -33 -30 -101 -34 -601 -34 l-563 0 0 -45 0 -45 800 0 c517 0 802 -7 805 -20 3 -12 -62 -22 -158 -26 -113 -4 -171 -15 -188 -35 -20 -24 -125 -29 -651 -29 l-628 0 0 -50 0 -51 755 1 c509 1 757 -5 761 -19 4 -12 -26 -21 -74 -21 -60 0 -88 -11 -107 -40 -24 -39 -46 -40 -680 -40 l-655 0 0 -45 0 -45 770 7 c693 6 770 3 770 -25 0 -26 -23 -32 -118 -32 -80 0 -125 -10 -142 -30 -21 -25 -119 -30 -650 -30 l-624 0 10 -53 10 -52 757 9 c618 7 757 4 757 -18 0 -19 -37 -26 -138 -26 -97 0 -144 -9 -162 -30 -21 -25 -114 -30 -604 -30 l-579 0 7 -45 6 -45 750 -3 c586 -2 750 -8 750 -28 0 -18 -45 -24 -172 -21 -134 3 -177 -2 -197 -27 -22 -27 -100 -31 -553 -31 -291 0 -528 -7 -528 -16 0 -87 16 -89 756 -81 554 5 704 2 704 -18 0 -18 -55 -25 -211 -25 -168 0 -213 -6 -222 -30 -10 -25 -81 -30 -469 -30 -252 0 -458 -7 -457 -15 3 -90 21 -92 719 -79 575 12 660 9 660 -16 0 -25 -41 -30 -238 -30 -185 0 -243 -7 -262 -30 -19 -23 -97 -30 -390 -35 -358 -5 -366 -6 -339 -44 27 -36 56 -38 639 -33 544 5 610 2 610 -26 0 -28 -38 -32 -279 -32 -261 0 -281 -3 -308 -42 -28 -40 -44 -42 -261 -35 -243 8 -255 4 -194 -51 35 -32 82 -33 550 -20 468 13 512 11 512 -19 0 -29 -36 -33 -318 -33 -264 0 -320 -5 -329 -30 -8 -21 -41 -30 -112 -30 -56 0 -101 -9 -101 -19 0 -53 97 -65 483 -62 347 3 397 -1 397 -28 0 -27 -45 -31 -325 -32 -368 0 -381 -15 -97 -107 382 -125 701 -121 1082 12 254 89 245 96 -136 96 -297 0 -344 4 -344 31 0 27 51 31 407 28 311 -3 417 3 450 24 67 41 52 57 -55 57 -62 0 -106 11 -122 30 -20 24 -85 30 -342 30 -282 0 -318 4 -318 33 0 30 44 32 515 20 488 -12 517 -11 560 25 71 61 59 64 -190 50 -223 -12 -237 -11 -273 29 -36 40 -58 43 -325 43 -245 0 -287 5 -287 31 0 27 74 30 621 28 613 -2 679 4 679 63 0 10 -161 18 -358 18 -293 0 -362 5 -382 30 -20 24 -78 30 -282 30 -216 0 -258 5 -258 30 0 26 82 28 677 17 l676 -13 34 48 34 48 -465 5 c-386 5 -468 11 -481 35 -14 24 -66 30 -256 30 -194 0 -239 5 -239 29 0 24 106 27 742 16 625 -10 745 -7 760 17 48 76 35 78 -510 78 -459 0 -529 4 -540 31 -10 26 -48 31 -227 28 -177 -4 -216 1 -221 26 -5 26 89 28 777 19 656 -8 786 -5 801 18 48 76 37 78 -570 78 -497 0 -591 5 -612 30 -18 21 -65 30 -164 30 -103 0 -137 7 -131 25 7 20 173 23 769 18 l760 -8 10 53 10 52 -634 0 c-540 0 -639 4 -660 30 -17 20 -62 30 -142 30 -94 0 -118 6 -118 31 0 28 83 31 780 25 732 -6 780 -4 780 29 0 19 0 40 0 46 0 6 -297 10 -659 10 -642 -2 -660 -1 -681 39 -18 33 -41 40 -142 40 -80 0 -119 8 -114 22 5 16 235 21 802 19 l794 -3 0 51 0 51 -628 0 c-533 0 -631 4 -652 30 -18 22 -66 30 -172 30 -121 0 -148 6 -148 31 0 28 84 31 790 25 l790 -6 0 45 0 45 -573 0 c-514 0 -578 4 -612 34 -30 28 -77 35 -230 35 -135 1 -194 8 -200 26 -7 20 159 25 785 25 716 0 793 3 782 32 -7 17 -12 40 -12 50 0 10 -236 18 -568 18 -497 0 -570 4 -594 32 -22 27 -59 31 -212 24 -158 -7 -186 -3 -186 23 0 28 84 30 750 25 483 -4 750 0 750 13 0 83 0 83 -570 83 -467 0 -547 4 -557 30 -9 24 -51 30 -202 30 -158 0 -191 5 -191 30 0 27 84 30 710 21 391 -6 710 -5 710 1 0 85 -19 88 -558 88 -435 0 -521 5 -542 30 -18 22 -67 30 -182 30 -127 0 -158 6 -158 30 0 26 73 30 538 30 460 0 539 -4 549 -30 19 -49 233 -42 233 7 0 99 -42 107 -566 104 -424 -2 -491 1 -501 28 -9 24 -43 31 -142 31 -103 0 -131 6 -131 30 0 37 876 46 913 9 12 -12 77 -18 146 -15 l125 6 -44 55 -43 55 -434 0 c-430 0 -434 0 -453 45 -23 50 -184 57 -214 9 -9 -14 -16 -2 -16 31 l0 55 275 -1 c210 0 284 -7 314 -30 42 -32 391 -43 391 -13 0 75 -170 114 -539 124 l-369 10 -21 98 c-21 100 -75 160 -56 63 9 -46 3 -51 -53 -51 -53 0 -62 7 -62 50 0 52 -34 69 -50 25z m158 -695 c7 -115 21 -300 31 -410 36 -390 61 -643 80 -830 28 -262 31 -246 -39 -210 l-60 31 0 -710 c0 -698 -1 -711 -40 -711 -22 0 -40 7 -40 15 -1 8 -9 119 -20 245 -11 127 -33 401 -50 610 -16 209 -34 412 -40 450 -5 39 -15 160 -21 270 -6 110 -15 215 -21 233 -5 19 0 39 11 46 12 8 21 -4 21 -27 0 -33 51 -82 84 -82 4 0 10 218 12 485 2 267 10 625 18 795 l13 310 24 -150 c13 -82 29 -244 37 -360z"/>
                </g>
              </svg>
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              PrecisionGrid Analytics
            </h1>
            <p className="text-xs text-gray-500 font-medium">Material Demand Forecasting</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!userData.email && (
            <>
              <button
                className="group relative px-6 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={() => setModals({ ...modals, signup: true })}
              >
                <span className="relative font-semibold">Sign Up</span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
              </button>
              <button
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 transform hover:-translate-y-0.5"
                onClick={() => setModals({ ...modals, login: true })}
              >
                Login
              </button>
            </>
          )}
          {userData.email && (
            <>
              <button
                className="group relative px-5 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                onClick={() => setShowProfile(!showProfile)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-semibold">Profile</span>
              </button>
              {userData.role === "admin" && (
                <button
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2"
                  onClick={() => setShowAdminDashboard(true)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Panel
                </button>
              )}
              <button
                className="group relative px-5 py-2.5 rounded-2xl bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                onClick={() => {
                  setUserData({});
                  setShowProfile(false);
                  setShowDashboard(false);
                  setShowProjects(false);
                  setShowAdminDashboard(false);
                  setActivityLog([]);
                  setCurrentProjectIndex(null);
                  showCustomMessage("Logged out successfully!");
                }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-semibold">Logout</span>
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="flex flex-grow relative z-10 gap-4 mx-4 my-4">
        {userData.email && (
          <aside className="w-80 rounded-3xl bg-white/80 backdrop-blur-xl p-6 ring-1 ring-gray-200/50 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-sm opacity-50"></div>
                <div className="relative h-8 w-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Activity Feed</h3>
                <p className="text-xs text-gray-500">Recent actions</p>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityLog.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No activity yet</p>
                  <p className="text-gray-400 text-xs">Your actions will appear here</p>
                </div>
              ) : (
                activityLog.map((msg, i) => (
                  <div key={i} className="group relative p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-200/50 hover:border-emerald-200 transition-all duration-200">
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 leading-relaxed">{msg}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {showAdminDashboard ? (
          <AdminDashboard />
        ) : showDashboard ? (
          <Dashboard projects={projects} goBack={() => setShowDashboard(false)} />
        ) : showProjects ? (
          <main className="flex-1">
            <section className="relative rounded-3xl p-8 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-gray-200/50 border border-white/20 h-full">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-lime-400/5" />
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-gray-900">Your Projects</h3>
                  <p className="text-gray-600">Manage and track your material forecasting projects</p>
                </div>
              </div>
              {projects.filter((p) => p.createdBy === userData.email).length === 0 ? (
                <div className="text-center py-16">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-3xl bg-gradient-to-r from-emerald-100 to-teal-100 flex items-center justify-center">
                    <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
                  <p className="text-gray-600 mb-6">
                    You haven't created any projects yet. Start by clicking 'Create New Project'!
                  </p>
                  <button
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5"
                    onClick={() => setModals({ ...modals, project: true })}
                  >
                    Create Your First Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects
                    .filter((p) => p.createdBy === userData.email)
                    .map((project) => (
                      <div
                        key={project.id}
                        className="group cursor-pointer relative p-6 rounded-3xl bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:border-emerald-200 transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1"
                        onClick={() => handleOpenProjectDetails(project)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                            <h4 className="text-lg font-bold text-gray-900 truncate">
                              {project.location} - {project.projectName || ''}
                            </h4>
                          </div>
                          {getStatusBadge(project.status)}
                        </div>
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-gray-50/50">
                            <p className="text-sm text-gray-500">Budget</p>
                            <p className="text-lg font-semibold text-gray-900">{project.budget}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-gray-50/50">
                            <p className="text-sm text-gray-500">Created</p>
                            <p className="text-sm font-medium text-gray-900">{project.createdAt}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-gray-400">Click to view details</span>
                          <svg className="h-4 w-4 text-gray-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <button
                onClick={() => setShowProjects(false)}
                className="mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </button>
            </section>
          </main>
        ) : (
          <main className="flex-1">
            <section className="relative text-center py-20 rounded-3xl mb-8 overflow-hidden">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-emerald-50/50 to-teal-50/50 backdrop-blur-sm" />
              <div className="relative mx-auto max-w-4xl px-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100/80 text-emerald-700 text-sm font-medium mb-6">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI-Powered Forecasting
                </div>
                <h2 className="text-6xl font-black mb-6 bg-gradient-to-r from-gray-900 via-emerald-800 to-teal-800 bg-clip-text text-transparent leading-tight">
                  Material Demand
                  <br />
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Forecasting
                  </span>
                </h2>
                <p className="mt-4 text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Leverage advanced AI to predict material requirements with unprecedented accuracy. 
                  Plan smarter, build faster, and optimize your supply chain.
                </p>
                {userData.email && (
                  <div className="flex justify-center flex-wrap gap-6">
                    {/* Show Create Project button only for non-central admins */}
                    {(userData.role !== 'admin' || userData.admin_level !== 'central') && (
                      <button
                        className="group relative px-8 py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-900 font-bold shadow-lg hover:shadow-xl hover:border-emerald-300 transition-all duration-200 transform hover:-translate-y-1"
                        onClick={() => setModals({ ...modals, project: true })}
                      >
                        <span className="relative flex items-center gap-3">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Create New Project
                        </span>
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-5 transition-opacity duration-200"></div>
                      </button>
                    )}
                    
                    {/* Show My Projects button only for non-central admins */}
                    {(userData.role !== 'admin' || userData.admin_level !== 'central') && (
                      <button
                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-1 flex items-center gap-3"
                        onClick={() => setShowProjects(true)}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        My Projects
                      </button>
                    )}
                    
                    {/* Show Approval Queue button for central admins */}
                    {userData.role === 'admin' && userData.admin_level === 'central' && (
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Central Admin Dashboard</h3>
                        <p className="text-gray-600">Review and approve pending projects</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {!userData.email && (
              <section className="mx-auto max-w-7xl px-6 -mt-8 relative z-10">
                <div className="w-full max-w-4xl mx-auto p-6 rounded-3xl bg-white/80 backdrop-blur-xl ring-1 ring-gray-200/50 border border-white/20 shadow-2xl">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Project Locations</h3>
                  </div>
                  <div className="w-full flex justify-center">
                    <div className="w-full max-w-3xl">
                      <Map />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {showProfile && (
              <section className="mt-8 py-12 max-w-5xl mx-auto rounded-3xl shadow-2xl p-8 bg-white/80 backdrop-blur-xl ring-1 ring-gray-200/50 border border-white/20">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 mb-4">
                    <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold mb-2 text-gray-900">User Profile</h3>
                  <p className="text-gray-600">Manage your account information</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50 hover:border-emerald-200 transition-all duration-200">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Name</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{userData.name}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50 hover:border-emerald-200 transition-all duration-200">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Email</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{userData.email}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50 hover:border-emerald-200 transition-all duration-200">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Role</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{userData.role}</p>
                  </div>
                  {userData.role === "admin" && (
                    <>
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/50 hover:border-purple-300 transition-all duration-200">
                        <div className="flex items-center gap-3 mb-2">
                          <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Admin State</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{userData.state}</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/50 hover:border-indigo-300 transition-all duration-200">
                        <div className="flex items-center gap-3 mb-2">
                          <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Admin Level</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900 capitalize">{userData.admin_level || "Not Set"}</p>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}
          </main>
        )}
      </div>

      <footer className="relative z-10 mx-4 mb-4 rounded-3xl bg-white/80 backdrop-blur-xl text-gray-700 text-center py-8 shadow-2xl ring-1 ring-gray-200/50 border border-white/20">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 300.000000 300.000000" preserveAspectRatio="xMidYMid meet">
            <g transform="translate(0.000000,300.000000) scale(0.050000,-0.050000)" fill="#10b981" stroke="none">
              <path d="M2870 4775 c-5 -14 -17 -61 -26 -105 l-16 -80 -345 -5 -346 -6 -103 -69 -103 -70 159 1 c109 0 172 10 199 30 30 22 105 29 335 29 l296 0 -2 -55 c0 -30 -6 -44 -11 -30 -18 44 -162 31 -177 -15 -12 -38 -30 -40 -452 -40 l-440 0 -49 -53 c-27 -29 -45 -58 -39 -64 18 -17 198 -2 219 19 31 30 956 23 946 -7 -5 -15 -53 -27 -123 -31 -78 -4 -118 -15 -125 -36 -10 -25 -88 -29 -513 -27 l-502 2 -35 -47 c-58 -75 -47 -96 52 -96 59 0 95 10 106 30 20 37 1101 37 1110 0 3 -12 -56 -22 -138 -26 -95 -4 -152 -15 -168 -35 -20 -24 -113 -29 -544 -29 -542 0 -571 -5 -574 -88 -1 -11 286 -13 709 -6 618 11 710 9 710 -17 0 -23 -34 -29 -178 -29 -132 0 -183 -8 -202 -30 -20 -24 -116 -30 -565 -35 l-540 -5 -17 -46 -17 -45 759 5 c673 5 760 2 760 -25 0 -26 -30 -29 -196 -23 -162 7 -200 3 -222 -24 -24 -28 -96 -32 -582 -32 -580 0 -580 0 -580 -82 0 -10 324 -18 790 -18 706 0 790 -3 790 -32 0 -27 -30 -30 -209 -26 -174 4 -216 -1 -247 -28 -33 -30 -101 -34 -601 -34 l-563 0 0 -45 0 -45 800 0 c517 0 802 -7 805 -20 3 -12 -62 -22 -158 -26 -113 -4 -171 -15 -188 -35 -20 -24 -125 -29 -651 -29 l-628 0 0 -50 0 -51 755 1 c509 1 757 -5 761 -19 4 -12 -26 -21 -74 -21 -60 0 -88 -11 -107 -40 -24 -39 -46 -40 -680 -40 l-655 0 0 -45 0 -45 770 7 c693 6 770 3 770 -25 0 -26 -23 -32 -118 -32 -80 0 -125 -10 -142 -30 -21 -25 -119 -30 -650 -30 l-624 0 10 -53 10 -52 757 9 c618 7 757 4 757 -18 0 -19 -37 -26 -138 -26 -97 0 -144 -9 -162 -30 -21 -25 -114 -30 -604 -30 l-579 0 7 -45 6 -45 750 -3 c586 -2 750 -8 750 -28 0 -18 -45 -24 -172 -21 -134 3 -177 -2 -197 -27 -22 -27 -100 -31 -553 -31 -291 0 -528 -7 -528 -16 0 -87 16 -89 756 -81 554 5 704 2 704 -18 0 -18 -55 -25 -211 -25 -168 0 -213 -6 -222 -30 -10 -25 -81 -30 -469 -30 -252 0 -458 -7 -457 -15 3 -90 21 -92 719 -79 575 12 660 9 660 -16 0 -25 -41 -30 -238 -30 -185 0 -243 -7 -262 -30 -19 -23 -97 -30 -390 -35 -358 -5 -366 -6 -339 -44 27 -36 56 -38 639 -33 544 5 610 2 610 -26 0 -28 -38 -32 -279 -32 -261 0 -281 -3 -308 -42 -28 -40 -44 -42 -261 -35 -243 8 -255 4 -194 -51 35 -32 82 -33 550 -20 468 13 512 11 512 -19 0 -29 -36 -33 -318 -33 -264 0 -320 -5 -329 -30 -8 -21 -41 -30 -112 -30 -56 0 -101 -9 -101 -19 0 -53 97 -65 483 -62 347 3 397 -1 397 -28 0 -27 -45 -31 -325 -32 -368 0 -381 -15 -97 -107 382 -125 701 -121 1082 12 254 89 245 96 -136 96 -297 0 -344 4 -344 31 0 27 51 31 407 28 311 -3 417 3 450 24 67 41 52 57 -55 57 -62 0 -106 11 -122 30 -20 24 -85 30 -342 30 -282 0 -318 4 -318 33 0 30 44 32 515 20 488 -12 517 -11 560 25 71 61 59 64 -190 50 -223 -12 -237 -11 -273 29 -36 40 -58 43 -325 43 -245 0 -287 5 -287 31 0 27 74 30 621 28 613 -2 679 4 679 63 0 10 -161 18 -358 18 -293 0 -362 5 -382 30 -20 24 -78 30 -282 30 -216 0 -258 5 -258 30 0 26 82 28 677 17 l676 -13 34 48 34 48 -465 5 c-386 5 -468 11 -481 35 -14 24 -66 30 -256 30 -194 0 -239 5 -239 29 0 24 106 27 742 16 625 -10 745 -7 760 17 48 76 35 78 -510 78 -459 0 -529 4 -540 31 -10 26 -48 31 -227 28 -177 -4 -216 1 -221 26 -5 26 89 28 777 19 656 -8 786 -5 801 18 48 76 37 78 -570 78 -497 0 -591 5 -612 30 -18 21 -65 30 -164 30 -103 0 -137 7 -131 25 7 20 173 23 769 18 l760 -8 10 53 10 52 -634 0 c-540 0 -639 4 -660 30 -17 20 -62 30 -142 30 -94 0 -118 6 -118 31 0 28 83 31 780 25 732 -6 780 -4 780 29 0 19 0 40 0 46 0 6 -297 10 -659 10 -642 -2 -660 -1 -681 39 -18 33 -41 40 -142 40 -80 0 -119 8 -114 22 5 16 235 21 802 19 l794 -3 0 51 0 51 -628 0 c-533 0 -631 4 -652 30 -18 22 -66 30 -172 30 -121 0 -148 6 -148 31 0 28 84 31 790 25 l790 -6 0 45 0 45 -573 0 c-514 0 -578 4 -612 34 -30 28 -77 35 -230 35 -135 1 -194 8 -200 26 -7 20 159 25 785 25 716 0 793 3 782 32 -7 17 -12 40 -12 50 0 10 -236 18 -568 18 -497 0 -570 4 -594 32 -22 27 -59 31 -212 24 -158 -7 -186 -3 -186 23 0 28 84 30 750 25 483 -4 750 0 750 13 0 83 0 83 -570 83 -467 0 -547 4 -557 30 -9 24 -51 30 -202 30 -158 0 -191 5 -191 30 0 27 84 30 710 21 391 -6 710 -5 710 1 0 85 -19 88 -558 88 -435 0 -521 5 -542 30 -18 22 -67 30 -182 30 -127 0 -158 6 -158 30 0 26 73 30 538 30 460 0 539 -4 549 -30 19 -49 233 -42 233 7 0 99 -42 107 -566 104 -424 -2 -491 1 -501 28 -9 24 -43 31 -142 31 -103 0 -131 6 -131 30 0 37 876 46 913 9 12 -12 77 -18 146 -15 l125 6 -44 55 -43 55 -434 0 c-430 0 -434 0 -453 45 -23 50 -184 57 -214 9 -9 -14 -16 -2 -16 31 l0 55 275 -1 c210 0 284 -7 314 -30 42 -32 391 -43 391 -13 0 75 -170 114 -539 124 l-369 10 -21 98 c-21 100 -75 160 -56 63 9 -46 3 -51 -53 -51 -53 0 -62 7 -62 50 0 52 -34 69 -50 25z m158 -695 c7 -115 21 -300 31 -410 36 -390 61 -643 80 -830 28 -262 31 -246 -39 -210 l-60 31 0 -710 c0 -698 -1 -711 -40 -711 -22 0 -40 7 -40 15 -1 8 -9 119 -20 245 -11 127 -33 401 -50 610 -16 209 -34 412 -40 450 -5 39 -15 160 -21 270 -6 110 -15 215 -21 233 -5 19 0 39 11 46 12 8 21 -4 21 -27 0 -33 51 -82 84 -82 4 0 10 218 12 485 2 267 10 625 18 795 l13 310 24 -150 c13 -82 29 -244 37 -360z"/>
            </g>
          </svg>
          <p className="font-semibold text-gray-900">PrecisionGrid Analytics</p>
        </div>
        <p className="text-sm text-gray-600">
          Contact us: <span className="font-medium text-emerald-600">info@drishti.com</span> | 
          Helpline: <span className="font-medium text-emerald-600">+91-9998882222</span>
        </p>
      </footer>

      {/* --- MODALS --- */}

      {/* Custom Message Box */}
      {showMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-xl text-gray-900 px-6 py-4 rounded-2xl shadow-2xl ring-1 ring-gray-200/50 border border-white/20 animate-fadeInUp max-w-sm">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="font-medium">{message}</p>
          </div>
        </div>
      )}


      {/* Project Creation Modal */}
      {modals.project && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4 backdrop-blur-sm animate-fadeInUp">
          <div className="w-full max-w-2xl relative">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-gray-200/50">
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Create New Project</h3>
                  <p className="text-gray-600">Fill in the details to generate material forecasts</p>
                </div>
              </div>
              <form className="space-y-6" onSubmit={handleCreateProject}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Project Name</label>
                  <input
                    name="projectName"
                    type="text"
                    placeholder="e.g., Mumbai Metro Expansion"
                    className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Budget (INR)</label>
                    <input
                      name="budget"
                      type="number"
                      placeholder="e.g., 10000000"
                      className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Project Location</label>
                    <select
                      name="location"
                      className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700"
                      required
                    >
                      <option value="">Select project location</option>
                      {Object.values(stateMapping).flat().map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Tower Type</label>
                    <select
                      name="towerType"
                      className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700"
                      required
                    >
                      <option value="">Tower Type (in kV)</option>
                      <option value="230 kV">230 kV</option>
                      <option value="400 kV">400 kV</option>
                      <option value="765 kV">765 kV</option>
                      <option value="1200 kV">1200 kV</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Substation Type</label>
                    <select
                      name="substationType"
                      className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700"
                      required
                    >
                      <option value="">Substation Type</option>
                      <option value="AIS (Air Insulated Substation)">AIS (Air Insulated Substation)</option>
                      <option value="GIS (Gas Insulated Substation)">GIS (Gas Insulated Substation)</option>
                      <option value="Hybrid Substation">Hybrid Substation</option>
                      <option value="Mobile Substation">Mobile Substation</option>
                      <option value="Switching Substation">Switching Substation</option>
                      <option value="Transformer Substation">Transformer Substation</option>
                      <option value="Converter Substation">Converter Substation</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Geographic Location</label>
                    <select
                    name="geo"
                    className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700"
                    required
                    >
                    <option value="">Select geographic location</option>
                    <option value="hill">Hill</option>
                    <option value="forest">Forest</option>
                    <option value="semi-urban">Semi-Urban</option>
                    <option value="coastal">Coastal</option>
                    <option value="urban">Urban</option>
                    <option value="industrial">Industrial</option>
                    <option value="desert">Desert</option>
                    </select>

                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Taxes</label>
                    <input
                      name="taxes"
                      type="text"
                      placeholder="e.g., 18% GST or Exempt"
                      className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-2xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5 font-semibold flex items-center justify-center gap-3"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Forecast
                  </button>
                  <button
                    type="button"
                    className="px-6 py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-semibold"
                    onClick={() => setModals({ ...modals, project: false })}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {modals.signup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4 backdrop-blur-sm animate-fadeInUp">
          <div className="w-full max-w-lg relative">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-200/50">
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Create Account</h3>
                  <p className="text-gray-600">Join PrecisionGrid Analytics</p>
                </div>
              </div>
              <form className="space-y-6" onSubmit={handleSignup}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Full Name</label>
                    <input 
                      name="name" 
                      type="text" 
                      placeholder="Enter your full name" 
                      className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Email Address</label>
                    <input 
                      name="email" 
                      type="email" 
                      placeholder="Enter a valid email address" 
                      className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50" 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Password </label>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Create a secure password" 
                    className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Role</label>
                    <select 
                      name="role" 
                      className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700" 
                      required
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value);
                        if (e.target.value !== 'admin') {
                          setSelectedAdminLevel('');
                        }
                      }}
                    >
                      <option value="">Select Role</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {selectedRole === 'admin' && selectedAdminLevel === 'central' ? (
                    <input type="hidden" name="state" value="" />
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">State</label>
                      <select 
                        name="state" 
                        className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700" 
                        required={selectedRole === 'employee' || (selectedRole === 'admin' && selectedAdminLevel === 'state')}
                        disabled={selectedRole === 'admin' && selectedAdminLevel !== 'state'}
                      >
                        <option value="">Select State</option>
                        {Object.keys(stateMapping).map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {selectedRole === "admin" && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Admin Level</label>
                    <select 
                      name="admin_level" 
                      className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-gray-700" 
                      required
                      value={selectedAdminLevel}
                      onChange={(e) => setSelectedAdminLevel(e.target.value)}
                    >
                      <option value="">Select Admin Level</option>
                      <option value="state">State</option>
                      <option value="central">Central</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-2xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5 font-semibold flex items-center justify-center gap-3"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create Account
                  </button>
                  <button 
                    type="button"
                    className="px-6 py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-semibold"
                    onClick={() => {
                      setModals({ ...modals, signup: false });
                      setSelectedRole("");
                      setSelectedAdminLevel("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {modals.login && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4 backdrop-blur-sm animate-fadeInUp">
          <div className="w-full max-w-md relative">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-200/50">
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Welcome Back </h3>
                  <p className="text-gray-600">Sign in to your account</p>
                </div>
              </div>
              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Email Address</label>
                  <input 
                    name="email" 
                    type="email" 
                    placeholder="Enter your email address" 
                    className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Password</label>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Enter your password" 
                    className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50/50" 
                    required 
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-2xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:-translate-y-0.5 font-semibold flex items-center justify-center gap-3"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In
                  </button>
                  <button 
                    type="button"
                    className="px-6 py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-semibold"
                    onClick={() => setModals({ ...modals, login: false })}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {modals.projectDetails && currentProjectIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4 backdrop-blur-sm animate-fadeInUp">
          <div className="w-full max-w-2xl relative">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-gray-200/50">
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-sm opacity-75"></div>
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Project Details (ID: {projects[currentProjectIndex].id})</h3>
                  <p className="text-gray-600">Complete project information and forecasts</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Project Information</h4>
                      <div className="space-y-3">
                        <div><span className="text-gray-600">Location:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].location}</span></div>
                        <div><span className="text-gray-600">Budget:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].budget}</span></div>
                        <div><span className="text-gray-600">Tower Type:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].towerType}</span></div>
                        <div><span className="text-gray-600">Substation:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].substationType}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional Details</h4>
                      <div className="space-y-3">
                        <div><span className="text-gray-600">Geography:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].geo}</span></div>
                        <div><span className="text-gray-600">Taxes:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].taxes}</span></div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Status:</span> 
                          {getStatusBadge(projects[currentProjectIndex].status)}
                        </div>
                        <div><span className="text-gray-600">Created:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].createdAt}</span></div>
                        <div><span className="text-gray-600">Created By:</span> <span className="font-semibold text-gray-900">{projects[currentProjectIndex].createdBy}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                {renderForecasts(projects[currentProjectIndex].allForecasts)}
              </div>
              <div className="flex gap-4 mt-8">
                <button 
                  className="px-6 py-3 rounded-2xl text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 font-semibold flex items-center gap-2" 
                  onClick={handleDeleteProject}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Project
                </button>
                <button 
                  className="px-6 py-3 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-semibold" 
                  onClick={() => setModals({ ...modals, projectDetails: false })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
