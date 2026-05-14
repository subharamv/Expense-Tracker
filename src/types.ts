export type UserRole = 'ADMIN' | 'FIELD_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  projectAssigned?: string;
  password?: string;
  isApproved?: boolean;
  googleId?: string;
}

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Expense {
  id: string;
  userId: string;
  userName: string;
  vendorName: string;
  amount: number;
  date: string;
  category: string;
  projectId: string;
  status: ExpenseStatus;
  rejectionReason?: string;
  createdAt: string;
  location?: string;
  imageUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  status?: 'ACTIVE' | 'COMPLETED';
  advanceAmount?: number;
}
