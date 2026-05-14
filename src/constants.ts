import { User } from './types.ts';

export const PROJECTS = [
  { id: 'PRJ001', name: 'Metro Survey - Mumbai', location: 'Mumbai', advanceAmount: 50000 },
  { id: 'PRJ002', name: 'LiDAR Mapping - Delhi', location: 'Delhi', advanceAmount: 75000 },
  { id: 'PRJ003', name: 'Smart City - Bangalore', location: 'Bangalore', advanceAmount: 60000 },
];

export const CATEGORIES = [
  'Food',
  'Travel',
  'Fuel',
  'Lodging',
  'Equipment',
  'Miscellaneous',
];

export const MOCK_USER_FIELD: User = {
  id: 'user_1',
  name: 'John Field',
  email: 'john@clovetech.com',
  role: 'FIELD_STAFF',
  projectAssigned: 'PRJ001',
};

export const MOCK_USER_ADMIN: User = {
  id: 'admin_1',
  name: 'Roshan Admin',
  email: 'roshan.s@clovetech.com',
  role: 'ADMIN',
};
