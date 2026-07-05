import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, Plus, LogOut, FileSpreadsheet, 
  Settings, FolderPlus, HelpCircle, X, Menu
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { 
  listAppSpreadsheets, 
  createGroupSpreadsheet, 
  fetchSpreadsheetData, 
  addExpense, 
  addMember, 
  deleteExpense,
  shareSpreadsheet,
  setSpreadsheetAppProperties,
  writeAllExpenses
} from './services/googleSheets';
import './App.css';

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Auth State
  const [auth, setAuth] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === 'true') {
      return {
        token: 'mock_token',
        expiresAt: Date.now() + 3600000,
        user: {
          name: 'Mock Tester',
          email: 'mock@example.com',
          picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
        }
      };
    }
    const saved = localStorage.getItem('splitwise_auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure the token is not expired (expiring within next 2 minutes)
        if (parsed.expiresAt && parsed.expiresAt > Date.now() + 120000) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved auth', e);
      }
    }
    return null;
  });

  // Sheets list and active sheet
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [activeSheetId, setActiveSheetId] = useState(() => {
    return localStorage.getItem('splitwise_active_sheet_id') || '';
  });
  
  // Spreadsheet data
  const [sheetData, setSheetData] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  
  // Modals inside app level
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('INR');
  const [createGroupError, setCreateGroupError] = useState('');

  // Join group by ID/URL state
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [joinSheetInput, setJoinSheetInput] = useState('');
  const [joinGroupError, setJoinGroupError] = useState('');

  // Mobile menu open state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Save auth state
  useEffect(() => {
    if (auth) {
      localStorage.setItem('splitwise_auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('splitwise_auth');
      localStorage.removeItem('splitwise_active_sheet_id');
      setSpreadsheets([]);
      setActiveSheetId('');
      setSheetData(null);
    }
  }, [auth]);

  // Handle Login success
  const handleLoginSuccess = (authData) => {
    setAuth(authData);
  };

  const handleLogout = () => {
    setAuth(null);
  };

  // Discover spreadsheets in Drive
  const discoverSheets = useCallback(async (token) => {
    try {
      const files = await listAppSpreadsheets(token);
      setSpreadsheets(files);
      return files;
    } catch (err) {
      console.error('Failed to discover spreadsheets', err);
      setError('Could not access Google Drive. Your session may have expired.');
      return [];
    }
  }, []);

  // Fetch full data for the active spreadsheet
  const refreshActiveData = useCallback(async (token, sheetId, showGlobalSpinner = false) => {
    if (!sheetId) return;
    if (showGlobalSpinner) setLoading(true);
    else setIsSyncing(true);
    setError('');

    try {
      const data = await fetchSpreadsheetData(token, sheetId);
      setSheetData(data);
    } catch (err) {
      console.error('Error fetching sheet data', err);
      setError('Failed to fetch data from the Google Sheet. Make sure you have access.');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial trigger after log in
  useEffect(() => {
    if (auth?.token) {
      if (auth.token === 'mock_token') {
        setSpreadsheets([]);
        setLoading(false);
        return;
      }
      discoverSheets(auth.token).then((files) => {
        if (files.length > 0) {
          // If we had an active sheet ID saved and it is still in the files list, use it
          const stillExists = files.some(f => f.id === activeSheetId);
          const targetId = stillExists ? activeSheetId : files[0].id;
          setActiveSheetId(targetId);
          localStorage.setItem('splitwise_active_sheet_id', targetId);
        } else {
          // No sheets found, prompt to create one
          setLoading(false);
        }
      });
    }
  }, [auth?.token]);

  // Trigger spreadsheet data load when active ID changes
  useEffect(() => {
    if (auth?.token && activeSheetId && auth.token !== 'mock_token') {
      refreshActiveData(auth.token, activeSheetId, true);
    }
  }, [auth?.token, activeSheetId, refreshActiveData]);

  // Create new group spreadsheet
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setCreateGroupError('');
    if (!newGroupName.trim()) {
      setCreateGroupError('Group name is required.');
      return;
    }

    setLoading(true);
    try {
      const newSheetId = await createGroupSpreadsheet(
        auth.token, 
        newGroupName.trim(), 
        auth.user.name, 
        auth.user.email,
        newGroupCurrency
      );
      
      // Update sheets list
      const updatedFiles = await discoverSheets(auth.token);
      
      // Select new sheet
      setActiveSheetId(newSheetId);
      localStorage.setItem('splitwise_active_sheet_id', newSheetId);
      
      setIsCreateGroupOpen(false);
      setNewGroupName('');
      setNewGroupCurrency('INR');
    } catch (err) {
      setCreateGroupError(err.message || 'Failed to create new spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  // Join an existing group by URL or ID
  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setJoinGroupError('');
    
    if (!joinSheetInput.trim()) {
      setJoinGroupError('Please enter a spreadsheet URL or ID.');
      return;
    }

    // Extract ID from URL if necessary
    const urlMatch = joinSheetInput.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = urlMatch ? urlMatch[1] : joinSheetInput.trim();

    setLoading(true);
    try {
      // 1. Verify access by trying to fetch the spreadsheet data
      const data = await fetchSpreadsheetData(auth.token, sheetId);
      
      // Check if user is a member
      const userEmail = auth.user.email.toLowerCase();
      const isMember = data.members.some(m => m.Email.toLowerCase() === userEmail);
      
      if (!isMember) {
        // Automatically add them to the member sheet if they have writer permissions
        await addMember(auth.token, sheetId, {
          name: auth.user.name,
          email: userEmail
        });
        // Fetch again to update state
        const updatedData = await fetchSpreadsheetData(auth.token, sheetId);
        setSheetData(updatedData);
      } else {
        setSheetData(data);
      }

      // 2. Add to local active sheets list
      setActiveSheetId(sheetId);
      localStorage.setItem('splitwise_active_sheet_id', sheetId);
      
      // Ensure the sheet is tagged with our app properties so it shows up in future listings
      try {
        await setSpreadsheetAppProperties(auth.token, sheetId);
      } catch (err) {
        console.warn('Failed to tag spreadsheet app properties, continuing.', err);
      }
      
      // Re-trigger spreadsheets discovery to list this in their Drive files list
      await discoverSheets(auth.token);

      setIsJoinGroupOpen(false);
      setJoinSheetInput('');
    } catch (err) {
      console.error(err);
      setJoinGroupError('Failed to access spreadsheet. Make sure you have permission and the ID is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Add new expense
  const handleAddExpense = async (expense) => {
    await addExpense(auth.token, activeSheetId, expense);
    // Refresh to get latest state
    await refreshActiveData(auth.token, activeSheetId, false);
  };

  // Edit an existing expense
  const handleEditExpense = async (updatedExpense) => {
    const updatedExpenses = sheetData.expenses.map(exp => {
      if (exp.ID === updatedExpense.id) {
        return {
          ID: updatedExpense.id,
          Description: updatedExpense.description,
          Amount: updatedExpense.amount,
          PaidBy: updatedExpense.paidBy.toLowerCase(),
          SplitType: updatedExpense.splitType,
          SplitDetails: updatedExpense.splitDetails || '',
          Date: updatedExpense.date,
          Category: updatedExpense.category,
          CreatedBy: exp.CreatedBy.toLowerCase()
        };
      }
      return exp;
    });

    await writeAllExpenses(auth.token, activeSheetId, updatedExpenses);
    await refreshActiveData(auth.token, activeSheetId, false);
  };

  // Add new member
  const handleAddMember = async (member) => {
    await addMember(auth.token, activeSheetId, member);
    // Refresh to get latest state
    await refreshActiveData(auth.token, activeSheetId, false);
  };

  // Delete an expense
  const handleDeleteExpense = async (expenseId) => {
    const updatedExpenses = sheetData.expenses.filter(exp => exp.ID !== expenseId);
    await deleteExpense(auth.token, activeSheetId, expenseId, updatedExpenses);
    await refreshActiveData(auth.token, activeSheetId, false);
  };

  // Share spreadsheet with friend
  const handleShareSheet = async (friendEmail) => {
    await shareSpreadsheet(auth.token, activeSheetId, friendEmail);
  };

  const handleSelectSheet = (sheetId) => {
    setActiveSheetId(sheetId);
    localStorage.setItem('splitwise_active_sheet_id', sheetId);
    setIsMobileMenuOpen(false);
  };

  // --- RENDERS ---

  if (!auth) {
    return <Login clientId={googleClientId} onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading && !sheetData) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2>Loading Group Workspace...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Connecting directly to Google Sheets</p>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${isMobileMenuOpen ? 'mobile-sidebar-open' : ''}`}>
      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button className="btn-mobile-menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu size={24} />
        </button>
        <div className="mobile-app-logo">
          <div className="sidebar-logo" style={{ width: '28px', height: '28px' }}>
            <DollarSign size={16} />
          </div>
          <span>Splitwise</span>
        </div>
        <div style={{ width: '24px' }}></div>
      </header>

      {/* Sidebar Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <DollarSign size={20} />
          </div>
          <span>Sheets Splitwise</span>
        </div>

        {/* User Info */}
        <div className="user-profile-bar">
          <img src={auth.user.picture} alt={auth.user.name} className="user-avatar" />
          <div className="user-info">
            <span className="user-name">{auth.user.name}</span>
            <span className="user-email">{auth.user.email}</span>
          </div>
        </div>

        {/* Groups Navigation Section */}
        <div className="nav-section">
          <span className="nav-title">My Groups</span>
          <div className="sheets-list">
            {spreadsheets.map(sheet => (
              <button 
                key={sheet.id}
                className={`sheet-item-btn ${activeSheetId === sheet.id ? 'active' : ''}`}
                onClick={() => handleSelectSheet(sheet.id)}
              >
                <FileSpreadsheet size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sheet.name.replace('Splitwise - ', '')}
                </span>
              </button>
            ))}
          </div>

          <button className="btn-sidebar-action" onClick={() => setIsCreateGroupOpen(true)} style={{ marginTop: '0.5rem' }}>
            <FolderPlus size={16} />
            <span>Create New Group</span>
          </button>

          <button className="btn-sidebar-action" onClick={() => setIsJoinGroupOpen(true)} style={{ marginTop: '0.25rem' }}>
            <FileSpreadsheet size={16} />
            <span>Join Group by Link</span>
          </button>
        </div>

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Panel */}
      <main style={{ flex: 1 }}>
        {error && (
          <div style={{
            margin: '2rem 2.5rem 0',
            padding: '1rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--danger-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button className="btn-secondary" onClick={() => discoverSheets(auth.token)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>Reconnect</button>
          </div>
        )}

        {activeSheetId && sheetData ? (
          <Dashboard 
            data={sheetData}
            activeUser={auth.user}
            spreadsheetId={activeSheetId}
            onAddExpense={handleAddExpense}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onAddMember={handleAddMember}
            onShareSheet={handleShareSheet}
            onRefresh={() => refreshActiveData(auth.token, activeSheetId, false)}
            isSyncing={isSyncing}
          />
        ) : (
          <div className="empty-state" style={{ height: '80vh' }}>
            <FileSpreadsheet size={64} className="empty-state-icon" />
            <h2>No Splitwise Group Connected</h2>
            <p style={{ marginTop: '0.5rem', maxWidth: '360px' }}>
              Create a new group spreadsheet in Google Drive to start splitting expenses.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                className="btn-primary" 
                onClick={() => setIsCreateGroupOpen(true)}
              >
                <FolderPlus size={18} />
                <span>Create New Group</span>
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setIsJoinGroupOpen(true)}
              >
                <FileSpreadsheet size={18} />
                <span>Join Existing Group</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* --- CREATE GROUP MODAL --- */}
      {isCreateGroupOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button className="btn-close-modal" onClick={() => setIsCreateGroupOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              {createGroupError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{createGroupError}</div>}

              <div className="form-group">
                <label className="form-label">Group Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Road Trip 2026, Room 402"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Group Currency</label>
                <select 
                  className="form-select"
                  value={newGroupCurrency}
                  onChange={e => setNewGroupCurrency(e.target.value)}
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="CAD">CAD ($) - Canadian Dollar</option>
                  <option value="AUD">AUD ($) - Australian Dollar</option>
                </select>
              </div>

              <p className="split-type-info">
                This will automatically create a formatted Google Spreadsheet named <code>Splitwise - Group Name</code> in your Google Drive folder.
              </p>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCreateGroupOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- JOIN GROUP MODAL --- */}
      {isJoinGroupOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Join Existing Group</h3>
              <button className="btn-close-modal" onClick={() => setIsJoinGroupOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleJoinGroup}>
              {joinGroupError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{joinGroupError}</div>}

              <div className="form-group">
                <label className="form-label">Google Sheet Link or ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Paste URL or Spreadsheet ID"
                  value={joinSheetInput}
                  onChange={e => setJoinSheetInput(e.target.value)}
                  required
                />
              </div>

              <p className="split-type-info">
                Paste the full URL of the Google Sheet shared with you, or the raw Spreadsheet ID. You must have "Editor" permissions on the sheet.
              </p>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsJoinGroupOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Join Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
