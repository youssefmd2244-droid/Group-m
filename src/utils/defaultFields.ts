import { FormFieldSchema } from '../types';

export function getDefaultFieldsSchema(): FormFieldSchema[] {
  return [
    { 
      id: '1', 
      name: 'fullName', 
      labelAr: 'الاسم الأول والوسطى', 
      labelEn: 'First Name', 
      type: 'text', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: أحمد محمد...' 
    },
    { 
      id: '2', 
      name: 'fatherName', 
      labelAr: 'اسم الأب', 
      labelEn: "Father's Name", 
      type: 'text', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: السيد حسن...' 
    },
    { 
      id: '3', 
      name: 'lastName', 
      labelAr: 'اسم العائلة / اللقب', 
      labelEn: 'Family Name', 
      type: 'text', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: الشربيني...' 
    },
    { 
      id: '4', 
      name: 'phone', 
      labelAr: 'رقم الهاتف', 
      labelEn: 'Phone Number', 
      type: 'tel', 
      required: true, 
      isEnabled: true, 
      placeholderAr: '010XXXXXXXX' 
    },
    { 
      id: '5', 
      name: 'age', 
      labelAr: 'العمر', 
      labelEn: 'Age', 
      type: 'number', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: 19' 
    },
    { 
      id: '6', 
      name: 'dob', 
      labelAr: 'تاريخ الميلاد', 
      labelEn: 'Date of Birth', 
      type: 'date', 
      required: true, 
      isEnabled: true 
    },
    { 
      id: '7', 
      name: 'streetAddress', 
      labelAr: 'العنوان بالتفصيل المعماري', 
      labelEn: 'Street Address', 
      type: 'text', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: حدائق الأهرام - البوابة الرابعة' 
    },
    { 
      id: '8', 
      name: 'schoolOrUniversity', 
      labelAr: 'المدرسة أو الجامعة', 
      labelEn: 'School or University', 
      type: 'text', 
      required: false, 
      isEnabled: true, 
      placeholderAr: 'مثال: جامعة المنصورة...' 
    },
    { 
      id: '9', 
      name: 'gender', 
      labelAr: 'الجنس', 
      labelEn: 'Gender', 
      type: 'select', 
      required: false, 
      isEnabled: true, 
      optionsAr: 'Male / ذكر, Female / أنثى' 
    },
    { 
      id: '10', 
      name: 'nationality', 
      labelAr: 'الجنسية', 
      labelEn: 'Nationality', 
      type: 'text', 
      required: true, 
      isEnabled: true, 
      placeholderAr: 'مثال: مصري / Egyptian' 
    },
    { 
      id: '11', 
      name: 'maritalStatus', 
      labelAr: 'الحالة الاجتماعية', 
      labelEn: 'Marital Status', 
      type: 'select', 
      required: true, 
      isEnabled: true, 
      optionsAr: 'أعزب / Single, متزوج / Married, أخرى / Other' 
    },
    { 
      id: '12', 
      name: 'equipmentUsed', 
      labelAr: 'اسم العُدَد المستخدمة', 
      labelEn: 'Equipment Used', 
      type: 'text', 
      required: false, 
      isEnabled: true, 
      placeholderAr: 'مثال: مفكات، مفتاح ربط...' 
    },
    { 
      id: '13', 
      name: 'equipmentQuantity', 
      labelAr: 'عددها كام', 
      labelEn: 'Quantity', 
      type: 'number', 
      required: false, 
      isEnabled: true, 
      placeholderAr: 'مثال: 3' 
    }
  ];
}
