/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  CreditCard,
  Briefcase,
  User as UserIcon,
  Database,
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Search,
  Check,
  Pencil,
  Users,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import type { User, Expense, UserRole, ExpenseStatus, Project } from './types';
import { MOCK_USER_FIELD, MOCK_USER_ADMIN, PROJECTS, CATEGORIES } from './constants';
import { cn } from './lib/utils';
import { extractBillData } from './lib/gemini';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fieldspend_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit' | 'history' | 'projects' | 'users'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean, url: string } | null>(null);
  const [isSimulatingFieldCrew, setIsSimulatingFieldCrew] = useState(() => {
    return localStorage.getItem('isSimulatingFieldCrew') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isSimulatingFieldCrew', isSimulatingFieldCrew.toString());
  }, [isSimulatingFieldCrew]);

  const fetchData = async () => {
    try {
      const [dataResp, statusResp] = await Promise.all([
        fetch('/api/data'),
        fetch('/api/db-status')
      ]);
      const data = await dataResp.json();
      const status = await statusResp.json();

      if (data.expenses) setExpenses(data.expenses);
      if (data.projects) setAllProjects(data.projects);
      if (data.categories) setAllCategories(data.categories);
      if (data.users) setAllUsers(data.users);
      setDbStatus(status);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('fieldspend_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fieldspend_user');
    }
  }, [user]);

  const handleConnectDrive = async () => {
    alert('Google Drive vault is managed by the system service account.');
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'status'>, files?: { base64: string, name: string, type: string }[]) => {
    try {
      const projectName = allProjects.find(p => p.id === expense.projectId)?.name || 'General';
      const resp = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense: { ...expense, projectName }, files })
      });
      if (resp.ok) {
        fetchData();
        setActiveTab('history');
      }
    } catch (err) {
      console.error('Submit expense failed', err);
    }
  };

  const updateExpenseStatus = async (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      const resp = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason: reason })
      });
      if (resp.ok) fetchData();
    } catch (err) {
      console.error('Update status failed', err);
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      const resp = await fetch('/api/expenses-bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status, rejectionReason: reason })
      });
      if (resp.ok) fetchData();
    } catch (err) {
      console.error('Bulk update failed', err);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const resp = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (resp.ok) { fetchData(); return true; }
      const data = await resp.json().catch(() => ({ error: `Server returned ${resp.status}` }));
      alert(`Delete failed: ${data.error || 'Unknown error'}`);
      return false;
    } catch (err) {
      console.error('Delete expense failed', err);
      alert('Delete failed: Network error — is the server running?');
      return false;
    }
  };

  const bulkDeleteExpenses = async (ids: string[]) => {
    try {
      const resp = await fetch('/api/expenses-bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (resp.ok) { fetchData(); return true; }
      const data = await resp.json().catch(() => ({ error: `Server returned ${resp.status}` }));
      alert(`Bulk delete failed: ${data.error || 'Unknown error'}`);
      return false;
    } catch (err) {
      console.error('Bulk delete failed', err);
      alert('Bulk delete failed: Network error — is the server running?');
      return false;
    }
  };

  const editExpense = async (id: string, updates: Partial<Expense>) => {
    try {
      const resp = await fetch(`/api/expenses/${id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Edit expense failed', err); }
  };

  const bulkEditExpenses = async (ids: string[], field: string, value: string) => {
    try {
      const resp = await fetch('/api/expenses-bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, field, value })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Bulk edit failed', err); }
  };

  const deleteProject = async (id: string) => {
    try {
      const resp = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Delete project failed', err); }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const resp = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Update project failed', err); }
  };

  const mapUsersToProject = async (projectId: string, userIds: string[]) => {
    try {
      const resp = await fetch(`/api/projects/${projectId}/map-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Map users failed', err); }
  };

  const updateProjectStatus = async (id: string, status: 'ACTIVE' | 'COMPLETED') => {
    await updateProject(id, { status });
  };

  const approveUser = async (id: string, isApproved: boolean) => {
    try {
      const resp = await fetch(`/api/users/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Approve user failed', err); }
  };

  const updateUserRole = async (id: string, role: UserRole) => {
    try {
      const resp = await fetch(`/api/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Update user role failed', err); }
  };

  const handleAddProject = async (p: Project) => {
    try {
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: { ...p, status: 'ACTIVE' } })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Add project failed', err); }
  };

  const handleAddCategory = async (name: string) => {
    try {
      const resp = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Add category failed', err); }
  };

  const handleAddUser = async (u: User) => {
    try {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: u })
      });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Add user failed', err); }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const resp = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (resp.ok) fetchData();
    } catch (err) { console.error('Delete user failed', err); }
  };

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('fieldspend_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fieldspend_user');
    localStorage.removeItem('isSimulatingFieldCrew');
    setIsSimulatingFieldCrew(false);
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        allUsers={allUsers}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row p-0 md:p-4 gap-0 md:gap-4 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <CreditCard className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">FieldSpend</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <SidebarShell
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      >
        {/* Header */}
        <div className={cn(
          "border-b border-slate-100 flex items-center",
          isSidebarCollapsed ? "p-4 justify-center" : "p-6"
        )}>
          <div className="flex items-center gap-3 px-2 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0 shadow-sm">F</div>
            {!isSidebarCollapsed && (
              <span className="font-bold text-xl tracking-tight text-slate-900 whitespace-nowrap">
                FieldSpend
              </span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 font-bold">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Role toggle */}
        <div className={cn(
          "flex-1 no-scrollbar overflow-hidden",
          isSidebarCollapsed ? "p-2" : "p-4"
        )}>
          {user.role === 'ADMIN' && (
            <div className={cn("mb-4", isSidebarCollapsed && "flex justify-center")}>
              <button
                onClick={() => setIsSimulatingFieldCrew(!isSimulatingFieldCrew)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-sm transition-colors",
                  isSimulatingFieldCrew
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100",
                  isSidebarCollapsed ? "justify-center w-10 h-10 p-0 rounded-full" : "w-full"
                )}
                title={isSimulatingFieldCrew ? "Switch to Admin View" : "Switch to Field Crew View"}
              >
                {isSimulatingFieldCrew ? <Settings className="w-4 h-4 shrink-0" /> : <Users className="w-4 h-4 shrink-0" />}
                {!isSidebarCollapsed && (
                  <span>{isSimulatingFieldCrew ? "Admin Portal" : "Field Simulation"}</span>
                )}
              </button>
            </div>
          )}

          <nav className="space-y-1">
            {(user.role === 'FIELD_STAFF' || isSimulatingFieldCrew) ? (
              <>
                <NavItem icon={<LayoutDashboard />} label="My Dashboard" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                <NavItem icon={<PlusCircle />} label="Submit Expense" active={activeTab === 'submit'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('submit'); setIsSidebarOpen(false); }} />
                <NavItem icon={<History />} label="My History" active={activeTab === 'history'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }} />
              </>
            ) : (
              <>
                <NavItem icon={<LayoutDashboard />} label="Analytics" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                <NavItem icon={<PlusCircle />} label="Submit Admin Exp" active={activeTab === 'submit'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('submit'); setIsSidebarOpen(false); }} />
                <NavItem icon={<History />} label="All Expenses" active={activeTab === 'history'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }} />
                <NavItem icon={<Briefcase />} label="Projects & Types" active={activeTab === 'projects'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('projects'); setIsSidebarOpen(false); }} />
                <NavItem icon={<Settings />} label="User Management" active={activeTab === 'users'} collapsed={isSidebarCollapsed} onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} />
              </>
            )}
          </nav>
        </div>

        {/* Footer */}
        <div className={cn(
          "border-t border-slate-100 space-y-4",
          isSidebarCollapsed ? "p-2" : "p-4"
        )}>
          <div className={cn("flex items-center gap-3 px-2", isSidebarCollapsed && "justify-center px-0")}>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-200 shrink-0">
              {user.name[0]}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.role === 'ADMIN' ? 'Accounts Team' : 'Field Crew'}</p>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {user.role === 'ADMIN' && dbStatus?.connected ? (
              <a href={dbStatus.url} target="_blank" rel="noreferrer" className={cn("flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg text-green-600 bg-green-50 border border-green-100 hover:bg-green-100", isSidebarCollapsed && "justify-center px-0")}>
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Connected to Sheets</span>}
              </a>
            ) : (
              <button onClick={handleConnectDrive} className={cn("flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg", dbStatus?.connected ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50", isSidebarCollapsed && "justify-center px-0")}>
                <Database className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">DB {dbStatus?.connected ? 'Connected' : 'Syncing...'}</span>}
              </button>
            )}
            <button onClick={handleLogout} className={cn("flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg", isSidebarCollapsed && "justify-center px-0")}>
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </SidebarShell>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="h-full p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <Dashboard user={user} expenses={expenses} setActiveTab={setActiveTab} projects={allProjects} dbStatus={dbStatus} isSimulatingFieldCrew={isSimulatingFieldCrew} />
              </motion.div>
            )}
            {activeTab === 'submit' && (
              <motion.div
                key="submit"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <SubmitExpense
                  user={user}
                  onSubmit={addExpense}
                  onCancel={() => setActiveTab('dashboard')}
                  projects={allProjects}
                  categories={allCategories}
                />
              </motion.div>
            )}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <ExpensesHistory
                  user={user}
                  expenses={expenses}
                  onUpdateStatus={updateExpenseStatus}
                  onBulkUpdateStatus={bulkUpdateStatus}
                  onDelete={deleteExpense}
                  onBulkDelete={bulkDeleteExpenses}
                  onEdit={editExpense}
                  onBulkEdit={bulkEditExpenses}
                  projects={allProjects}
                  categories={allCategories}
                />
              </motion.div>
            )}
            {activeTab === 'projects' && user.role === 'ADMIN' && (
              <motion.div
                key="projects"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <ProjectsManagement
                  projects={allProjects}
                  users={allUsers}
                  expenses={expenses}
                  onAddProject={handleAddProject}
                  onUpdateProject={updateProject}
                  onMapUsers={mapUsersToProject}
                  onUpdateStatus={updateProjectStatus}
                  onDeleteProject={deleteProject}
                  categories={allCategories}
                  onAddCategory={handleAddCategory}
                  dbStatus={dbStatus}
                  user={user}
                  isSimulatingFieldCrew={isSimulatingFieldCrew}
                />
              </motion.div>
            )}
            {activeTab === 'users' && user.role === 'ADMIN' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <UserManagement
                  users={allUsers}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onApproveUser={approveUser}
                  onUpdateUserRole={updateUserRole}
                  projects={allProjects}
                  user={user}
                  isSimulatingFieldCrew={isSimulatingFieldCrew}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-[100]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Syncing with DB...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden bg-white border-t flex justify-around items-center p-3 fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <MobileNavItem
          icon={<LayoutDashboard />}
          label="Home"
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        />
        <MobileNavItem
          icon={<PlusCircle />}
          label="Submit"
          active={activeTab === 'submit'}
          onClick={() => setActiveTab('submit')}
        />

        <MobileNavItem
          icon={<History />}
          label="History"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        />
        {user.role === 'ADMIN' ? (
          <MobileNavItem
            icon={<Settings />}
            label="Users"
            active={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
          />
        ) : (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 p-2 text-red-500"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-bold">Exit</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SidebarShell({ children, isOpen, isCollapsed, onClose, onToggleCollapse }: { children: React.ReactNode, isOpen: boolean, isCollapsed: boolean, onClose: () => void, onToggleCollapse: () => void }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isDesktop) {
    return (
      <>
        <div
          className="sticky top-4 md:flex md:self-start md:h-[calc(100vh-2rem)] z-[160] hidden"
          style={{ width: isCollapsed ? '80px' : '288px', transition: 'width 200ms ease' }}
        >
          <div className="bg-white border border-slate-200 rounded-2xl flex flex-col w-full overflow-hidden">
            {/* Collapse Toggle */}
            <button
              onClick={onToggleCollapse}
              className="absolute -right-3 top-1/4 w-6 h-12 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-blue-600 shadow-xl z-10 hover:scale-110 transition-transform flex"
            >
              <ChevronRight className={cn("w-3 h-3 transition-transform duration-200", isCollapsed ? "" : "rotate-180")} />
            </button>
            {children}
          </div>
        </div>
      </>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-[160] flex flex-col shadow-2xl w-[288px]"
          >
            {children}
          </motion.div>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[155]"
            onClick={onClose}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
        active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50",
        collapsed && "justify-center px-2"
      )}
    >
      <span className={cn("w-5 h-5 shrink-0", active ? "text-blue-700" : "text-slate-400")}>{icon}</span>
      {!collapsed && (
        <span className="truncate">
          {label}
        </span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
        active ? "text-blue-600" : "text-slate-400"
      )}
    >
      <div className={cn(
        "p-1 rounded-lg transition-all",
        active ? "bg-blue-50" : ""
      )}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
      </div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function Dashboard({ user, expenses, setActiveTab, projects, dbStatus, isSimulatingFieldCrew }: { user: User, expenses: Expense[], setActiveTab: (t: any) => void, projects: any[], dbStatus: any, isSimulatingFieldCrew: boolean }) {
  const isFieldView = user.role === 'FIELD_STAFF' || isSimulatingFieldCrew;
  const filteredExpenses = user.role === 'ADMIN' && !isSimulatingFieldCrew ? expenses : expenses.filter(e => e.userId === user.id);
  const pendingCount = filteredExpenses.filter(e => e.status === 'PENDING').length;
  const approved = filteredExpenses.filter(e => e.status === 'APPROVED');
  const totalApproved = approved.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const rejectedCount = filteredExpenses.filter(e => e.status === 'REJECTED').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min">
      {/* Compact Header */}
      <div className="col-span-1 md:col-span-12 bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", dbStatus?.connected ? "bg-green-600 text-white" : "bg-amber-600 text-white")}>
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">{isFieldView ? "Field Operations" : "FieldSpend_Database"}</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", dbStatus?.connected ? "bg-green-500" : "bg-amber-500 animate-pulse")} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('submit')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-sm">
            + New Bill
          </button>
        </div>
      </div>

      {/* Stat Cards - Compact responsive grid */}
      <div className="col-span-1 md:col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { icon: <CreditCard className="w-4 h-4" />, label: "Total", value: filteredExpenses.length.toString(), color: "bg-blue-100 text-blue-600" },
          { icon: <TrendingUp className="w-4 h-4" />, label: "Amount", value: `₹${totalAmount.toLocaleString('en-IN')}`, color: "bg-indigo-100 text-indigo-600" },
          { icon: <CheckCircle className="w-4 h-4" />, label: "Approved", value: `₹${totalApproved.toLocaleString('en-IN')}`, color: "bg-green-100 text-green-600" },
          { icon: <Clock className="w-4 h-4" />, label: "Pending", value: pendingCount.toString(), color: "bg-amber-100 text-amber-600" },
          { icon: <AlertCircle className="w-4 h-4" />, label: "Rejected", value: rejectedCount.toString(), color: "bg-red-100 text-red-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 shadow-sm">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-bold text-slate-900 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="col-span-1 md:col-span-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Recent Transactions */}
          <div className="col-span-1 md:col-span-7">
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900">Recent Transactions</h3>
                <button onClick={() => setActiveTab('history')} className="text-blue-600 text-[11px] font-bold hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-50/30">
                        <th className="px-4 py-3 font-bold">Vendor</th>
                        <th className="px-4 py-3 font-bold">Category</th>
                        <th className="px-4 py-3 font-bold text-right">Amount</th>
                        <th className="px-4 py-3 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-xs">No recent transactions.</td>
                        </tr>
                      ) : (
                        filteredExpenses.slice(0, 5).map(expense => (
                          <tr key={expense.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setActiveTab('history')}>
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-slate-900">{expense.vendorName}</p>
                              <p className="text-[9px] text-slate-400">{expense.date}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-600">{expense.category}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-xs font-mono font-bold text-slate-900">₹{expense.amount.toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={expense.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-400 text-xs">No recent transactions.</div>
                  ) : (
                    filteredExpenses.slice(0, 5).map(expense => (
                      <div key={expense.id} className="p-3 space-y-2" onClick={() => setActiveTab('history')}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{expense.vendorName}</p>
                            <p className="text-[9px] text-slate-400">{expense.date}</p>
                          </div>
                          <StatusBadge status={expense.status} />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-600">{expense.category}</span>
                          <p className="text-xs font-mono font-bold text-slate-900">₹{expense.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Side Panel */}
          <div className="col-span-1 md:col-span-5 space-y-4">
            {/* Project Budget */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-slate-900">Project Budget</h3>
                {user.role === 'ADMIN' && (
                  <button onClick={() => setActiveTab('projects')} className="text-blue-600 text-[10px] font-bold hover:underline">View All</button>
                )}
              </div>
              <div className="space-y-4">
                {projects.filter((p: any) => p.status !== 'COMPLETED').slice(0, 4).map((project: any) => {
                  const spent = filteredExpenses.filter((e: Expense) => e.projectId === project.id && e.status === 'APPROVED').reduce((s: number, e: Expense) => s + Number(e.amount), 0);
                  const advance = project.advanceAmount || 0;
                  const pct = advance > 0 ? Math.min((spent / advance) * 100, 100) : 0;
                  return (
                    <div key={project.id} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{project.name}</p>
                        <p className="text-[10px] font-mono font-bold text-slate-900">₹{spent.toLocaleString()}</p>
                      </div>
                      {advance > 0 && (
                        <div className="flex justify-between items-center">
                          <p className="text-[8px] text-slate-400">Adv: ₹{advance.toLocaleString('en-IN')}</p>
                          <p className={cn("text-[8px] font-bold", spent > advance ? "text-red-500" : "text-green-500")}>
                            {spent > advance ? `${((spent/advance-1)*100).toFixed(0)}% over` : `${((1-spent/advance)*100).toFixed(0)}% left`}
                          </p>
                        </div>
                      )}
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct || 0.1}%` }}
                          className={cn("h-full rounded-full", spent > advance ? "bg-red-500" : "bg-blue-500")}
                        />
                      </div>
                    </div>
                  );
                })}
                {projects.filter((p: any) => p.status !== 'COMPLETED').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No active projects.</p>
                )}
              </div>
            </section>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 relative overflow-hidden group cursor-pointer" onClick={() => setActiveTab('submit')}>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mb-2">
                    <Camera className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-white font-bold text-xs mb-0.5">Scan Bill</p>
                  <p className="text-slate-400 text-[8px]">AI-powered OCR</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Geospatial Audit</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-0.5 h-6 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Verified</p>
                      <p className="text-xs font-bold text-slate-900">{approved.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-0.5 h-6 bg-amber-400 rounded-full"></div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Pending</p>
                      <p className="text-xs font-bold text-slate-900">{pendingCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, trend }: { icon: React.ReactNode, label: string, value: string, color: string, trend?: string }) {
  return (
    <div className="bg-white rounded-3xl p-6 border shadow-sm flex flex-col gap-4">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
          <TrendingUp className="w-3 h-3" />
          {trend}
        </div>
      )}
    </div>
  );
}

function SubmitExpense({ user, onSubmit, onCancel, projects, categories }: { user: User, onSubmit: (e: any, files?: { base64: string, name: string, type: string }[]) => void, onCancel: () => void, projects: any[], categories: string[] }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<{ base64: string, name: string, type: string, previewUrl: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrEngine, setOcrEngine] = useState<'Gemini' | 'Tesseract' | 'None'>('None');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vendorName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: categories[0] || 'Miscellaneous',
    projectId: user.projectAssigned || (projects[0]?.id || ''),
    location: ''
  });
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isDocsExpanded, setIsDocsExpanded] = useState(true);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await resp.json();
        if (data.display_name) {
          setFormData(prev => ({ ...prev, location: data.display_name }));
        }
      } catch (err) {
        console.error("Failed to fetch reverse geocode", err);
      } finally {
        setFetchingLocation(false);
      }
    }, (err) => {
      console.error("Geolocation error", err);
      setFetchingLocation(false);
      alert("Please enable location permissions");
    });
  };

  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) return;
    setIsSearchingLocation(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await resp.json();
      setLocationResults(data);
    } catch (err) {
      console.error("Location search failed", err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationSearch) searchLocation(locationSearch);
    }, 800);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  const runOCR = async (base64: string, type: string) => {
    setIsExtracting(true);
    try {
      // 1. Try Tesseract.js first (free, client-side)
      setOcrEngine('Tesseract');
      let extractedText = '';
      try {
        const { data: { text } } = await Tesseract.recognize(`data:${type};base64,${base64}`);
        extractedText = text || '';
      } catch (tessErr) {
        console.warn('Tesseract OCR failed', tessErr);
      }

      const cleanText = extractedText.trim();
      if (cleanText) {
        const lines = cleanText.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          setFormData(prev => ({ ...prev, vendorName: lines[0].trim().substring(0, 30) }));
        }
        const amountMatch = cleanText.match(/(?:RS|INR|₹|TOTAL|AMOUNT|TOTAL AMOUNT|GRAND TOTAL)\.?\s*[:]?\s*([\d,]+\.?\d*)/i);
        if (amountMatch) {
          setFormData(prev => ({ ...prev, amount: amountMatch[1].replace(/,/g, '') }));
          setIsExtracting(false);
          return;
        }
      }

      // 2. Fallback to Gemini AI for structured extraction
      setOcrEngine('Gemini');
      const result = await extractBillData(base64);
      if (result && result.vendorName !== 'Unknown') {
        setFormData(prev => ({
          ...prev,
          vendorName: result.vendorName,
          amount: result.amount.toString(),
          date: result.date,
          category: result.category
        }));
      }
    } catch (err) {
      console.error('OCR Pipeline Error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length > 0) {
      const newFiles: { base64: string, name: string, type: string, previewUrl: string }[] = [];

      for (const file of selectedFiles) {
        const reader = new FileReader();
        const promise = new Promise<void>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            newFiles.push({
              base64,
              name: file.name,
              type: file.type,
              previewUrl: reader.result as string
            });
            resolve();
          };
          reader.readAsDataURL(file);
        });
        await promise;
      }

      setFiles(prev => [...prev, ...newFiles]);
      setStep(2);

      // Run OCR on the first file if form is empty
      const firstFile = newFiles[0];
      if (formData.vendorName === '' && (firstFile.type.startsWith('image/') || firstFile.type === 'application/pdf')) {
        runOCR(firstFile.base64, firstFile.type);
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (newFiles.length === 0) setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    onSubmit({
      userId: user.id,
      userName: user.name,
      vendorName: formData.vendorName,
      amount: parseFloat(formData.amount),
      date: formData.date,
      category: formData.category,
      projectId: formData.projectId,
      imageUrl: files[0]?.previewUrl || undefined,
      location: formData.location
    }, files.map(f => ({ base64: f.base64, name: f.name, type: f.type })));
    setIsUploading(false);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Camera className="w-8 h-8 text-blue-400" />;
    if (type === 'application/pdf') return <FileText className="w-8 h-8 text-red-400" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-8 h-8 text-green-400" />;
    return <FileCode className="w-8 h-8 text-slate-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-0 md:px-4">
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
        <button onClick={onCancel} className="p-1.5 md:p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200">
          <X className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
        </button>
        <h2 className="text-lg md:text-2xl font-bold text-slate-900">Expense Submission</h2>
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {step === 1 ? (
          <div className="flex flex-col md:flex-row">
            <div className="p-5 md:p-12 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col items-center justify-center text-center space-y-3 md:space-y-6">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-lg shadow-blue-50">
                <Camera className="w-6 h-6 md:w-10 md:h-10" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <h3 className="text-base md:text-xl font-bold text-slate-900">Scan & Upload</h3>
                <p className="text-slate-500 text-[11px] md:text-sm max-w-[220px] md:max-w-[240px]">Upload images, PDFs, Word docs or Excel sheets.</p>
              </div>
              <div className="w-full space-y-2 md:space-y-3">
                <label className="block w-full py-2.5 md:py-3.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100 text-[11px] md:text-sm">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                  Use Camera
                </label>
                <label className="block w-full py-2.5 md:py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer hover:bg-slate-50 transition-all text-[11px] md:text-sm">
                  <input
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  Browse Files
                </label>
                <p className="text-[8px] md:text-[10px] text-slate-400 font-medium tracking-tight">JPG, PNG, PDF, DOCX, XLSX</p>
              </div>
            </div>
            <div className="p-5 md:p-12 flex flex-col items-center justify-center text-center space-y-3 md:space-y-6 bg-slate-50">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-white border border-slate-200 text-slate-400 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-sm">
                <PlusCircle className="w-6 h-6 md:w-10 md:h-10" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <h3 className="text-base md:text-xl font-bold text-slate-900">Direct Entry</h3>
                <p className="text-slate-500 text-[11px] md:text-sm max-w-[220px] md:max-w-[240px]">Type details manually if no receipt is available.</p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-2.5 md:py-3.5 bg-white border border-slate-200 text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all text-[11px] md:text-sm shadow-sm"
              >
                Manual Entry
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-0">
            {isExtracting ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-24 gap-4 md:gap-6">
                <div className="relative w-14 h-14 md:w-16 md:h-16">
                  <div className="absolute inset-0 border-3 md:border-4 border-blue-100 rounded-full" />
                  <div className="absolute inset-0 border-3 md:border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-bold text-sm md:text-base text-slate-900">Parsing Document</p>
                  <p className="text-[10px] md:text-xs text-slate-500">
                    Engine: <span className="text-blue-600 font-bold">{ocrEngine}</span> AI Pipeline
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-12">
                {/* Attached Documents Collapsible */}
                <div className="lg:col-span-5 bg-slate-900 p-4 md:p-6 flex flex-col">
                  <button
                    type="button"
                    onClick={() => setIsDocsExpanded(!isDocsExpanded)}
                    className="flex items-center justify-between w-full text-left mb-3 md:mb-4"
                  >
                    <p className="text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest">Attached Documents ({files.length})</p>
                    <motion.div animate={{ rotate: isDocsExpanded ? 180 : 0 }}>
                      <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isDocsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                          {files.length > 0 ? (
                            files.map((file, idx) => (
                              <div key={idx} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex items-center gap-3 group relative">
                                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                  {file.type.startsWith('image/') ? (
                                    <img src={file.previewUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    getFileIcon(file.type)
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-[11px] font-bold text-white truncate">{file.name}</p>
                                  <p className="text-[9px] text-slate-400">{(file.base64.length * 0.75 / 1024).toFixed(1)} KB</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewUrl(file.previewUrl)}
                                    className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                                    title="Preview"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(idx)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="h-32 flex flex-col items-center justify-center text-center space-y-3 opacity-50 border-2 border-dashed border-slate-700 rounded-xl">
                              <PlusCircle className="w-6 h-6 text-slate-600" />
                              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Empty Vault</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!isDocsExpanded && files.length > 0 && (
                    <div className="flex -space-x-2 mt-2">
                      {files.slice(0, 5).map((f, i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 overflow-hidden bg-slate-800 flex items-center justify-center">
                          {f.type.startsWith('image/') ? <img src={f.previewUrl} className="w-full h-full object-cover" /> : getFileIcon(f.type)}
                        </div>
                      ))}
                      {files.length > 5 && (
                        <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                          +{files.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-auto pt-6">
                    <p className="text-[10px] font-mono text-slate-500 uppercase">Session ID</p>
                    <p className="text-[9px] font-mono text-slate-600 truncate">{files[0]?.base64.substring(0, 32) || 'NEW_SESSION'}</p>
                  </div>
                </div>

                <div className="lg:col-span-7 p-4 md:p-8 space-y-5 md:space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-6">
                    <div className="space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendor / Shop Name</label>
                      <input
                        required
                        type="text"
                        placeholder="Enter vendor name"
                        value={formData.vendorName}
                        onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-900 text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount (₹)</label>
                      <input
                        required
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono font-bold text-slate-900 text-base md:text-lg"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Transaction Date</label>
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-700 text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-700 text-xs md:text-sm"
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">LiDAR Site / Project</label>
                      <select
                        value={formData.projectId}
                        onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-700 text-xs md:text-sm"
                      >
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2 md:space-y-3">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        Expense Location
                        <button
                          type="button"
                          onClick={fetchCurrentLocation}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          <Database className="w-3 h-3" />
                          <span className="text-[8px] md:text-[9px]">Get GPS</span>
                        </button>
                      </label>
                      <div className="relative group/loc">
                        <input
                          type="text"
                          placeholder="Search location or enter manually..."
                          value={formData.location}
                          onChange={e => {
                            setFormData({ ...formData, location: e.target.value });
                            setLocationSearch(e.target.value);
                          }}
                          className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-700 text-xs md:text-sm"
                        />
                        {fetchingLocation && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                          </div>
                        )}

                        <AnimatePresence>
                          {locationResults.length > 0 && locationSearch === formData.location && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[210] max-h-40 md:max-h-48 overflow-y-auto"
                            >
                              {locationResults.map((res, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, location: res.display_name });
                                    setLocationResults([]);
                                  }}
                                  className="w-full text-left px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                >
                                  {res.display_name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Small Map View */}
                      <div className="h-32 md:h-40 w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        {formData.location ? (
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(formData.location)}&z=15&output=embed`}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Database className="w-5 h-5 md:w-6 md:h-6 opacity-30" />
                            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-60">Map view hidden</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Attach More Files</label>
                      <label className="block w-full py-2.5 md:py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-center cursor-pointer hover:bg-slate-100 transition-all text-slate-500 text-[10px] md:text-xs font-semibold">
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <div className="flex items-center justify-center gap-1.5 md:gap-2">
                          <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Add more Bills / Evidence</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 md:pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-3 md:gap-4">
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="flex-1 py-3 md:py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg md:shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-xs md:text-sm"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Finalize Submission</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="py-3 md:py-4 px-6 md:px-8 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-xs md:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Preview Modal for Submission Form */}
      <AnimatePresence>
        {previewUrl && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex flex-col pt-12"
            >
              <div className="absolute top-0 right-0 p-4 flex gap-4">
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 bg-white text-slate-900 rounded-full hover:scale-110 transition-all font-bold"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-black/40 flex items-center justify-center">
                {previewUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : previewUrl.startsWith('data:image/') || previewUrl.startsWith('blob:') ? (
                  <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="File Preview" />
                ) : (
                  <div className="text-white text-center p-8">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-bold">Preview not available for this file type</p>
                    <p className="text-slate-400 text-sm">Please download the file to view it.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpensesHistory({ user, expenses, onUpdateStatus, onBulkUpdateStatus, onDelete, onBulkDelete, onEdit, onBulkEdit, projects, categories }: {
  user: User,
  expenses: Expense[],
  onUpdateStatus: (id: string, s: 'APPROVED' | 'REJECTED', r?: string) => void,
  onBulkUpdateStatus: (ids: string[], s: 'APPROVED' | 'REJECTED', r?: string) => void,
  onDelete: (id: string) => Promise<boolean>,
  onBulkDelete: (ids: string[]) => Promise<boolean>,
  onEdit: (id: string, updates: Partial<Expense>) => void,
  onBulkEdit: (ids: string[], field: string, value: string) => void,
  projects: Project[],
  categories: string[]
}) {
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [reason, setReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'PROCESSED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState('category');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [page, setPage] = useState(1);
  const [showProjectSummary, setShowProjectSummary] = useState(false);
  const rowsPerPage = 10;

  const filteredExpenses = (user.role === 'ADMIN' ? expenses : expenses.filter(e => e.userId === user.id))
    .filter(e => {
      if (activeTab === 'PENDING') return e.status === 'PENDING';
      return e.status === 'APPROVED' || e.status === 'REJECTED';
    })
    .filter(e => {
      const q = searchQuery.toLowerCase();
      const project = projects.find(p => p.id === e.projectId)?.name.toLowerCase() || '';
      return e.vendorName.toLowerCase().includes(q) || project.includes(q);
    })
    .filter(e => {
      if (!dateFrom && !dateTo) return true;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    })
    .filter(e => {
      if (!filterCategory) return true;
      return e.category === filterCategory;
    })
    .filter(e => {
      if (!filterProject) return true;
      return e.projectId === filterProject;
    });

  const statTotalExpenses = filteredExpenses.length;
  const statTotalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const statApprovedAmount = filteredExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);
  const statPendingAmount = filteredExpenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + Number(e.amount), 0);
  const statRejectedAmount = filteredExpenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPages = Math.ceil(filteredExpenses.length / rowsPerPage);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, filterCategory, filterProject, searchQuery, activeTab]);

  const exportToExcel = () => {
    const dataToFilter = selectedIds.length > 0
      ? expenses.filter(e => selectedIds.includes(e.id))
      : filteredExpenses;

    const dataToExport = dataToFilter.map(expense => ({
      ID: expense.id,
      Vendor: expense.vendorName,
      Amount: expense.amount,
      Date: expense.date,
      Category: expense.category,
      Project: projects.find(p => p.id === expense.projectId)?.name || expense.projectId,
      Status: expense.status,
      User: expense.userName,
      Location: expense.location || '',
      CreatedAt: expense.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
    XLSX.writeFile(workbook, `Expenses_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleReject = () => {
    if (selectedExpense && reason) {
      onUpdateStatus(selectedExpense.id, 'REJECTED', reason);
      setShowRejectModal(false);
      setSelectedExpense(null);
      setReason('');
    }
  };

  const handleBulkReject = () => {
    if (selectedIds.length > 0 && reason) {
      onBulkUpdateStatus(selectedIds, 'REJECTED', reason);
      setShowRejectModal(false);
      setReason('');
      setSelectedIds([]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Stat Cards - Compact, responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        {[
          { icon: <CreditCard className="w-3.5 h-3.5" />, label: "Total", value: statTotalExpenses.toString(), color: "bg-blue-100 text-blue-600" },
          { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Amount", value: `₹${statTotalAmount.toLocaleString('en-IN')}`, color: "bg-indigo-100 text-indigo-600" },
          { icon: <CheckCircle className="w-3.5 h-3.5" />, label: "Approved", value: `₹${statApprovedAmount.toLocaleString('en-IN')}`, color: "bg-green-100 text-green-600" },
          { icon: <Clock className="w-3.5 h-3.5" />, label: "Pending", value: `₹${statPendingAmount.toLocaleString('en-IN')}`, color: "bg-amber-100 text-amber-600" },
          { icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Rejected", value: `₹${statRejectedAmount.toLocaleString('en-IN')}`, color: "bg-red-100 text-red-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-2.5 md:p-3 flex items-center gap-2.5 shadow-sm">
            <div className={cn("w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Project-wise Advance Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowProjectSummary(!showProjectSummary)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900">Project-wise Advance Summary</p>
              <p className="text-[9px] text-slate-400">{projects.length} projects</p>
            </div>
          </div>
          {showProjectSummary ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        <AnimatePresence>
          {showProjectSummary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3 text-right">Advance Received</th>
                      <th className="px-4 py-3 text-right">Spent (Approved)</th>
                      <th className="px-4 py-3 text-right">Pending Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projects.filter(p => p.advanceAmount != null && p.advanceAmount > 0).map(p => {
                      const spent = expenses.filter(e => e.projectId === p.id && e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0);
                      const pending = (p.advanceAmount || 0) - spent;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold text-slate-900">{p.name}</span>
                            <span className="text-[9px] font-mono text-slate-400 ml-2">#{p.id}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sm text-slate-900">₹{p.advanceAmount!.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sm text-blue-600">₹{spent.toLocaleString('en-IN')}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-mono font-bold text-sm",
                            pending >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            ₹{pending.toLocaleString('en-IN')}
                            {pending < 0 && <span className="text-[8px] ml-1 text-red-500 font-bold">(OVER)</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {projects.filter(p => p.advanceAmount != null && p.advanceAmount > 0).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">No projects with advance amount configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filters - Compact on mobile */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-[130px] md:w-auto px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-slate-400 text-[10px]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-[130px] md:w-auto px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {(dateFrom || dateTo || filterCategory || filterProject) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterCategory(''); setFilterProject(''); }}
              className="px-2 py-1.5 text-red-600 bg-red-50 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-all"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => { setActiveTab('PENDING'); setSelectedIds([]); }}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all",
                activeTab === 'PENDING' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Pending
            </button>
            <button
              onClick={() => { setActiveTab('PROCESSED'); setSelectedIds([]); }}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all",
                activeTab === 'PROCESSED' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Processed
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={exportToExcel}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] md:text-xs font-bold hover:bg-black transition-all flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              <span className="hidden xs:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 md:gap-8 border border-slate-800 w-[90%] md:w-auto overflow-hidden"
          >
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <span className="text-[10px] md:text-sm font-bold text-blue-400">{selectedIds.length} <span className="hidden xs:inline">items</span> selected</span>
              <div className="w-px h-4 bg-slate-700"></div>
            </div>
            <div className="flex gap-2 flex-1 flex-wrap">
              <button
                onClick={() => { onBulkUpdateStatus(selectedIds, 'APPROVED'); setSelectedIds([]); }}
                className="flex-1 md:px-3 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 truncate"
              >
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                <span className="truncate hidden sm:inline">Approve</span>
              </button>
              <button
                onClick={() => { setSelectedExpense(null); setShowRejectModal(true); }}
                className="flex-1 md:px-3 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 truncate"
              >
                <AlertCircle className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                <span className="truncate hidden sm:inline">Reject</span>
              </button>
              <button
                onClick={() => { setBulkEditField('category'); setBulkEditValue(''); setShowBulkEditModal(true); }}
                className="flex-1 md:px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 truncate"
              >
                <Pencil className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                <span className="truncate hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex-1 md:px-3 py-2 bg-red-800 hover:bg-red-900 rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 truncate"
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                <span className="truncate hidden sm:inline">Delete</span>
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] md:text-xs font-bold transition-all shrink-0"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-2.5 md:p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-[10px] md:text-sm text-slate-700 uppercase tracking-tight">Detailed Logs</h3>
        </div>
        <div className="flex-1">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/30 border-b border-slate-100">
                <tr className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  {user.role === 'ADMIN' && (
                    <th className="px-6 py-4 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="px-6 py-4 text-center">Receipts</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Location</th>
                  {user.role === 'ADMIN' && <th className="px-6 py-4">Employee</th>}
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  {user.role === 'ADMIN' && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={user.role === 'ADMIN' ? 10 : 7} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                      No records found yet.
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map(expense => (
                    <tr key={expense.id} className={cn(
                      "hover:bg-slate-50/50 transition-all group",
                      selectedIds.includes(expense.id) && "bg-blue-50/50 hover:bg-blue-50/50"
                    )}>
                      {user.role === 'ADMIN' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.includes(expense.id)}
                            onChange={() => toggleSelect(expense.id)}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {expense.imageUrl ? (
                            <div className="flex -space-x-3 group/links">
                              {expense.imageUrl.split(',').slice(0, 3).map((url, i) => (
                                <div key={i} className="relative">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shrink-0 shadow-sm bg-slate-100 flex items-center justify-center">
                                    {url.includes('drive.google.com') ? (
                                      <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                        <FileText className="w-5 h-5 text-blue-500" />
                                      </div>
                                    ) : (
                                      <img src={url} className="w-full h-full object-cover" alt="Bill" />
                                    )}
                                  </div>
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/links:opacity-100 flex items-center justify-center gap-1 transition-opacity rounded-lg z-20">
                                    <button
                                      onClick={() => setPreviewUrl(url)}
                                      className="p-1 text-white hover:text-blue-400"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : <CreditCard className="w-5 h-5 text-slate-300" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{expense.vendorName}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">#{projects.find(p => p.id === expense.projectId)?.id || expense.projectId}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-500 max-w-[150px] truncate">{expense.location || "N/A"}</td>
                      {user.role === 'ADMIN' && <td className="px-6 py-4 text-xs font-semibold">{expense.userName}</td>}
                      <td className="px-6 py-4 font-bold text-[10px] text-slate-500">{expense.category}</td>
                      <td className="px-6 py-4 font-mono font-bold">₹{Number(expense.amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><StatusBadge status={expense.status} /></td>
                      {user.role === 'ADMIN' && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            {expense.status === 'PENDING' && (<>
                              <button onClick={() => onUpdateStatus(expense.id, 'APPROVED')} title="Approve" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                              <button onClick={() => { setSelectedExpense(expense); setShowRejectModal(true); }} title="Reject" className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><AlertCircle className="w-4 h-4" /></button>
                            </>)}
                            <button onClick={() => { setEditingExpense(expense); setEditForm({ vendorName: expense.vendorName, amount: expense.amount, date: expense.date, category: expense.category, projectId: expense.projectId, location: expense.location || '' }); }} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(expense.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredExpenses.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-400 text-xs">No records found.</div>
            ) : (
              paginatedExpenses.map(expense => (
                <div key={expense.id} className={cn(
                  "px-3 py-3 space-y-2",
                  selectedIds.includes(expense.id) && "bg-blue-50/50"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {user.role === 'ADMIN' && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 shrink-0"
                          checked={selectedIds.includes(expense.id)}
                          onChange={() => toggleSelect(expense.id)}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{expense.vendorName}</p>
                          <span className="text-[8px] text-slate-400 shrink-0">{expense.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500">{projects.find(p => p.id === expense.projectId)?.name || expense.projectId}</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{expense.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs font-mono font-bold text-slate-900">₹{Number(expense.amount).toLocaleString()}</p>
                      <StatusBadge status={expense.status} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {user.role === 'ADMIN' && expense.status === 'PENDING' && (<>
                        <button onClick={(e) => { e.stopPropagation(); onUpdateStatus(expense.id, 'APPROVED'); }} className="p-1.5 text-green-600 bg-green-50 rounded-lg hover:bg-green-100" title="Approve"><CheckCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedExpense(expense); setShowRejectModal(true); }} className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100" title="Reject"><AlertCircle className="w-3.5 h-3.5" /></button>
                      </>)}
                      {user.role === 'ADMIN' && (<>
                        <button onClick={(e) => { e.stopPropagation(); setEditingExpense(expense); setEditForm({ vendorName: expense.vendorName, amount: expense.amount, date: expense.date, category: expense.category, projectId: expense.projectId, location: expense.location || '' }); }} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(expense.id); }} className="p-1.5 text-red-500 bg-red-50 rounded-lg hover:bg-red-100" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>)}
                      {expense.imageUrl && (
                        <button onClick={(e) => { e.stopPropagation(); setPreviewUrl(expense.imageUrl.split(',')[0]); }} className="p-1.5 text-slate-400 hover:text-blue-600" title="View Receipt"><Eye className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {user.role === 'ADMIN' && expense.userName && (
                      <span className="text-[8px] text-slate-400 truncate">{expense.userName}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 md:px-6 py-3 border-t border-slate-100">
            <span className="text-[10px] md:text-xs text-slate-500">
              {page}/{totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                return start + i;
              }).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-7 h-7 md:w-8 md:h-8 rounded-lg text-[10px] md:text-xs font-bold transition-all",
                    p === page ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex flex-col pt-12"
            >
              <div className="absolute top-0 right-0 p-4 flex gap-4">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all flex items-center gap-2 px-4 font-bold text-sm"
                >
                  <Download className="w-5 h-5" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 bg-white text-slate-900 rounded-full hover:scale-110 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-black/40 flex items-center justify-center">
                {previewUrl.includes('drive.google.com') ? (
                  <iframe
                    src={previewUrl.replace('/view', '/preview')}
                    className="w-full h-full border-none"
                    title="Bill Preview"
                  />
                ) : (
                  <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Bill Preview" />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-xl font-bold">Reject {selectedExpense ? 'Expense' : `${selectedIds.length} Expenses`}</h3>
            <p className="text-gray-500 text-sm">
              Please provide a reason for rejecting {selectedExpense ? <>this expense from <b>{selectedExpense.vendorName}</b></> : <>the selected <b>{selectedIds.length}</b> expenses</>}.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Receipt is blurry, invalid category"
              className="w-full h-24 p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={selectedExpense ? handleReject : handleBulkReject}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Reject Now
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setSelectedExpense(null); setReason(''); }}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Single Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold">Edit Expense</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</label>
                <input value={editForm.vendorName || ''} onChange={e => setEditForm(f => ({ ...f, vendorName: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</label>
                <input type="number" value={editForm.amount ?? ''} onChange={e => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                <select value={editForm.category || ''} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</label>
                <select value={editForm.projectId || ''} onChange={e => setEditForm(f => ({ ...f, projectId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                <input value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { onEdit(editingExpense.id, editForm); setEditingExpense(null); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">Save Changes</button>
              <button onClick={() => setEditingExpense(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold">Bulk Edit <span className="text-blue-600">{selectedIds.length}</span> Expenses</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field to Change</label>
                <select value={bulkEditField} onChange={e => { setBulkEditField(e.target.value); setBulkEditValue(''); }} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="category">Category</option>
                  <option value="projectId">Project</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Value</label>
                {bulkEditField === 'category' && (
                  <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {bulkEditField === 'projectId' && (
                  <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                {bulkEditField === 'status' && (
                  <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button disabled={!bulkEditValue} onClick={() => { onBulkEdit(selectedIds, bulkEditField, bulkEditValue); setShowBulkEditModal(false); setSelectedIds([]); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Apply to All</button>
              <button onClick={() => setShowBulkEditModal(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete loading overlay */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white font-semibold text-lg tracking-wide">Deleting…</p>
        </div>
      )}

      {/* Delete Single Confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-red-600">Delete Expense?</h3>
            <p className="text-slate-500 text-sm">This will permanently remove the expense from the database. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const ok = await onDelete(deleteConfirmId);
                  setIsDeleting(false);
                  if (ok) setDeleteConfirmId(null);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >Delete</button>
              <button onClick={() => setDeleteConfirmId(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-red-600">Delete {selectedIds.length} Expenses?</h3>
            <p className="text-slate-500 text-sm">This will permanently delete all <b>{selectedIds.length}</b> selected expenses. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const ok = await onBulkDelete(selectedIds);
                  setIsDeleting(false);
                  if (ok) { setShowBulkDeleteConfirm(false); setSelectedIds([]); }
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >Delete All</button>
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ProjectsManagement({
  projects,
  users,
  expenses,
  onAddProject,
  onUpdateProject,
  onMapUsers,
  onUpdateStatus,
  onDeleteProject,
  categories,
  onAddCategory,
  dbStatus,
  user,
  isSimulatingFieldCrew
}: {
  projects: Project[],
  users: User[],
  expenses: Expense[],
  onAddProject: (p: Project) => void,
  onUpdateProject: (id: string, updates: Partial<Project>) => void,
  onMapUsers: (projectId: string, userIds: string[]) => void,
  onUpdateStatus: (id: string, s: 'ACTIVE' | 'COMPLETED') => void,
  onDeleteProject: (id: string) => void,
  categories: string[],
  onAddCategory: (c: string) => void,
  dbStatus: any,
  user: User,
  isSimulatingFieldCrew: boolean
}) {
  const [newProject, setNewProject] = useState({ name: '', location: '', advanceAmount: '' });
  const [newCategory, setNewCategory] = useState('');
  const [activeView, setActiveView] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [mappedUsers, setMappedUsers] = useState<string[]>([]);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const activeProjects = projects.filter(p => (p.status || 'ACTIVE') === 'ACTIVE');
  const completedProjects = projects.filter(p => p.status === 'COMPLETED');
  const totalProjectSpend = expenses.reduce((sum, e) => e.status === 'APPROVED' ? sum + Number(e.amount) : sum, 0);

  const filteredProjects = projects.filter(p => (p.status || 'ACTIVE') === activeView);

  const handleAddProjectInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.location) return;
    const project = {
      id: `PRJ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      name: newProject.name,
      location: newProject.location,
      advanceAmount: newProject.advanceAmount ? Number(newProject.advanceAmount) : undefined
    };
    onAddProject(project);
    setNewProject({ name: '', location: '', advanceAmount: '' });
  };

  const handleAddCategoryInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory || categories.includes(newCategory)) return;
    onAddCategory(newCategory);
    setNewCategory('');
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setMappedUsers(users.filter(u => u.projectAssigned === p.id).map(u => u.id));
  };

  const handleUpdateProjectInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    onUpdateProject(editingProject.id, { name: editingProject.name, location: editingProject.location, advanceAmount: editingProject.advanceAmount });
    onMapUsers(editingProject.id, mappedUsers);
    setEditingProject(null);
  };

  const toggleUserMapping = (userId: string) => {
    setMappedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const [isDbExpanded, setIsDbExpanded] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
      <div className="col-span-1 md:col-span-12">
        {user.role === 'ADMIN' && !isSimulatingFieldCrew && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                  dbStatus?.connected ? "bg-green-600 text-white" : "bg-amber-600 text-white"
                )}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Execution Cloud Hub</p>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 uppercase">FieldSpend_Database</h3>
                    <div className={cn("w-2 h-2 rounded-full", dbStatus?.connected ? "bg-green-500" : "bg-amber-500 animate-pulse")}></div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDbExpanded(!isDbExpanded)}
                className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
              >
                {isDbExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            <AnimatePresence>
              {isDbExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Active Ledger</p>
                            <p className="text-[10px] font-bold text-slate-700">Project Master Spreadsheet</p>
                          </div>
                          {dbStatus?.connected && (
                            <a href={dbStatus.url} target="_blank" rel="noreferrer" className="ml-auto p-1.5 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                              <Eye className="w-3.5 h-3.5 text-blue-500" />
                            </a>
                          )}
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Users className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Access Control</p>
                            <p className="text-[10px] font-bold text-slate-700">RABC Protocol Enabled</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center md:border-l border-slate-100 md:pl-8">
                      <div className="mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">DB Connection</p>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={dbStatus?.connected ? 'APPROVED' : 'PENDING'} />
                          <span className="text-[10px] font-bold text-slate-500">{dbStatus?.connected ? 'READY' : 'SYNCING'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Runtime Version</p>
                        <p className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded inline-block">v4.2.0-STABLE</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <div className="col-span-1 md:col-span-7 space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="font-bold text-base md:text-lg text-slate-900">Execution Panel</h3>
            <Briefcase className="text-slate-400 w-4 h-4 md:w-5 md:h-5" />
          </div>
          <form onSubmit={handleAddProjectInternal} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Name</label>
              <input
                type="text"
                value={newProject.name}
                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="e.g. Metro Extension"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</label>
              <input
                type="text"
                value={newProject.location}
                onChange={e => setNewProject({ ...newProject, location: e.target.value })}
                placeholder="City / Site ID"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company Advance (₹)</label>
              <input
                type="number"
                value={newProject.advanceAmount}
                onChange={e => setNewProject({ ...newProject, advanceAmount: e.target.value })}
                placeholder="e.g. 50000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-sm"
              />
            </div>
            <button
              type="submit"
              className="md:col-span-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 text-sm"
            >
              Initialize New Project
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project Portfolios</p>
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveView('ACTIVE')}
                  className={cn(
                    "px-4 py-1 rounded-md text-[10px] font-bold transition-all",
                    activeView === 'ACTIVE' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  ACTIVE
                </button>
                <button
                  onClick={() => setActiveView('COMPLETED')}
                  className={cn(
                    "px-4 py-1 rounded-md text-[10px] font-bold transition-all",
                    activeView === 'COMPLETED' ? "bg-white text-slate-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  COMPLETED
                </button>
              </div>
            </div>
            {filteredProjects.length > 0 ? filteredProjects.map(p => {
              const projectApproved = expenses.filter(e => e.projectId === p.id && e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0);
              const pendingBalance = (p.advanceAmount || 0) - projectApproved;
              return (
                <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">#{p.id}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">{p.location}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {p.advanceAmount != null && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Adv: ₹{p.advanceAmount.toLocaleString('en-IN')}</span>
                        )}
                        {p.advanceAmount != null && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded",
                            pendingBalance >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                          )}>
                            Pending: ₹{pendingBalance.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Project & Mapping"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmProjectId(p.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(p.id, p.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[9px] font-bold transition-all border",
                        p.status === 'COMPLETED' ? "bg-blue-50 text-blue-600 border-blue-100 font-bold" : "bg-white text-slate-400 border-slate-200 hover:text-slate-600"
                      )}
                    >
                      {p.status === 'COMPLETED' ? 'Re-activate' : 'Archive'}
                    </button>
                  </div>
                </div>
              )
            }) : (
              <div className="py-12 text-center text-slate-400">
                <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold">No {activeView.toLowerCase()} projects found</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="col-span-1 md:col-span-5 space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-900">Expense Taxonomy</h3>
            <Settings className="text-slate-400 w-5 h-5" />
          </div>
          <form onSubmit={handleAddCategoryInternal} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="New Category..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-sm"
            />
            <button
              type="submit"
              className="px-4 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition-all"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm flex items-center gap-2">
                {c}
              </span>
            ))}
          </div>
        </section>

        <div className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Portfolio Insights</p>
          <div className="space-y-4 relative z-10">
            <div>
              <p className="text-2xl font-mono font-bold">{projects.length}</p>
              <p className="text-[10px] text-slate-400">Total Active Sub-Projects</p>
            </div>
            <div className="h-px bg-slate-800" />
            <div>
              <p className="text-2xl font-mono font-bold">{categories.length}</p>
              <p className="text-[10px] text-slate-400">Total Expense Classifications</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Edit & Mapping Modal */}
      <AnimatePresence>
        {editingProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Project Settings</p>
                  <h3 className="text-xl font-bold text-slate-900">Edit {editingProject.name}</h3>
                </div>
                <button onClick={() => setEditingProject(null)} className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProjectInternal} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Heading</label>
                    <input
                      required
                      type="text"
                      value={editingProject.name}
                      onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Location</label>
                    <input
                      required
                      type="text"
                      value={editingProject.location}
                      onChange={e => setEditingProject({ ...editingProject, location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company Advance (₹)</label>
                    <input
                      type="number"
                      value={editingProject.advanceAmount ?? ''}
                      onChange={e => setEditingProject({ ...editingProject, advanceAmount: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Team Mapping
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">{mappedUsers.length} Members Assigned</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {users.map(u => (
                      <div
                        key={u.id}
                        onClick={() => toggleUserMapping(u.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98]",
                          mappedUsers.includes(u.id)
                            ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none",
                          mappedUsers.includes(u.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {u.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-bold truncate", mappedUsers.includes(u.id) ? "text-blue-900" : "text-slate-700")}>{u.name}</p>
                          <p className="text-[9px] text-slate-400 truncate tracking-tight">{u.role === 'ADMIN' ? 'Accounts' : 'Field Staff'}</p>
                        </div>
                        {mappedUsers.includes(u.id) && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-2">
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 text-sm"
                  >
                    Commit Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="px-8 py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold hover:bg-slate-100 transition-all text-sm"
                  >
                    Discard
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project delete loading overlay */}
      {isDeletingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white font-semibold text-lg tracking-wide">Deleting project…</p>
        </div>
      )}

      {/* Project delete confirm */}
      {deleteConfirmProjectId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-red-600">Delete Project?</h3>
            <p className="text-slate-500 text-sm">This will permanently remove <b>{projects.find(p => p.id === deleteConfirmProjectId)?.name}</b> from the database. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                disabled={isDeletingProject}
                onClick={async () => {
                  setIsDeletingProject(true);
                  await onDeleteProject(deleteConfirmProjectId);
                  setIsDeletingProject(false);
                  setDeleteConfirmProjectId(null);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >Delete</button>
              <button onClick={() => setDeleteConfirmProjectId(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function FilterBadge({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className={cn(
      "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all transition-colors",
      active ? "bg-blue-50 text-blue-700" : "bg-white border text-slate-500 border-slate-200 hover:bg-slate-50"
    )}>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const config = {
    PENDING: { color: 'text-orange-700 bg-orange-100', label: 'PENDING' },
    APPROVED: { color: 'text-green-700 bg-green-100', label: 'APPROVED' },
    REJECTED: { color: 'text-red-700 bg-red-100', label: 'REJECTED' },
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-[10px] font-bold tracking-tight",
      config[status].color
    )}>
      {config[status].label}
    </span>
  );
}

function LoginPage({ onLogin, allUsers }: { onLogin: (u: User) => void, allUsers: User[] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initialize Google One Tap / Sign In
    const google = (window as any).google;
    if (google) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "194963355909-b1c262c31b5lgcv1n4pnfmjqkrpn90ef.apps.googleusercontent.com",
        callback: handleGoogleResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        { theme: "outline", size: "large", width: 350 }
      );
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    setIsLoggingIn(true);
    setError('');
    try {
      const resp = await fetch('/api/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });
      const data = await resp.json();
      if (resp.ok && data.user) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Google login failed');
      }
    } catch (err) {
      setError('Google login connection failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (resp.ok && data.user) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login connection failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="p-8 md:p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 mb-6 rotate-3">
              <CreditCard className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">FieldSpend</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise Edition</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Work Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@clovetech.com"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-semibold text-slate-900 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Access Token / Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-semibold text-slate-900 shadow-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Secure Login'
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Or sign in with</p>
            <div id="googleBtn" className="w-full"></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function UserManagement({ users, onAddUser, onDeleteUser, onApproveUser, onUpdateUserRole, user, projects, isSimulatingFieldCrew }: { users: User[], onAddUser: (u: User) => void, onDeleteUser: (id: string) => void, onApproveUser: (id: string, approved: boolean) => void, onUpdateUserRole: (id: string, role: UserRole) => void, user: User, projects: Project[], isSimulatingFieldCrew: boolean }) {
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'FIELD_STAFF' as UserRole, password: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 8;
  const userTotalPages = Math.ceil(users.length / usersPerPage);
  const paginatedUsers = users.slice((userPage - 1) * usersPerPage, userPage * usersPerPage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;
    onAddUser({
      id: `USR${Math.floor(Date.now() / 100000).toString()}`,
      ...newUser
    });
    setNewUser({ name: '', email: '', role: 'FIELD_STAFF', password: '' });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm overflow-hidden min-h-[60px] md:min-h-0">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2 md:gap-3">
            <Settings className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            <span className="truncate">Team Access</span>
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="md:hidden px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold"
          >
            {showAddForm ? 'Cancel' : 'Add Member'}
          </button>
        </div>

        {(showAddForm || window.innerWidth >= 768) && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <input
                required
                type="text"
                value={newUser.name}
                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work Email</label>
              <input
                required
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
              <input
                required
                type="password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
              <select
                value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              >
                <option value="FIELD_STAFF">Field Staff / Crew</option>
                <option value="ADMIN">Admin / Accounts</option>
              </select>
            </div>
            <div className="flex items-end lg:col-span-4">
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 text-sm"
              >
                Add User
              </button>
            </div>
          </motion.form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-sm">
          <h3 className="font-bold text-slate-700">Organization Directory ({users.length})</h3>
        </div>
        <div className="flex-1">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 border-b">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role & Permissions</th>
                  <th className="px-6 py-4 text-center">Security Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {u.name[0]}
                        </div>
                        <p className="font-bold text-sm text-slate-900">{u.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">{u.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                          u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                        )}
                        disabled={u.email === 'admin@fieldspend.com'}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="FIELD_STAFF">FIELD STAFF</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          onClick={() => onApproveUser(u.id, !u.isApproved)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                            u.isApproved ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                          )}
                        >
                          {u.isApproved ? "APPROVED" : "PENDING"}
                        </button>
                        {u.googleId && (
                          <div className="flex items-center gap-1 text-[8px] text-blue-600 font-bold uppercase tracking-widest">
                            <Check className="w-2.5 h-2.5" />
                            Google Connected
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onDeleteUser(u.id)}
                        disabled={u.email === 'admin@fieldspend.com'}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedUsers.map(u => (
              <div key={u.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {u.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteUser(u.id)}
                    disabled={u.email === 'admin@fieldspend.com'}
                    className="p-2 text-slate-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</p>
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                      className={cn(
                        "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-white border border-slate-200 text-slate-600'
                      )}
                      disabled={u.email === 'admin@fieldspend.com' || user?.role !== 'ADMIN'}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="FIELD_STAFF">FIELD STAFF</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authentication</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">Managed Credentials</span>
                      {u.googleId && (
                        <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Google Linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onApproveUser(u.id, !u.isApproved)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-xs font-bold transition-all border",
                    u.isApproved ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-100 text-amber-700 border-amber-200"
                  )}
                >
                  {u.isApproved ? "STATUS: APPROVED" : "PENDING APPROVAL - CLICK TO APPROVE"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {userTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing {(userPage - 1) * usersPerPage + 1}-{Math.min(userPage * usersPerPage, users.length)} of {users.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(userTotalPages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(userPage - 3, userTotalPages - 6));
                return start + i;
              }).map(p => (
                <button
                  key={p}
                  onClick={() => setUserPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    p === userPage ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))}
                disabled={userPage >= userTotalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

