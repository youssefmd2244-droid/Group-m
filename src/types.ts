export interface FormFieldSchema {
  id: string;
  name: string; // The property key used in code/database (can be customField_*)
  labelAr: string;
  labelEn: string;
  type: 'text' | 'number' | 'select' | 'tel' | 'date';
  required: boolean;
  placeholderAr?: string;
  optionsAr?: string; // Comma separated values for select options if type is select
  isEnabled: boolean;
}

export interface UserRecord {
  id: string;
  fullName: string;
  phone: string;
  age: number;
  dob: string;
  streetAddress: string;
  fatherName: string;
  lastName: string;
  schoolOrUniversity: string;
  gender: 'Male' | 'Female' | '';
  nationality: string;
  maritalStatus: string;
  
  // High density 4-photo strategy
  idPhoto: string; // Personal Photo primary fallback Base64
  personalPhoto?: string; // (1) صورة شخصية
  nationalIdFront?: string; // (2) صورة بطاقة وجه
  nationalIdBack?: string; // (3) صورة بطاقة ظهر
  birthCertificate?: string; // (4) صورة شهادة ميلاد
  
  // New Operational Fields
  equipmentUsed?: string; // اسم العُدَد المستخدمة
  equipmentQuantity?: number; // عددها كام

  // Extensible custom field values
  customFields?: { [key: string]: string };
  createdAt: string;
}

export interface ContactNumber {
  id: string;
  label: string;
  number: string;
}

export interface ThemeConfig {
  primary: string;       // Primary color (e.g. brand headers, primary icons)
  secondary: string;     // Secondary details, highlights
  accent: string;        // Button hover & action high-visibility colors
  bgGradientStart: string; // Screen background gradient start hex
  bgGradientEnd: string;   // Screen background gradient end hex
  cardBg: string;        // Hex value for form cards
  borderRadius?: string;   // Rounded styles: 'rounded-none', 'rounded-lg', 'rounded-2xl', 'rounded-3xl'
  isDarkMode?: boolean;    // Dark theme toggle
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  dataPath: string;
  configPath: string;
  isEnabled: boolean;
}

export interface CustomFloatingButton {
  id: string;
  label: string;
  url: string;
  icon: string;
  isFloating: boolean;
}

export interface InstallationFieldSchema {
  id: string;
  name: string;
  labelAr: string;
  type: 'text' | 'number' | 'select' | 'tel';
  required: boolean;
  optionsAr?: string;
  isEnabled: boolean;
}

export interface InstallationRecord {
  id: string;
  workerName: string;
  clientName: string;
  clientMobile: string;
  clientLandline: string;
  area: string;
  buildingName: string;
  buildingNumber: string;
  installationsCount: number;
  clientIdPhoto?: string;
  thermalPhoto?: string;
  boxPhoto?: string;
  mainBoxPhoto?: string;
  installationVideo?: string;
  notes?: string;
  customFields?: { [key: string]: string };
  createdAt: string;
  isPaid?: boolean;
  paidAt?: string;
}

export interface AppConfig {
  websiteTitle: string;
  welcomeSubtitleAr?: string;
  formHeadingAr?: string;
  formSubheadingAr?: string;
  successMessageAr?: string;
  masterPasswordHash: string; // Admin password (set via Security tab — never synced to GitHub)
  whatsappNumbers: ContactNumber[];
  callNumbers: ContactNumber[];
  customFloatingButtons?: CustomFloatingButton[];
  theme: ThemeConfig;
  github: GitHubConfig;
  fieldsSchema?: FormFieldSchema[]; // Dynamic custom field templates
  localizationOverrides?: { [key: string]: string }; // CMS Text replacement mapping
  logoBase64?: string;
  enableTitleAnimation?: boolean;
  installationFieldsSchema?: InstallationFieldSchema[];
  installations?: InstallationRecord[];
  installationPricePerUnit?: number;
}
