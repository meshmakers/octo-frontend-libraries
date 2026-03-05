export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  startDate: string;
  salary: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
}

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, firstName: 'Alice', lastName: 'Schmidt', email: 'alice.schmidt@example.com', department: 'Engineering', role: 'Senior Developer', status: 'Active', startDate: '2019-03-15', salary: 85000 },
  { id: 2, firstName: 'Bob', lastName: 'Mueller', email: 'bob.mueller@example.com', department: 'Engineering', role: 'Tech Lead', status: 'Active', startDate: '2017-07-01', salary: 105000 },
  { id: 3, firstName: 'Clara', lastName: 'Weber', email: 'clara.weber@example.com', department: 'Design', role: 'UX Designer', status: 'Active', startDate: '2020-01-10', salary: 72000 },
  { id: 4, firstName: 'David', lastName: 'Fischer', email: 'david.fischer@example.com', department: 'Marketing', role: 'Marketing Manager', status: 'Active', startDate: '2018-11-20', salary: 78000 },
  { id: 5, firstName: 'Eva', lastName: 'Wagner', email: 'eva.wagner@example.com', department: 'Engineering', role: 'Junior Developer', status: 'Active', startDate: '2023-06-01', salary: 55000 },
  { id: 6, firstName: 'Frank', lastName: 'Becker', email: 'frank.becker@example.com', department: 'Sales', role: 'Account Executive', status: 'On Leave', startDate: '2021-02-14', salary: 68000 },
  { id: 7, firstName: 'Greta', lastName: 'Hoffmann', email: 'greta.hoffmann@example.com', department: 'Engineering', role: 'DevOps Engineer', status: 'Active', startDate: '2020-09-01', salary: 90000 },
  { id: 8, firstName: 'Hans', lastName: 'Schulz', email: 'hans.schulz@example.com', department: 'HR', role: 'HR Specialist', status: 'Active', startDate: '2019-04-15', salary: 62000 },
  { id: 9, firstName: 'Ingrid', lastName: 'Koch', email: 'ingrid.koch@example.com', department: 'Finance', role: 'Financial Analyst', status: 'Active', startDate: '2021-08-01', salary: 74000 },
  { id: 10, firstName: 'Jan', lastName: 'Bauer', email: 'jan.bauer@example.com', department: 'Engineering', role: 'QA Engineer', status: 'Active', startDate: '2022-03-10', salary: 65000 },
  { id: 11, firstName: 'Katrin', lastName: 'Richter', email: 'katrin.richter@example.com', department: 'Design', role: 'Product Designer', status: 'Active', startDate: '2020-11-15', salary: 76000 },
  { id: 12, firstName: 'Lars', lastName: 'Klein', email: 'lars.klein@example.com', department: 'Engineering', role: 'Senior Developer', status: 'On Leave', startDate: '2018-05-20', salary: 88000 },
  { id: 13, firstName: 'Maria', lastName: 'Wolf', email: 'maria.wolf@example.com', department: 'Marketing', role: 'Content Strategist', status: 'Active', startDate: '2022-01-05', salary: 60000 },
  { id: 14, firstName: 'Nico', lastName: 'Schroeder', email: 'nico.schroeder@example.com', department: 'Engineering', role: 'Frontend Developer', status: 'Active', startDate: '2021-06-15', salary: 72000 },
  { id: 15, firstName: 'Olga', lastName: 'Neumann', email: 'olga.neumann@example.com', department: 'Sales', role: 'Sales Director', status: 'Active', startDate: '2016-09-01', salary: 115000 },
  { id: 16, firstName: 'Peter', lastName: 'Schwarz', email: 'peter.schwarz@example.com', department: 'Engineering', role: 'Architect', status: 'Active', startDate: '2015-02-01', salary: 120000 },
  { id: 17, firstName: 'Rita', lastName: 'Zimmermann', email: 'rita.zimmermann@example.com', department: 'HR', role: 'HR Manager', status: 'Active', startDate: '2017-10-01', salary: 82000 },
  { id: 18, firstName: 'Stefan', lastName: 'Braun', email: 'stefan.braun@example.com', department: 'Finance', role: 'Controller', status: 'Inactive', startDate: '2019-01-15', salary: 95000 },
  { id: 19, firstName: 'Tanja', lastName: 'Hartmann', email: 'tanja.hartmann@example.com', department: 'Engineering', role: 'Backend Developer', status: 'Active', startDate: '2022-09-01', salary: 70000 },
  { id: 20, firstName: 'Uwe', lastName: 'Lange', email: 'uwe.lange@example.com', department: 'Design', role: 'Design Lead', status: 'Active', startDate: '2018-03-15', salary: 92000 },
  { id: 21, firstName: 'Vera', lastName: 'Krause', email: 'vera.krause@example.com', department: 'Engineering', role: 'Data Engineer', status: 'Active', startDate: '2023-01-10', salary: 80000 },
  { id: 22, firstName: 'Werner', lastName: 'Frank', email: 'werner.frank@example.com', department: 'Sales', role: 'Sales Representative', status: 'Active', startDate: '2021-11-01', salary: 58000 },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'P001', name: 'Industrial Sensor A200', category: 'Sensors', price: 249.99, sku: 'SNS-A200' },
  { id: 'P002', name: 'Pressure Transmitter PT100', category: 'Sensors', price: 189.50, sku: 'SNS-PT100' },
  { id: 'P003', name: 'Temperature Probe TP50', category: 'Sensors', price: 79.99, sku: 'SNS-TP50' },
  { id: 'P004', name: 'Flow Meter FM300', category: 'Meters', price: 599.00, sku: 'MTR-FM300' },
  { id: 'P005', name: 'Level Gauge LG100', category: 'Meters', price: 349.99, sku: 'MTR-LG100' },
  { id: 'P006', name: 'PLC Controller X500', category: 'Controllers', price: 1299.00, sku: 'CTL-X500' },
  { id: 'P007', name: 'HMI Panel HP700', category: 'Controllers', price: 899.00, sku: 'CTL-HP700' },
  { id: 'P008', name: 'Motor Drive MD200', category: 'Drives', price: 749.50, sku: 'DRV-MD200' },
  { id: 'P009', name: 'Servo Drive SD400', category: 'Drives', price: 1150.00, sku: 'DRV-SD400' },
  { id: 'P010', name: 'Relay Module RM16', category: 'Modules', price: 45.99, sku: 'MOD-RM16' },
  { id: 'P011', name: 'I/O Module IO32', category: 'Modules', price: 129.99, sku: 'MOD-IO32' },
  { id: 'P012', name: 'Power Supply PS24V', category: 'Power', price: 89.00, sku: 'PWR-PS24V' },
  { id: 'P013', name: 'UPS System UPS3000', category: 'Power', price: 2199.00, sku: 'PWR-UPS3K' },
  { id: 'P014', name: 'Ethernet Switch ES8', category: 'Networking', price: 199.99, sku: 'NET-ES8' },
  { id: 'P015', name: 'Wireless Gateway WG100', category: 'Networking', price: 459.00, sku: 'NET-WG100' },
  { id: 'P016', name: 'Safety Light Curtain SLC', category: 'Safety', price: 679.00, sku: 'SAF-SLC' },
  { id: 'P017', name: 'Emergency Stop ES01', category: 'Safety', price: 34.99, sku: 'SAF-ES01' },
];
