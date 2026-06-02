import React, { useState, useEffect } from 'react';
import { 
  Settings, Users, Palette, Github, FileDown, Eye, Edit2, Trash2, KeyRound, 
  Globe, PhoneCall, Save, RefreshCw, LogOut, Check, Search, X, 
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Plus, Sparkles, Printer, Lock,
  Sliders, Languages, PlusCircle, CheckSquare, Square, Send, Link, ToggleLeft, ToggleRight
} from 'lucide-react';
import { UserRecord, ContactNumber, ThemeConfig, AppConfig, GitHubConfig, FormFieldSchema, CustomFloatingButton } from '../types';
import { exportProfileAsPNG, printUserProfile, exportProfileAsHTML2Canvas } from '../utils/exportProfile';
import { exportToExcel, exportToWord, exportToCSV, exportToImage } from '../utils/advancedExports';

interface SettingsDashboardProps {
  appConfig: AppConfig;
  users: UserRecord[];
  onUpdateConfig: (newConfig: AppConfig) => void;
  onUpdateUsers: (newUsers: UserRecord[]) => void;
  onTriggerSync: () => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  onClose: () => void;
  onAdminLogin?: () => void;
  onAdminLogout?: () => void;
}

export default function SettingsDashboard({
  appConfig,
  users,
  onUpdateConfig,
  onUpdateUsers,
  onTriggerSync,
  syncStatus,
  onClose,
  onAdminLogin,
  onAdminLogout,
}: SettingsDashboardProps) {
  // Authentication Gateway State
  // Restore from sessionStorage so refresh doesn't re-lock the admin panel
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('group_m_admin_session') === 'active';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Tabs layout matching core goals
  const [activeTab, setActiveTab] = useState<'inbox' | 'database' | 'schema' | 'localization' | 'contacts' | 'theme' | 'github' | 'security'>('inbox');

  // Search & Pagination in Inbox
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Database Console (separate search/filter state)
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbCurrentPage, setDbCurrentPage] = useState(1);
  const [dbItemsPerPage] = useState(15);
  const [dbGenderFilter, setDbGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');


  // Focus Modal views
  const [focusedUser, setFocusedUser] = useState<UserRecord | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [activeExportDropdown, setActiveExportDropdown] = useState<string | null>(null);

  // 1. DYNAMIC COMPONENT & SCHEMA STATE
  const [fieldsSchemaList, setFieldsSchemaList] = useState<FormFieldSchema[]>(appConfig.fieldsSchema || []);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabelAr, setNewFieldLabelAr] = useState('');
  const [newFieldLabelEn, setNewFieldLabelEn] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'tel' | 'date'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptionsAr, setNewFieldOptionsAr] = useState('');
  const [newFieldPlaceholderAr, setNewFieldPlaceholderAr] = useState('');
  const [schemaMessage, setSchemaMessage] = useState('');

  // 2. LOCALIZATION CMS DICTIONARY OVERRIDES
  const [localizationMap, setLocalizationMap] = useState<{ [key: string]: string }>(appConfig.localizationOverrides || {});
  const [locSuccess, setLocSuccess] = useState('');

  // Basic layout configurations state
  const [websiteTitle, setWebsiteTitle] = useState(appConfig.websiteTitle);
  const [securityPassword, setSecurityPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secSuccess, setSecSuccess] = useState('');
  const [secError, setSecError] = useState('');

  const [whatsappList, setWhatsappList] = useState<ContactNumber[]>(appConfig.whatsappNumbers || []);
  const [callList, setCallList] = useState<ContactNumber[]>(appConfig.callNumbers || []);
  const [newContactLabel, setNewContactLabel] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactType, setContactType] = useState<'whatsapp' | 'call'>('whatsapp');
  const [contactMessage, setContactMessage] = useState('');

  // Custom Floating Buttons state variables
  const [customButtonsList, setCustomButtonsList] = useState<CustomFloatingButton[]>(appConfig.customFloatingButtons || []);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [newCustomIcon, setNewCustomIcon] = useState('Send');
  const [newCustomIsFloating, setNewCustomIsFloating] = useState(true);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);

  const [themeColors, setThemeColors] = useState<ThemeConfig>(appConfig.theme);
  const [themeMessage, setThemeMessage] = useState('');

  const [ghToken, setGhToken] = useState(appConfig.github.token);
  const [ghOwner, setGhOwner] = useState(appConfig.github.owner);
  const [ghRepo, setGhRepo] = useState(appConfig.github.repo);
  const [ghBranch, setGhBranch] = useState(appConfig.github.branch || 'main');
  const [ghDataPath, setGhDataPath] = useState(appConfig.github.dataPath || 'data.json');
  const [ghConfigPath, setGhConfigPath] = useState(appConfig.github.configPath || 'config.json');
  const [ghEnabled, setGhEnabled] = useState(appConfig.github.isEnabled);
  const [ghMessage, setGhMessage] = useState({ text: '', type: 'success' as 'success' | 'error' });

  // Dynamic Custom Favicon Logo & Website Title Animations States
  const [logoBase64, setLogoBase64] = useState(appConfig.logoBase64 || '');
  const [enableTitleAnimation, setEnableTitleAnimation] = useState(appConfig.enableTitleAnimation || false);

  // Sync state modifications when props reload
  useEffect(() => {
    setWebsiteTitle(appConfig.websiteTitle);
    setWhatsappList(appConfig.whatsappNumbers || []);
    setCallList(appConfig.callNumbers || []);
    setCustomButtonsList(appConfig.customFloatingButtons || []);
    setThemeColors(appConfig.theme);
    setFieldsSchemaList(appConfig.fieldsSchema || []);
    setLocalizationMap(appConfig.localizationOverrides || {});
    setGhToken(appConfig.github.token);
    setGhOwner(appConfig.github.owner);
    setGhRepo(appConfig.github.repo);
    setGhBranch(appConfig.github.branch || 'main');
    setGhDataPath(appConfig.github.dataPath || 'data.json');
    setGhConfigPath(appConfig.github.configPath || 'config.json');
    setGhEnabled(appConfig.github.isEnabled);
    setLogoBase64(appConfig.logoBase64 || '');
    setEnableTitleAnimation(appConfig.enableTitleAnimation || false);
  }, [appConfig]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = appConfig.masterPasswordHash || '20042007';
    if (passwordInput === correctPassword) {
      setIsAuthenticated(true);

      // Persist admin session for this browser tab (cleared automatically on tab/browser close)
      sessionStorage.setItem('group_m_admin_session', 'active');

      // Permanently flag this machine as authorized for background notifications
      localStorage.setItem('isAdminNotificationDevice', 'true');

      // Ask prompt permission for browser Notifications
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }

      setAuthError('');
      if (onAdminLogin) {
        onAdminLogin();
      }
    } else {
      setAuthError('الرمز السري المكتوب خاطئ! الرجاء إعادة المحاولة.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    sessionStorage.removeItem('group_m_admin_session');
    if (onAdminLogout) {
      onAdminLogout();
    }
  };

  // 1. INBOX DATAGRID & MUTATIONS
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.fatherName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.streetAddress.toLowerCase().includes(q) ||
      u.schoolOrUniversity.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من مسح استمارة الطالب "${name}" نهائياً من الشبكة؟`)) {
      const updated = users.filter((u) => u.id !== id);
      onUpdateUsers(updated);
    }
  };

  const handlePurgeAll = () => {
    if (window.confirm('🚨 تحذير أمني: هل أنت متأكد من مسح وتطهير جميع السجلات والملفات المرفقة بالكامل من الموقع والشبكة؟ لا يمكن التراجع عن هذا الإجراء!')) {
      onUpdateUsers([]);
    }
  };

  const handleUpdateUserValue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const updated = users.map((u) => (u.id === editingUser.id ? editingUser : u));
    onUpdateUsers(updated);
    setEditingUser(null);
  };

  // 2. SCHEMA DEFINITIONS (CMS FORM LAYERS)
  const handleAddSchemaField = () => {
    if (!newFieldLabelAr.trim() || !newFieldLabelEn.trim()) {
      setSchemaMessage('يرجى تعبئة الملصقات التعريفية العربية والإنجليزية معاً!');
      return;
    }
    const cleanKeyName = newFieldName.trim() || `custom_field_${Date.now()}`;
    const newField: FormFieldSchema = {
      id: `schema_${Date.now()}`,
      name: cleanKeyName,
      labelAr: newFieldLabelAr.trim(),
      labelEn: newFieldLabelEn.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholderAr: newFieldPlaceholderAr.trim(),
      optionsAr: newFieldOptionsAr.trim(),
      isEnabled: true
    };

    const updatedList = [...fieldsSchemaList, newField];
    setFieldsSchemaList(updatedList);
    
    const updatedConfig = { ...appConfig, fieldsSchema: updatedList };
    onUpdateConfig(updatedConfig);

    setNewFieldName('');
    setNewFieldLabelAr('');
    setNewFieldLabelEn('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptionsAr('');
    setNewFieldPlaceholderAr('');
    setSchemaMessage('تم تسجيل الحقل المخصص وتحديث استمارات التسجيل بنجاح!');
    setTimeout(() => setSchemaMessage(''), 3000);
  };

  const toggleSchemaFieldStatus = (id: string) => {
    const updated = fieldsSchemaList.map(f => f.id === id ? { ...f, isEnabled: !f.isEnabled } : f);
    setFieldsSchemaList(updated);
    onUpdateConfig({ ...appConfig, fieldsSchema: updated });
  };

  const handleUpdateSchemaFieldInline = (id: string, updatedFields: Partial<FormFieldSchema>) => {
    const updated = fieldsSchemaList.map(f => f.id === id ? { ...f, ...updatedFields } : f);
    setFieldsSchemaList(updated);
    onUpdateConfig({ ...appConfig, fieldsSchema: updated });
  };

  const deleteSchemaField = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحقل الإضافي نهائياً من قائمة التسجيل؟')) {
      const updated = fieldsSchemaList.filter(f => f.id !== id);
      setFieldsSchemaList(updated);
      onUpdateConfig({ ...appConfig, fieldsSchema: updated });
    }
  };

  // 3. HOME CMS LOCALIZATION MAPPERS
  const localizationKeys = [
    { key: 'registrationFormTitle', label: 'عنوان كارت الاستمارة الرئيسي', defaultVal: 'استمارة تسجيل عضوية جديدة' },
    { key: 'welcomeSubtitle', label: 'النص التعريفي المساعد تحت العنوان', defaultVal: 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية' },
    { key: 'submitButtonText', label: 'نص زر الإرسال المضيء', defaultVal: 'إرسال استمارة التسجيل والمزامنة' },
    { key: 'successMessageAr', label: 'رسالة إشعار النجاح بعد الحفظ', defaultVal: 'تم حفظ استمارة التسجيل بنجاح في قاعدة البيانات المحلية!' },
    { key: 'publicTableTitle', label: 'عنوان جدول قاعدة البيانات في الواجهة', defaultVal: 'بيانات التسجيل والسجلات النشطة' }
  ];

  const handleSaveLocalizationOverrides = () => {
    const updatedConfig = {
      ...appConfig,
      localizationOverrides: localizationMap
    };
    onUpdateConfig(updatedConfig);
    setLocSuccess('تمت كتابة الأقسام والعبارات الجديدة وحفظها بنجاح!');
    setTimeout(() => setLocSuccess(''), 3000);
  };

  const handleLocMapChange = (key: string, value: string) => {
    setLocalizationMap(prev => ({ ...prev, [key]: value }));
  };

  // 4. FLOATING CONTACT SWITCHES
  const addContactNumber = () => {
    if (!newContactLabel.trim() || !newContactPhone.trim()) {
      setContactMessage('يرجى كتابة الاسم ورقم الهاتف معاً!');
      return;
    }
    const newContact: ContactNumber = {
      id: `cont_${Date.now()}`,
      label: newContactLabel.trim(),
      number: newContactPhone.trim(),
    };

    let updatedConfig = { ...appConfig };
    if (contactType === 'whatsapp') {
      const list = [...whatsappList, newContact];
      setWhatsappList(list);
      updatedConfig.whatsappNumbers = list;
    } else {
      const list = [...callList, newContact];
      setCallList(list);
      updatedConfig.callNumbers = list;
    }

    onUpdateConfig(updatedConfig);
    setNewContactLabel('');
    setNewContactPhone('');
    setContactMessage('تم إدخال الرقم وحفظ الإعدادات الهاتفي بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const deleteContactNumber = (id: string, type: 'whatsapp' | 'call') => {
    let updatedConfig = { ...appConfig };
    if (type === 'whatsapp') {
      const list = whatsappList.filter(c => c.id !== id);
      setWhatsappList(list);
      updatedConfig.whatsappNumbers = list;
    } else {
      const list = callList.filter(c => c.id !== id);
      setCallList(list);
      updatedConfig.callNumbers = list;
    }
    onUpdateConfig(updatedConfig);
    setContactMessage('تم إخلاء الرقم بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  // 4B. CUSTOM FLOATING BUTTON ACTIONS
  const addCustomFloatingButton = () => {
    if (!newCustomLabel.trim() || !newCustomUrl.trim()) {
      setContactMessage('يرجى ملاء البيانات بالكامل للزر المخصص!');
      return;
    }
    const newBtn: CustomFloatingButton = {
      id: `btn_${Date.now()}`,
      label: newCustomLabel.trim(),
      url: newCustomUrl.trim(),
      icon: newCustomIcon,
      isFloating: newCustomIsFloating,
    };

    const updatedList = [...customButtonsList, newBtn];
    setCustomButtonsList(updatedList);

    const updatedConfig = {
      ...appConfig,
      customFloatingButtons: updatedList,
    };
    onUpdateConfig(updatedConfig);

    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
    setContactMessage('تم إدراج وحفظ الزر العائم المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const deleteCustomFloatingButton = (id: string) => {
    const updatedList = customButtonsList.filter(b => b.id !== id);
    setCustomButtonsList(updatedList);

    const updatedConfig = {
      ...appConfig,
      customFloatingButtons: updatedList,
    };
    onUpdateConfig(updatedConfig);
    setContactMessage('تم حذف الزر المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const toggleCustomFloatingState = (id: string) => {
    const updatedList = customButtonsList.map(b => 
      b.id === id ? { ...b, isFloating: !b.isFloating } : b
    );
    setCustomButtonsList(updatedList);

    const updatedConfig = {
      ...appConfig,
      customFloatingButtons: updatedList,
    };
    onUpdateConfig(updatedConfig);
  };

  const startEditCustomButton = (btn: CustomFloatingButton) => {
    setEditingCustomId(btn.id);
    setNewCustomLabel(btn.label);
    setNewCustomUrl(btn.url);
    setNewCustomIcon(btn.icon);
    setNewCustomIsFloating(btn.isFloating);
  };

  const saveEditCustomButton = () => {
    if (!newCustomLabel.trim() || !newCustomUrl.trim()) {
      setContactMessage('يرجى ملاء البيانات بالكامل للزر المخصص!');
      return;
    }
    const updatedList = customButtonsList.map(b => 
      b.id === editingCustomId 
        ? { ...b, label: newCustomLabel.trim(), url: newCustomUrl.trim(), icon: newCustomIcon, isFloating: newCustomIsFloating } 
        : b
    );
    setCustomButtonsList(updatedList);
    setEditingCustomId(null);

    const updatedConfig = {
      ...appConfig,
      customFloatingButtons: updatedList,
    };
    onUpdateConfig(updatedConfig);

    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
    setContactMessage('تم حفظ تعديل الزر المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const cancelEditCustomButton = () => {
    setEditingCustomId(null);
    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
  };

  // 5. COLORS WHEEL & THEME BINDINGS
  const colorPresets = [
    { name: 'كلاسيك بحري / Slate Blue', primary: '#0f172a', secondary: '#475569', accent: '#14b8a6', bgGradientStart: '#f8fafc', bgGradientEnd: '#e2e8f0', borderRadius: 'rounded-xl' },
    { name: 'الأخضر الزمردي / Emerald', primary: '#064e3b', secondary: '#059669', accent: '#10b981', bgGradientStart: '#f0fdf4', bgGradientEnd: '#dcfce7', borderRadius: 'rounded-2xl' },
    { name: 'الأرجواني الملكي / Violet', primary: '#4c1d95', secondary: '#7c3aed', accent: '#a78bfa', bgGradientStart: '#faf5ff', bgGradientEnd: '#f3e8ff', borderRadius: 'rounded-3xl' },
    { name: 'النحاسي الذهبي / Amber', primary: '#78350f', secondary: '#b45309', accent: '#f59e0b', bgGradientStart: '#fffbeb', bgGradientEnd: '#fef3c7', borderRadius: 'rounded-lg' },
    { name: 'التيتانيوم الفحمي / Dark Zinc', primary: '#18181b', secondary: '#3f3f46', accent: '#f4f4f5', bgGradientStart: '#09090b', bgGradientEnd: '#1e1e24', borderRadius: 'rounded-2xl', isDarkMode: true }
  ];

  const applyPresetTheme = (preset: typeof colorPresets[0]) => {
    const updatedTheme: ThemeConfig = {
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      bgGradientStart: preset.bgGradientStart,
      bgGradientEnd: preset.bgGradientEnd,
      cardBg: preset.isDarkMode ? '#1e1e24' : '#ffffff',
      borderRadius: preset.borderRadius,
      isDarkMode: preset.isDarkMode || false
    };

    setThemeColors(updatedTheme);
    onUpdateConfig({ ...appConfig, theme: updatedTheme });
    setThemeMessage('تم تطبيق تناسق الألوان وسِلسِلة القوالب فورياً وعبر كافة الشاشات!');
    setTimeout(() => setThemeMessage(''), 3000);
  };

  const handleCustomColorInput = (key: keyof ThemeConfig, val: string | boolean) => {
    const updatedTheme = { ...themeColors, [key]: val };
    setThemeColors(updatedTheme);
    onUpdateConfig({ ...appConfig, theme: updatedTheme });
  };

  // 6. GITHUB REST PIPELINE HANDLERS
  const handleSaveGithubConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedConfig = {
      ...appConfig,
      websiteTitle,
      logoBase64,
      enableTitleAnimation,
      github: {
        token: ghToken.trim(),
        owner: ghOwner.trim(),
        repo: ghRepo.trim(),
        branch: ghBranch.trim(),
        dataPath: ghDataPath.trim(),
        configPath: ghConfigPath.trim(),
        isEnabled: ghEnabled,
      }
    };
    onUpdateConfig(updatedConfig);
    setGhMessage({ text: 'تمت كتابة التوكن والمستودع بنجاح، يمكنك تجربة الضغط على المزامنة الآن!', type: 'success' });
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 4000);
  };

  const triggerForceSync = async () => {
    setGhMessage({ text: 'جاري محاذاة ورفع الملفات والتأكد من عدم وجود تعارض...', type: 'success' });
    try {
      await onTriggerSync();
      setGhMessage({ text: 'رائع! تمت تصفية وتحديث جميع الحقول وقائمة الطلاب بنجاح في قاعدة البيانات السحابية (Complete)!', type: 'success' });
    } catch (err: any) {
      setGhMessage({ text: `فشل الاتصال: ${err?.message || 'تأكد من صلاحيات مفتاح الهوية (PAT)'}`, type: 'error' });
    }
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 5000);
  };

  // 7. SECURITY PASSWORD SYSTEM
  const handleSecurityPassUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityPassword.trim() || securityPassword !== confirmPassword) {
      setSecError('كلمتا المرور غير متطابقتين أو تحتوي حقولاً فارغة!');
      return;
    }
    onUpdateConfig({ ...appConfig, masterPasswordHash: securityPassword.trim() });
    setSecSuccess('تم تحديث الرقم السري لبوابة الإشراف وحفظ التعديلات أمنياً!');
    setSecurityPassword('');
    setConfirmPassword('');
    setSecError('');
    setTimeout(() => setSecSuccess(''), 3000);
  };

  // Gate Modal: Unauthorised Admin protection
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" id="admin-lockscreen">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in duration-200" dir="rtl" id="settings-gate-card">
          <div className="p-6 text-center text-white flex flex-col items-center justify-center relative bg-slate-900" style={{ backgroundColor: themeColors.primary }}>
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2.5">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-black">جهاز إدخال الهوية للمشرف</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Admin Access Only · Restricted</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-6 space-y-4" id="lockscreen-form">
            {authError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-1.5" id="lockscreen-error">
                <AlertCircle size={14} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500">الرقم السري للمشرف</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-center font-mono focus:ring-2 focus:ring-slate-800 transition text-slate-800 text-sm"
                required
                autoFocus
                id="lockscreen-pass-input"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-bold transition text-xs cursor-pointer hover:opacity-90"
                style={{ backgroundColor: themeColors.primary }}
                id="lockscreen-submit"
              >
                دخول لوحة التحكم
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 font-bold border border-slate-200 hover:bg-slate-50 transition text-xs cursor-pointer"
                id="lockscreen-cancel"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4" id="admin-workspace-modal">
      <div className="bg-slate-50 rounded-3xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in duration-200 text-right" dir="rtl" id="settings-admin-panel">
        
        {/* Title Navbar */}
        <header className="px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0 select-none bg-slate-900" style={{ backgroundColor: themeColors.primary }} id="settings-header">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition duration-150 text-slate-100 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              id="admin-logout-btn"
            >
              <LogOut size={13} />
              <span>خروج المشرف</span>
            </button>
          </div>

          <div className="text-center">
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2 justify-center">
              <Settings className="w-5 h-5 animate-spin-slow" />
              منصة التحكم وإدارة استمارات الطلاب (CMS)
            </h2>
            <p className="text-[9px] text-slate-300">ADMIN CONTROL CENTER & COMPONENT MANAGER</p>
          </div>

          <div>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition duration-150 text-white cursor-pointer"
              id="admin-close-panel-btn"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Sync Status Overlay Indicator */}
        <div className="bg-white px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold gap-2 shrink-0 text-slate-600" id="admin-sync-bar">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-slate-600">شبكة الاتصال السحابي (GitHub Stream API):</span>
            <span className={`font-black ${syncStatus === 'syncing' ? 'text-amber-500' : syncStatus === 'success' ? 'text-emerald-500' : syncStatus === 'error' ? 'text-rose-500' : 'text-slate-600'}`}>
              {syncStatus === 'syncing' && 'جاري محاذاة ورفع المرفقات...'}
              {syncStatus === 'success' && 'محدث ومُزامن بالكامل مع جيت هاب!'}
              {syncStatus === 'error' && 'عطل في التزامن (يرجى مراجعة التوكن في التبويب والمحاولة مجدداً)'}
              {syncStatus === 'idle' && 'جاهز / تخزين محلي وتلقائي'}
            </span>
          </div>

          <button
            onClick={triggerForceSync}
            disabled={syncStatus === 'syncing'}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 cursor-pointer text-[10px] font-bold"
            id="admin-sync-trigger-btn"
          >
            <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            مزامنة السحابة الإجبارية الفورية
          </button>
        </div>

        {/* Main Dashboard Space split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden" id="admin-workspace-grid">
          
          {/* Right Columns Navigation sidebar tabs */}
          <nav className="w-full md:w-52 bg-white border-l border-slate-200 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible shrink-0 select-none" id="admin-tabs">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'inbox' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'inbox' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-inbox"
            >
              <Users size={14} />
              <span>صندوق الوارد ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'database' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'database' ? { backgroundColor: '#0d9488' } : {}}
              id="tab-database"
            >
              <Eye size={14} />
              <span>قاعدة البيانات الحية</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'schema' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'schema' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-schema"
            >
              <Sliders size={14} />
              <span>المحاذاة ومصمم الاستمارة</span>
            </button>

            <button
              onClick={() => setActiveTab('localization')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'localization' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'localization' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-localization"
            >
              <Languages size={14} />
              <span>توطين وتثبيت العبارات</span>
            </button>

            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'contacts' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'contacts' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-contacts"
            >
              <PhoneCall size={14} />
              <span>أرقام الأقراص الطافية</span>
            </button>

            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'theme' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'theme' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-theme"
            >
              <Palette size={14} />
              <span>تخصيص الهوية البصرية</span>
            </button>

            <button
              onClick={() => setActiveTab('github')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'github' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'github' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-github"
            >
              <Github size={14} />
              <span>إعدادات الاتصال بالسحابة</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === 'security' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              style={activeTab === 'security' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-security"
            >
              <KeyRound size={14} />
              <span>الأمان والرمز السري</span>
            </button>
          </nav>

          {/* Tab Content Display */}
          <main className="flex-1 p-4 sm:p-5 overflow-y-auto" id="admin-workspace-body">
            
            {/* ====== TAB 1: INBOX REGISTERED GRID ====== */}
            {activeTab === 'inbox' && (
              <div className="space-y-4 text-right" id="tab-inbox-workspace">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800">صندوق الوارد وإدارة المسجلين</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">جدول عالي الكثافة لعرض تفاصيل المتقدمين واستخراج الطلبات وإجراء التعديلات والPurge.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handlePurgeAll}
                      disabled={users.length === 0}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      id="purge-all-btn"
                    >
                      <Trash2 size={13} />
                      تطهير كافة البيانات (Purge)
                    </button>

                    <button
                      onClick={() => exportToExcel(users)}
                      disabled={users.length === 0}
                      className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-indigo-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      title="تصدير كجدول Excel"
                      id="export-excel-inbox-btn"
                    >
                      <FileDown size={13} />
                      تصدير Excel
                    </button>

                    <button
                      onClick={() => exportToWord(users)}
                      disabled={users.length === 0}
                      className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-blue-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      title="تصدير كملف Word"
                      id="export-word-inbox-btn"
                    >
                      <FileDown size={13} />
                      تصدير Word
                    </button>

                    <div className="relative w-full sm:w-56" id="inbox-search">
                      <Search className="absolute right-3.5 top-2.5 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم، الموبايل..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-9 pl-3.5 py-1.5 border border-slate-200 outline-none rounded-xl text-xs focus:border-slate-800 bg-white text-slate-700 font-sans"
                        id="inbox-search-input"
                      />
                    </div>
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-sans" id="inbox-empty">
                    <Users size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold">صندوق الاستمارات فارغ!</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto" id="inbox-table-card">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold select-none">
                            <th className="p-3 text-center">المستندات (4 صور)</th>
                            <th className="p-3">الاسم بالكامل</th>
                            <th className="p-3">رقم الهاتف</th>
                            <th className="p-3">العمر وتاريخ الميلاد</th>
                            <th className="p-3 text-center font-sans uppercase">Action Grid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                          {currentUsers.map((u) => {
                            const availablePhotosCount = [u.personalPhoto || u.idPhoto, u.nationalIdFront, u.nationalIdBack, u.birthCertificate].filter(Boolean).length;
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50 transition">
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => setFocusedUser(u)}
                                    className="px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition font-bold"
                                  >
                                    معاينة الصور ({availablePhotosCount}/4)
                                  </button>
                                </td>
                                <td className="p-3 font-bold text-slate-900">
                                  {u.fullName} {u.lastName}
                                  <p className="text-[9px] text-slate-400 font-normal">اسم الأب: {u.fatherName}</p>
                                </td>
                                <td className="p-3 font-mono text-left select-all" style={{ direction: 'ltr' }}>{u.phone}</td>
                                <td className="p-3 text-slate-600">
                                  {u.age} سنة <span className="text-[9px] text-slate-400 block">{u.dob}</span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setFocusedUser(u)}
                                      className="p-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                                      title="عرض المستند والخيارات"
                                    >
                                      <Eye size={12} />
                                    </button>

                                    {/* Action dropdown button */}
                                    <div className="relative">
                                      <button
                                        onClick={() => setActiveExportDropdown(activeExportDropdown === u.id ? null : u.id)}
                                        className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1 font-bold"
                                        title="خيارات تصدير الاستمارة"
                                      >
                                        <FileDown size={12} />
                                        <span className="text-[10px] font-sans">تصدير</span>
                                      </button>
                                      
                                      {activeExportDropdown === u.id && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-30" 
                                            onClick={() => setActiveExportDropdown(null)} 
                                          />
                                          <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-40 text-right font-sans divide-y divide-slate-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                            <button
                                              onClick={() => {
                                                printUserProfile(u, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>تصدير كـ PDF رسمي (طباعة)</span>
                                              <Printer size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                exportProfileAsHTML2Canvas(u, themeColors, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-blue-700 hover:bg-blue-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>تحميل كـ صورة PNG (عالي الدقة)</span>
                                              <FileDown size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                exportProfileAsPNG(u, themeColors, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>بطاقة نيون كلاسيك (Canvas)</span>
                                              <Palette size={11} />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => setEditingUser(u)}
                                      className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                                      title="تعديل يدوي للبيانات"
                                    >
                                      <Edit2 size={12} />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteUser(u.id, u.fullName)}
                                      className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                                      title="حذف الاستمارة"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3" id="inbox-pagination">
                      <div className="text-[10px] text-slate-500 font-sans">
                        عرض الصفحة {currentPage} من أصل {totalPages} (إجمالي {filteredUsers.length} استمارة)
                      </div>
                      <div className="flex items-center gap-1 select-none">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ====== TAB 2: LIVE DATABASE CONSOLE ====== */}
            {activeTab === 'database' && (() => {
              const dbFiltered = users.filter((u) => {
                const q = dbSearchQuery.toLowerCase().trim();
                const genderOk = dbGenderFilter === 'all' || u.gender === dbGenderFilter;
                if (!q) return genderOk;
                return genderOk && (
                  u.fullName.toLowerCase().includes(q) ||
                  u.fatherName.toLowerCase().includes(q) ||
                  u.lastName.toLowerCase().includes(q) ||
                  u.phone.includes(q) ||
                  u.streetAddress.toLowerCase().includes(q) ||
                  u.schoolOrUniversity?.toLowerCase().includes(q) ||
                  u.nationality?.toLowerCase().includes(q) ||
                  (u.equipmentUsed || '').toLowerCase().includes(q)
                );
              });
              const dbTotalPages = Math.max(1, Math.ceil(dbFiltered.length / dbItemsPerPage));
              const dbSlice = dbFiltered.slice((dbCurrentPage - 1) * dbItemsPerPage, dbCurrentPage * dbItemsPerPage);
              const maleCount = users.filter(u => u.gender === 'Male').length;
              const femaleCount = users.filter(u => u.gender === 'Female').length;
              const withPhotos = users.filter(u => u.personalPhoto || u.idPhoto).length;
              const today = new Date().toDateString();
              const todayCount = users.filter(u => u.createdAt && new Date(u.createdAt).toDateString() === today).length;

              return (
                <div className="space-y-4 text-right" id="tab-database-workspace">
                  
                  {/* Console Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                        </span>
                        قاعدة البيانات الحية — LIVE DATABASE CONSOLE
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {appConfig.localizationOverrides?.['publicTableTitle'] || 'بيانات التسجيل والسجلات النشطة'} • تحديث فوري • مُصدِّر متعدد الصيغ
                      </p>
                    </div>
                  </div>

                  {/* Stats Counter Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="db-stats-grid">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-slate-800">{users.length}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">إجمالي المسجلين</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-blue-700">{maleCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">ذكور / Males</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-pink-600">{femaleCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">إناث / Females</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-teal-600">{todayCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">تسجيل اليوم</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-3 text-right sm:col-span-2">
                      <p className="text-2xl font-black text-amber-600">{withPhotos}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">يمتلكون صور مرفقة</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-right sm:col-span-2">
                      <p className="text-2xl font-black text-slate-500">{users.length - withPhotos}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">بدون صور</p>
                    </div>
                  </div>

                  {/* Export Toolbar */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3" id="db-export-toolbar">
                    <p className="text-[10px] font-black text-slate-500 mb-2">تصدير قاعدة البيانات الكاملة — All Formats Export:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => exportToCSV(users)}
                        disabled={users.length === 0}
                        className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-emerald-100 transition cursor-pointer flex items-center gap-1.5"
                        id="db-export-csv-btn"
                        title="تصدير كـ CSV"
                      >
                        <FileDown size={12} />
                        CSV
                      </button>
                      <button
                        onClick={() => exportToExcel(users)}
                        disabled={users.length === 0}
                        className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-indigo-100 transition cursor-pointer flex items-center gap-1.5"
                        id="db-export-excel-btn"
                        title="تصدير كـ Excel"
                      >
                        <FileDown size={12} />
                        Excel
                      </button>
                      <button
                        onClick={() => exportToWord(users)}
                        disabled={users.length === 0}
                        className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-blue-100 transition cursor-pointer flex items-center gap-1.5"
                        id="db-export-word-btn"
                        title="تصدير كـ Word"
                      >
                        <FileDown size={12} />
                        Word
                      </button>
                      <button
                        onClick={() => exportToImage(users, appConfig.websiteTitle)}
                        disabled={users.length === 0}
                        className="px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-teal-100 transition cursor-pointer flex items-center gap-1.5"
                        id="db-export-image-btn"
                        title="تصدير كـ صورة HTML قابلة للطباعة"
                      >
                        <Printer size={12} />
                        PDF / صورة
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2">CSV: جدول نصي خام • Excel: جدول محسوب منسق • Word: ملف أرشيفي رسمي • PDF/صورة: تقرير مرئي قابل للطباعة</p>
                  </div>

                  {/* Search & Filter Row */}
                  <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-3" id="db-search-filter-row">
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute right-3 top-2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="بحث سريع بالاسم، الهاتف، العنوان، المدرسة..."
                        value={dbSearchQuery}
                        onChange={(e) => { setDbSearchQuery(e.target.value); setDbCurrentPage(1); }}
                        className="w-full pr-9 pl-3 py-1.5 border border-slate-200 outline-none rounded-xl text-xs focus:border-teal-500 bg-slate-50 text-slate-700 font-sans"
                        id="db-search-input"
                      />
                    </div>
                    <select
                      value={dbGenderFilter}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setDbGenderFilter(e.target.value as 'all' | 'Male' | 'Female'); setDbCurrentPage(1); }}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 text-slate-700"
                    >
                      <option value="all">كل الجنسين</option>
                      <option value="Male">ذكور فقط</option>
                      <option value="Female">إناث فقط</option>
                    </select>
                    {(dbSearchQuery || dbGenderFilter !== 'all') && (
                      <button
                        onClick={() => { setDbSearchQuery(''); setDbGenderFilter('all'); setDbCurrentPage(1); }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <X size={12} /> مسح الفلترة
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 mr-auto">نتائج: {dbFiltered.length} سجل</span>
                  </div>

                  {/* Full Data Table */}
                  {dbFiltered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-sans" id="db-empty">
                      <Users size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold">لا توجد سجلات مطابقة!</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto" id="db-table-card">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-gradient-to-l from-teal-900 to-slate-900 text-white font-bold select-none">
                              <th className="p-3 text-center">#</th>
                              <th className="p-3">الاسم الكامل</th>
                              <th className="p-3">اسم الأب</th>
                              <th className="p-3">رقم الهاتف</th>
                              <th className="p-3">العمر</th>
                              <th className="p-3">الجنس</th>
                              <th className="p-3">المدرسة/الجامعة</th>
                              <th className="p-3">العنوان</th>
                              <th className="p-3">الجنسية</th>
                              <th className="p-3">العُدَد</th>
                              <th className="p-3">الصور</th>
                              <th className="p-3">تاريخ التسجيل</th>
                              <th className="p-3 text-center">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                            {dbSlice.map((u, i) => {
                              const photosCount = [u.personalPhoto || u.idPhoto, u.nationalIdFront, u.nationalIdBack, u.birthCertificate].filter(Boolean).length;
                              const rowNum = (dbCurrentPage - 1) * dbItemsPerPage + i + 1;
                              return (
                                <tr key={u.id} className="hover:bg-teal-50/30 transition">
                                  <td className="p-3 text-center text-slate-400 font-mono text-[10px]">{rowNum}</td>
                                  <td className="p-3">
                                    <p className="font-bold text-slate-900">{u.fullName} {u.lastName}</p>
                                    <p className="text-[9px] text-slate-400 font-mono select-all">{u.id}</p>
                                  </td>
                                  <td className="p-3 text-slate-600">{u.fatherName}</td>
                                  <td className="p-3 font-mono text-left select-all" style={{ direction: 'ltr' }}>{u.phone}</td>
                                  <td className="p-3 text-center">{u.age}</td>
                                  <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${u.gender === 'Male' ? 'bg-blue-50 text-blue-700' : u.gender === 'Female' ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : '-'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-500 max-w-[120px] truncate">{u.schoolOrUniversity || '-'}</td>
                                  <td className="p-3 text-slate-500 max-w-[140px] truncate">{u.streetAddress}</td>
                                  <td className="p-3 text-slate-500">{u.nationality || '-'}</td>
                                  <td className="p-3 text-slate-500">{u.equipmentUsed ? <span className="font-bold text-teal-700">{u.equipmentUsed} ({u.equipmentQuantity ?? '-'})</span> : '-'}</td>
                                  <td className="p-3 text-center">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${photosCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                      {photosCount}/4
                                    </span>
                                  </td>
                                  <td className="p-3 text-[10px] text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => setFocusedUser(u)}
                                        className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                                        title="عرض التفاصيل"
                                      >
                                        <Eye size={11} />
                                      </button>
                                      <button
                                        onClick={() => setEditingUser(u)}
                                        className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                                        title="تعديل"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(u.id, u.fullName)}
                                        className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                                        title="حذف"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between border-t border-slate-200 pt-3" id="db-pagination">
                        <div className="text-[10px] text-slate-500 font-sans">
                          صفحة {dbCurrentPage} من {dbTotalPages} • إجمالي {dbFiltered.length} سجل (من {users.length})
                        </div>
                        <div className="flex items-center gap-1 select-none">
                          <button
                            onClick={() => setDbCurrentPage(1)}
                            disabled={dbCurrentPage === 1}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[10px] font-bold"
                          >
                            أول
                          </button>
                          <button
                            onClick={() => setDbCurrentPage(p => Math.max(1, p - 1))}
                            disabled={dbCurrentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <span className="px-2 py-1 text-[10px] font-bold text-slate-600">{dbCurrentPage}</span>
                          <button
                            onClick={() => setDbCurrentPage(p => Math.min(dbTotalPages, p + 1))}
                            disabled={dbCurrentPage === dbTotalPages}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={() => setDbCurrentPage(dbTotalPages)}
                            disabled={dbCurrentPage === dbTotalPages}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[10px] font-bold"
                          >
                            آخر
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ====== TAB 3 (was 2): SCHEMA FORM BUILDERS (CMS) ====== */}
            {activeTab === 'schema' && (
              <div className="space-y-6 text-right" id="tab-schema-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800">مصمم ومعدل بنية حقول الاستمارة (Schema Builder)</h3>
                  <p className="text-[10px] text-slate-400">يمكنك هنا حقن حقول جديدة في استمارة التسجيل ديناميكياً بدون المساس بالكود!</p>

                  {schemaMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{schemaMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right" id="schema-inputs-grid">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم المتغير في قاعدة البيانات (بالإنكليزية فريد)</label>
                      <input
                        type="text"
                        placeholder="مثال: city_select"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الحقل بالعربية (يظهر للجمهور)</label>
                      <input
                        type="text"
                        placeholder="مثال: اسم المحافظة"
                        value={newFieldLabelAr}
                        onChange={(e) => setNewFieldLabelAr(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الحقل بالإنكليزية</label>
                      <input
                        type="text"
                        placeholder="مثال: Governorate"
                        value={newFieldLabelEn}
                        onChange={(e) => setNewFieldLabelEn(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">نوع الإدخال</label>
                      <select
                        value={newFieldType}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldType(e.target.value as 'text' | 'number' | 'select' | 'tel' | 'date')}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 bg-white"
                      >
                        <option value="text">نص عادي / Text</option>
                        <option value="number">رقم عددي / Number</option>
                        <option value="tel">رقم هاتف / Tel</option>
                        <option value="date">تاريخ رزنامة / Date</option>
                        <option value="select">قائمة منسدلة / Dropdown Select</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">النص المساعد (Placeholder)</label>
                      <input
                        type="text"
                        placeholder="أدخل المحافظة..."
                        value={newFieldPlaceholderAr}
                        onChange={(e) => setNewFieldPlaceholderAr(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">خيارات القائمة المنسدلة (مفصولة بفاصلة ,)</label>
                      <input
                        type="text"
                        placeholder="القاهرة, الجيزة, المنصورة, الإسكندرية"
                        value={newFieldOptionsAr}
                        onChange={(e) => setNewFieldOptionsAr(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                        disabled={newFieldType !== 'select'}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 pt-4">
                      <input
                        type="checkbox"
                        id="field_required"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="w-4 h-4 cursor-pointer text-slate-900 border-slate-300"
                      />
                      <label htmlFor="field_required" className="text-xs font-bold text-slate-700 cursor-pointer select-none">حقل إلزامي التعبئة (Required)</label>
                    </div>
                  </div>

                  <button
                    onClick={handleAddSchemaField}
                    className="py-2 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: themeColors.primary }}
                    id="add-custom-field-btn"
                  >
                    <PlusCircle size={14} />
                    حقن وتضمين الحقل في الاستمارة فورياً
                  </button>
                </div>

                {/* Listing Active Schema Fields */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-slate-700">قائمة حقول الاستمارة (الافتراضية والمخصصة):</h4>
                  {fieldsSchemaList.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">لا توجد حقول حالياً بالاستمارة.</p>
                  ) : (
                    <div className="space-y-4">
                      {fieldsSchemaList.map((f, i) => (
                        <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col gap-3">
                          {/* Field Identifier Row */}
                          <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[10px]">{f.name}</span>
                              <span className="text-slate-400">|</span>
                              <span className="text-slate-500 text-[10px]">نوع الحقل: {f.type}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateSchemaFieldInline(f.id, { isEnabled: !f.isEnabled })}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${f.isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'}`}
                              >
                                {f.isEnabled ? '● نشط بالاستمارة' : '○ معطل بالاستمارة'}
                              </button>
                              <button
                                onClick={() => deleteSchemaField(f.id)}
                                className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                title="حذف الحقل"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Inline Edits Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">اسم الحقل بالعربية</span>
                              <input 
                                type="text" 
                                value={f.labelAr} 
                                onChange={(e) => handleUpdateSchemaFieldInline(f.id, { labelAr: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs w-full bg-white text-slate-800"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">اسم الحقل بالإنكليزية</span>
                              <input 
                                type="text" 
                                value={f.labelEn} 
                                onChange={(e) => handleUpdateSchemaFieldInline(f.id, { labelEn: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-mono text-left w-full bg-white text-slate-800"
                                style={{ direction: 'ltr' }}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">قاعدة التحقق (Validation)</span>
                              <select
                                value={f.required ? "true" : "false"}
                                onChange={(e) => handleUpdateSchemaFieldInline(f.id, { required: e.target.value === "true" })}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 w-full"
                              >
                                <option value="true">إجباري / Required</option>
                                <option value="false">اختياري / Optional</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====== TAB 3: LOCALIZATION OVERWRITES (CMS WORDS) ====== */}
            {activeTab === 'localization' && (
              <div className="space-y-6 text-right" id="tab-localization-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-base font-black text-slate-800">توطين واستبدال نصوص ومصطلحات الموقع (Localization CMS)</h3>
                    <Languages className="text-slate-400 w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-slate-400">تتيح لك هذه المنصة إعادة كتابة وتغيير أي عبارة أو ترويسة تظهر للعموم على الموقع، بمرونة مطلقة وبدون تعديل سطر برمجي واحد!</p>

                  {locSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{locSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-3.5 text-right" id="localization-inputs-grid">
                    {localizationKeys.map((item) => (
                      <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-700 flex justify-between">
                          <span>{item.label}</span>
                          <span className="font-mono text-[9px] text-slate-400">Tags: {item.key}</span>
                        </label>
                        <textarea
                          rows={1}
                          value={localizationMap[item.key] !== undefined ? localizationMap[item.key] : item.defaultVal}
                          onChange={(e) => handleLocMapChange(item.key, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-slate-800 text-slate-800 font-sans"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveLocalizationOverrides}
                    className="py-2.5 px-5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md hover:bg-opacity-95"
                    style={{ backgroundColor: themeColors.primary }}
                    id="save-localization-overrides-btn"
                  >
                    <Save size={14} />
                    حفظ وتطبيق الكلمات الجديدة فورياً
                  </button>
                </div>
              </div>
            )}

            {/* ====== TAB 4: FLOATING PHONE/WHATSAPP MANAGEMENT ====== */}
            {activeTab === 'contacts' && (
              <div className="space-y-6 text-right" id="tab-contacts-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800">أرقام التواصل والرد السريع</h3>
                  <p className="text-[10px] text-slate-400">تحكم بقائمة الأرقام والمسؤولين الذين تظهر محادثاتهم للمسجلين والطلاب بالأسفل.</p>

                  {contactMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>{contactMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="contacts-add-form">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم المالك أو القسم</label>
                      <input
                        type="text"
                        placeholder="الأستاذ مصطفى / شؤون المسجلين"
                        value={newContactLabel}
                        onChange={(e) => setNewContactLabel(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">رقم الموبايل (الكود الدولي)</label>
                      <input
                        type="text"
                        placeholder="01091028501"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono bg-white text-slate-700"
                        style={{ direction: 'ltr' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">قناة التواصل</label>
                      <select
                        value={contactType}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setContactType(e.target.value as 'whatsapp' | 'call')}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 bg-white"
                      >
                        <option value="whatsapp">محادثة واتساب / WhatsApp</option>
                        <option value="call">اتصال هاتفي مباشر / Direct Call</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={addContactNumber}
                    className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-slate-950"
                  >
                    <Plus size={14} />
                    إدراج وحفظ الهاتف المساعد
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="contacts-tables-panels">
                  {/* Whatsapp list */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      أرقام الواتساب النشطة:
                    </h5>
                    {whatsappList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">لا توجد أرقام مخصصة (تعتمد الواجهة الرقم الرئيسي: 01091028501).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {whatsappList.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                            <div>
                              <p className="font-bold text-slate-700">{item.label}</p>
                              <p className="text-[10px] font-mono text-slate-400 select-all" style={{ direction: 'ltr' }}>{item.number}</p>
                            </div>
                            <button onClick={() => deleteContactNumber(item.id, 'whatsapp')} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calling list */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" style={{ backgroundColor: themeColors.primary }}></span>
                      أرقام الاتصال المباشر النشطة:
                    </h5>
                    {callList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">لا توجد أرقام مخصصة (تعتمد الواجهة الرقم الرئيسي: 01091028501).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {callList.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                            <div>
                              <p className="font-bold text-slate-700">{item.label}</p>
                              <p className="text-[10px] font-mono text-slate-400 select-all" style={{ direction: 'ltr' }}>{item.number}</p>
                            </div>
                            <button onClick={() => deleteContactNumber(item.id, 'call')} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Floating Buttons section */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 pt-5 mt-6 border-t-2 border-dashed border-slate-100" id="custom-floating-buttons-section">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                        <PlusCircle size={18} className="text-teal-600" />
                        إدارة أزرار التواصل العائمة والروابط الإضافية
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">أضف أي رابط أو منصة اجتماعية مخصصة (تليجرام، ماسنجر، موقعك الخاص) وتثبيته كزر طافٍ 3D.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم أو تسمية الزر (ملاحظة)</label>
                      <input
                        type="text"
                        placeholder="قناتنا على تليجرام"
                        value={newCustomLabel}
                        onChange={(e) => setNewCustomLabel(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-bold text-slate-500">رابط توجيه الزر (URL بالتفصيل)</label>
                      <input
                        type="url"
                        placeholder="https://t.me/your_channel"
                        value={newCustomUrl}
                        onChange={(e) => setNewCustomUrl(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 text-left font-mono"
                        style={{ direction: 'ltr' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500">شعار الأيقونة</label>
                      <select
                        value={newCustomIcon}
                        onChange={(e) => setNewCustomIcon(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-sans"
                      >
                        <option value="Send">طائرة ورقية تليجرام / Telegram (Send)</option>
                        <option value="MessageCircle">واتساب دردشة / WhatsApp</option>
                        <option value="Phone">سماعة اتصال هاتفى / Phone</option>
                        <option value="Globe">شعار ويب إنترنت / Globe</option>
                        <option value="Instagram">إنستجرام / Instagram</option>
                        <option value="Facebook">فيسبوك / Facebook</option>
                        <option value="Youtube">يوتيوب / Youtube</option>
                        <option value="Twitter">إكس جولد تويتر / Twitter (X)</option>
                        <option value="Info">أيقونة معلومات دائرية / Info</option>
                        <option value="Link">رابط دبوس ويب عام / Link</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 md:col-span-4 mt-1 border-t border-slate-200/50 pt-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={newCustomIsFloating}
                          onChange={(e) => setNewCustomIsFloating(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>تثبيته كزر طافٍ منفصل 3D على الصفحة الرئيسية فوراً</span>
                      </label>
                      
                      <div className="mr-auto flex gap-2">
                        {editingCustomId ? (
                          <>
                            <button
                              onClick={saveEditCustomButton}
                              className="py-1.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md bg-teal-600 hover:bg-teal-700"
                            >
                              <Save size={12} />
                              حفظ التعديل
                            </button>
                            <button
                              onClick={cancelEditCustomButton}
                              className="py-1.5 px-3 rounded-xl text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 bg-white hover:bg-slate-50"
                            >
                              <X size={12} />
                              إلغاء
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={addCustomFloatingButton}
                            className="py-1.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-slate-950 hover:opacity-90"
                          >
                            <Plus size={12} />
                            إدراج زر عائم مخصص
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-inner">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1 pb-1 border-b border-slate-50">
                      قائمة أزرار التواصل المخصصة النشطة:
                    </h5>
                    {customButtonsList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-4">لم تقم بإضافة أية أزرار تواصل أو روابط مخصصة بعد.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {customButtonsList.map((btn) => (
                          <div key={btn.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition text-xs">
                            <div className="space-y-1 overflow-hidden max-w-[70%]">
                              <p className="font-bold text-slate-700 flex items-center gap-1.5 truncate">
                                <span className="bg-white px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200 font-sans">{btn.icon}</span>
                                <span>{btn.label}</span>
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 truncate select-all" style={{ direction: 'ltr' }}>{btn.url}</p>
                              <div className="flex items-center gap-1 pt-0.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${btn.isFloating ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-slate-200/50 text-slate-500 border border-slate-200'}`}>
                                  {btn.isFloating ? 'زر طافٍ 3D نشط' : 'قائمة فرعية/مرتبط'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleCustomFloatingState(btn.id)}
                                className={`p-1.5 rounded-lg transition hover:bg-white text-xs font-bold ${btn.isFloating ? 'text-teal-600' : 'text-slate-400'}`}
                                title="تغيير حالة ظهور الزر كزر طافٍ"
                              >
                                {btn.isFloating ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                              <button
                                onClick={() => startEditCustomButton(btn)}
                                className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg transition hover:bg-white"
                                title="تعديل هذا الزر"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => deleteCustomFloatingButton(btn.id)}
                                className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg transition hover:bg-rose-50"
                                title="حذف هذا الزر"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 5: GRAPHIC CUSTOMIZATION (THEME) ====== */}
            {activeTab === 'theme' && (
              <div className="space-y-6 text-right" id="tab-theme-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                    <Palette size={16} />
                    مطور وتنسيق السمة اللونية للسيستم
                  </h3>
                  <p className="text-[10px] text-slate-400">اختر من اللوحات الجاهزة أو اصنع طابعاً خاصاً بدمج تدرجات وأقطار الأزرار.</p>

                  {themeMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>{themeMessage}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-500">القوالب والأمزجة المعدة مسبقاً (Presets):</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {colorPresets.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => applyPresetTheme(p)}
                          className="text-right p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition flex flex-col justify-between cursor-pointer"
                        >
                          <span className="text-xs font-bold text-slate-800 block mb-2">{p.name}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.primary }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.secondary }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.accent }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.bgGradientStart }}></span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">اللون الأساسي للعلامة (Primary Headers)</label>
                      <input
                        type="color"
                        value={themeColors.primary}
                        onChange={(e) => handleCustomColorInput('primary', e.target.value)}
                        className="w-full h-8 cursor-pointer rounded-xl border border-slate-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">اللون الثانوي للتفاصيل (Highlights)</label>
                      <input
                        type="color"
                        value={themeColors.secondary}
                        onChange={(e) => handleCustomColorInput('secondary', e.target.value)}
                        className="w-full h-8 cursor-pointer rounded-xl border border-slate-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون الأزرار وزر الحفظ والأنشطة (Accent Action)</label>
                      <input
                        type="color"
                        value={themeColors.accent}
                        onChange={(e) => handleCustomColorInput('accent', e.target.value)}
                        className="w-full h-8 cursor-pointer rounded-xl border border-slate-200"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون تدرج فريم الشاشة البادئ (Bg Gradient Start)</label>
                      <input
                        type="color"
                        value={themeColors.bgGradientStart}
                        onChange={(e) => handleCustomColorInput('bgGradientStart', e.target.value)}
                        className="w-full h-8 cursor-pointer rounded-xl border border-slate-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون تدرج فريم الشاشة النهائي (Bg Gradient End)</label>
                      <input
                        type="color"
                        value={themeColors.bgGradientEnd}
                        onChange={(e) => handleCustomColorInput('bgGradientEnd', e.target.value)}
                        className="w-full h-8 cursor-pointer rounded-xl border border-slate-200"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">مدى استدارة حواف القوالب والأزرار (Roundness)</label>
                      <select
                        value={themeColors.borderRadius || 'rounded-xl'}
                        onChange={(e) => handleCustomColorInput('borderRadius', e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700"
                      >
                        <option value="rounded-none">مربع حاد / Rounded None</option>
                        <option value="rounded-md">استدارة عادية / Rounded Md</option>
                        <option value="rounded-xl">شبه استدارة دائرية / Rounded Xl</option>
                        <option value="rounded-2xl">منحنيات ممتازة / Rounded 2Xl</option>
                        <option value="rounded-3xl">شكل بيضاوي فظ / Rounded 3Xl</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 6: GITHUB PIPELINE (DATABASE BACKEND) ====== */}
            {activeTab === 'github' && (
              <div className="space-y-6 text-right" id="tab-github-workspace">
                <form onSubmit={handleSaveGithubConfig} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                      <Github size={16} />
                      إعدادات مزامنة الملفات وقاعدة البيانات بـ GitHub Storage API
                    </h3>
                    <input
                      type="checkbox"
                      id="gh_channel_enabled"
                      checked={ghEnabled}
                      onChange={(e) => setGhEnabled(e.target.checked)}
                      className="w-4 h-4 cursor-pointer text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">قم بربط هذا التطبيق السحابي بمستودع جيت هاب خاص بك لحفظ استمارات وبيانات المسجلين مع المرفقات ثانية بثانية بدون سيرفر خارجي.</p>

                  {ghMessage.text && (
                    <div className={`p-3 rounded-xl justify-start text-xs font-semibold flex items-center gap-2 ${ghMessage.type === 'error' ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-emerald-50 border border-emerald-100 text-emerald-800'}`}>
                      {ghMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{ghMessage.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-right" id="github-config-grid">
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500">رمز هويتك المعتمد (GitHub Personal Access Token - PAT)</label>
                      <input
                        type="password"
                        placeholder="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        value={ghToken}
                        onChange={(e) => setGhToken(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none font-mono text-left"
                        style={{ direction: 'ltr' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم حسابك / منظمتك (Repo Owner)</label>
                      <input
                        type="text"
                        placeholder="مثال: AhmedAli"
                        value={ghOwner}
                        onChange={(e) => setGhOwner(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono"
                        style={{ direction: 'ltr' }}
                        required={ghEnabled}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم مستودع الرفع (Repository Name)</label>
                      <input
                        type="text"
                        placeholder="مثال: custom-enroll-db"
                        value={ghRepo}
                        onChange={(e) => setGhRepo(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono"
                        style={{ direction: 'ltr' }}
                        required={ghEnabled}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الغصن أو الفرع (Branch)</label>
                      <input
                        type="text"
                        placeholder="main / master"
                        value={ghBranch}
                        onChange={(e) => setGhBranch(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono"
                        style={{ direction: 'ltr' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">مسمى ملف الطلاب النهائي (Users File)</label>
                      <input
                        type="text"
                        placeholder="data.json"
                        value={ghDataPath}
                        onChange={(e) => setGhDataPath(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono"
                        style={{ direction: 'ltr' }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">عنوان المنفذ الرئيسي للموقع (Custom Port / Website Title)</label>
                      <input
                        type="text"
                        placeholder="Group m"
                        value={websiteTitle}
                        onChange={(e) => setWebsiteTitle(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-sans"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1 sm:col-span-2 border-t border-slate-100 pt-3 mt-2">
                      <span className="text-xs font-black text-slate-800 mb-2">الشعار المخصص وهوية الشاشات (Custom Icon & RGB Glow Effects)</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-slate-500">رفع شعار الموقع والمقود (Favicon Logo Upload Slot)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  setLogoBase64(base64);
                                  // Trigger immediate update and sync
                                  const updatedConfig = {
                                    ...appConfig,
                                    logoBase64: base64
                                  };
                                  onUpdateConfig(updatedConfig);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 outline-none w-full"
                          />
                          <p className="text-[9px] text-slate-400">يدعم صيغ الصور PNG, JPG, JPEG, SVG. سيتم تدويرها ببعد ثلاثي وإكسابها تدرج RGB نيون مضيء ومبهر تلقائياً.</p>
                        </div>

                        <div className="flex flex-col justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">تفعيل تحريك اسم الموقع (Enable Dynamic Title Animation)</span>
                            <input
                              type="checkbox"
                              checked={enableTitleAnimation}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEnableTitleAnimation(checked);
                                // Trigger immediate update and sync
                                const updatedConfig = {
                                  ...appConfig,
                                  enableTitleAnimation: checked
                                };
                                onUpdateConfig(updatedConfig);
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </div>
                          <p className="text-[9px] text-slate-400">عند التفعيل، سيتم إكساب اسم الموقع ترويسة نيون متحركة ثلاثية الأبعاد (Futuristic Pulse Theme) لإبهار الزوار.</p>
                          
                          {logoBase64 && (
                            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                              <span className="text-[10px] text-slate-500">معاينة الشعار المرفوع حالياً:</span>
                              <div className="flex items-center gap-2">
                                <img src={logoBase64} alt="Preview Logo" className="w-8 h-8 object-contain rounded-lg border border-slate-200 animate-3d-spin-float animate-rgb-glow" referrerPolicy="no-referrer" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLogoBase64('');
                                    const updatedConfig = {
                                      ...appConfig,
                                      logoBase64: ''
                                    };
                                    onUpdateConfig(updatedConfig);
                                  }}
                                  className="text-[10px] text-rose-500 font-bold hover:underline"
                                >
                                  حذف ومسح الشعار
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2" id="github-actions">
                    <button
                      type="submit"
                      className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer hover:opacity-95"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      <Save size={13} />
                      حفظ إعدادات المستودع محلياً
                    </button>

                    <button
                      type="button"
                      onClick={triggerForceSync}
                      disabled={syncStatus === 'syncing' || !ghToken}
                      className="py-2.5 px-4 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-bold border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={13} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                      تزامن وصهر الكشوفات سحابياً بالكامل الآن (Reconcile)
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ====== TAB 7: ADMINISTRATIVE SECURITY ====== */}
            {activeTab === 'security' && (
              <div className="space-y-6 text-right" id="tab-security-workspace">
                <form onSubmit={handleSecurityPassUpdate} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                    <KeyRound size={16} />
                    حماية بوابات السيستم وتحديث الرمز الأمني للمسؤل
                  </h3>
                  <p className="text-[10px] text-slate-400">تعديل الرمز السري المستخدم للاستيثاق ودخول لوحات التحكم عبر الأجهزة المشغلة للبرنامج.</p>

                  {secSuccess && (
                     <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                       <CheckCircle2 size={13} />
                       <span>{secSuccess}</span>
                     </div>
                  )}

                  {secError && (
                     <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                       <AlertCircle size={13} />
                       <span>{secError}</span>
                     </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="security-inputs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">كلمة المرور الجديدة</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={securityPassword}
                        onChange={(e) => setSecurityPassword(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono bg-white text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono bg-white text-slate-700"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer hover:scale-[1.01]"
                    style={{ backgroundColor: themeColors.primary }}
                    id="save-security-btn"
                  >
                    <Save size={13} />
                    تحديث الرمز السري لبوابة الإشراف آمنياً
                  </button>
                </form>
              </div>
            )}
            
          </main>
        </div>
      </div>

      {/* --- INLINE DETAIL SELECTION MODAL WITH 4 PHOTO GRID OVERLAYS --- */}
      {focusedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" id="applicant-modal">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 text-right flex flex-col max-h-[90vh]">
            <header className="px-5 py-3 text-white flex items-center justify-between select-none" style={{ backgroundColor: themeColors.primary }}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => printUserProfile(focusedUser, appConfig.websiteTitle)}
                  className="flex items-center gap-1 cursor-pointer bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10 transition"
                >
                  <Printer size={12} />
                  <span>تصدير PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportProfileAsHTML2Canvas(focusedUser, themeColors, appConfig.websiteTitle)}
                  className="flex items-center gap-1 cursor-pointer bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10 transition"
                >
                  <FileDown size={12} />
                  <span>تنزيل PNG (عالي الدقة)</span>
                </button>
              </div>
              
              <div className="text-center">
                <span className="text-xs font-black">صحيفة تسجيل: {focusedUser.fullName}</span>
                <span className="text-[9px] text-slate-300 block">ID: {focusedUser.id}</span>
              </div>

              <button onClick={() => setFocusedUser(null)} className="text-white hover:text-slate-100 cursor-pointer">
                <X size={15} />
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-5" dir="rtl">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-right">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">الاسم الكامل</p>
                  <p className="font-extrabold text-slate-800">{focusedUser.fullName} {focusedUser.lastName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">اسم الأب</p>
                  <p className="font-extrabold text-slate-800">{focusedUser.fatherName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">رقم الهاتف</p>
                  <p className="font-mono text-slate-800 tracking-wide font-bold" style={{ direction: 'ltr' }}>{focusedUser.phone}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">تاريخ الميلاد</p>
                  <p className="font-bold text-slate-800">{focusedUser.dob} ({focusedUser.age} سنة)</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">المدرسة/الجامعة</p>
                  <p className="font-bold text-slate-800">{focusedUser.schoolOrUniversity || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">الحالة والنوع</p>
                  <p className="font-bold text-slate-800">{focusedUser.gender === 'Male' ? 'ذكر' : 'أنثى'} / {focusedUser.maritalStatus}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-[9px] text-slate-400 font-bold">العنوان بالكامل</p>
                  <p className="font-bold text-slate-800">{focusedUser.streetAddress}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">اسم العُدَد المستخدمة (EQUIPMENT USED)</p>
                  <p className="font-bold text-teal-750 font-semibold text-slate-800">{focusedUser.equipmentUsed || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">عددها كام (QUANTITY)</p>
                  <p className="font-bold text-teal-750 font-semibold text-slate-800">{focusedUser.equipmentQuantity !== undefined ? focusedUser.equipmentQuantity : '-'}</p>
                </div>

                {focusedUser.customFields && Object.entries(focusedUser.customFields).map(([k, v]) => (
                  <div key={k} className="col-span-1 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <p className="text-[9px] text-amber-700 font-black">{k}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{v || '-'}</p>
                  </div>
                ))}
              </div>

              {/* 4 Photos Grid Preview inside details modal */}
              <div>
                <h4 className="text-xs font-black text-slate-700 mb-2.5">المستندات والوثائق المرفقة (اضغط للتكبير):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  
                  {/* Slot 1 */}
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">1. صورة شخصية</p>
                    {focusedUser.personalPhoto || focusedUser.idPhoto ? (
                      <img
                        src={focusedUser.personalPhoto || focusedUser.idPhoto}
                        alt="Personal Photo"
                        onClick={() => setLightboxPhoto(focusedUser.personalPhoto || focusedUser.idPhoto)}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>

                  {/* Slot 2 */}
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">2. بطاقة (وجه)</p>
                    {focusedUser.nationalIdFront ? (
                      <img
                        src={focusedUser.nationalIdFront}
                        alt="National ID Front"
                        onClick={() => setLightboxPhoto(focusedUser.nationalIdFront!)}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>

                  {/* Slot 3 */}
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">3. بطاقة (ظهر)</p>
                    {focusedUser.nationalIdBack ? (
                      <img
                        src={focusedUser.nationalIdBack}
                        alt="National ID Back"
                        onClick={() => setLightboxPhoto(focusedUser.nationalIdBack!)}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>

                  {/* Slot 4 */}
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">4. شهادة ميلاد</p>
                    {focusedUser.birthCertificate ? (
                      <img
                        src={focusedUser.birthCertificate}
                        alt="Birth Certificate"
                        onClick={() => setLightboxPhoto(focusedUser.birthCertificate!)}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            <footer className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setFocusedUser(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                إغلاق الكشف
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* --- INLINE EDIT USER MODAL WITH TEXT OVERWRITE FIELDS --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" id="editing-modal">
          <form onSubmit={handleUpdateUserValue} className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 text-right flex flex-col max-h-[88vh]" id="editing-form">
            <header className="px-5 py-3 text-white flex items-center justify-between bg-amber-600">
              <span className="text-xs font-black">تحرير وتصحيح بيانات: {editingUser.fullName}</span>
              <button type="button" onClick={() => setEditingUser(null)} className="text-white hover:text-slate-100 cursor-pointer">
                <X size={15} />
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-3 text-xs" dir="rtl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="editing-form-grid">
                
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">الاسم الأول والوسطى</label>
                  <input
                    type="text"
                    value={editingUser.fullName}
                    onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">اسم الأب</label>
                  <input
                    type="text"
                    value={editingUser.fatherName}
                    onChange={(e) => setEditingUser({ ...editingUser, fatherName: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">اسم العائلة</label>
                  <input
                    type="text"
                    value={editingUser.lastName}
                    onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editingUser.phone}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none text-left font-mono bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">العمر</label>
                  <input
                    type="number"
                    value={editingUser.age}
                    onChange={(e) => setEditingUser({ ...editingUser, age: parseInt(e.target.value) || 0 })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={editingUser.dob}
                    onChange={(e) => setEditingUser({ ...editingUser, dob: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white text-right"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">المدرسة أو الجامعة</label>
                  <input
                    type="text"
                    value={editingUser.schoolOrUniversity}
                    onChange={(e) => setEditingUser({ ...editingUser, schoolOrUniversity: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    value={editingUser.streetAddress}
                    onChange={(e) => setEditingUser({ ...editingUser, streetAddress: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">اسم العُدَد المستخدمة (EQUIPMENT USED)</label>
                  <input
                    type="text"
                    value={editingUser.equipmentUsed || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, equipmentUsed: e.target.value })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">عددها كام (QUANTITY)</label>
                  <input
                    type="number"
                    value={editingUser.equipmentQuantity !== undefined ? editingUser.equipmentQuantity : ''}
                    onChange={(e) => setEditingUser({ ...editingUser, equipmentQuantity: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white"
                  />
                </div>

              </div>
            </div>

            <footer className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 bg-white font-bold cursor-pointer"
              >
                إلغاء التعديل
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-white font-bold bg-amber-600 hover:bg-amber-700 hover:opacity-95 shadow-md cursor-pointer"
              >
                تطبيق وحفظ التعديلات رياديـاً
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* --- IMMERSIVE SINGLE LIGHTBOX EXPANSION FOR PHOTOMETRIC CHECKS --- */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-4 cursor-zoom-out select-none animate-in fade-in min-h-screen" 
          onClick={() => setLightboxPhoto(null)}
          id="lightbox-container"
        >
          <button 
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition"
            onClick={() => setLightboxPhoto(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt="Expanded certified file preview zoom"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
          />
          <p className="text-slate-400 font-bold font-sans text-xs mt-3 select-all">Base64 Certified Stream Active • Click anywhere to exit zoom</p>
        </div>
      )}

    </div>
  );
}
