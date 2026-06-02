import { useState, useRef, useEffect } from 'react';
import { 
  Phone, MessageCircle, Send, Globe, Instagram, Facebook, Info, Link, Youtube, Twitter 
} from 'lucide-react';
import { ContactNumber, ThemeConfig, CustomFloatingButton } from '../types';

interface FloatingButtonsProps {
  whatsappNumbers: ContactNumber[];
  callNumbers: ContactNumber[];
  customFloatingButtons?: CustomFloatingButton[];
  theme: ThemeConfig;
}

export default function FloatingButtons({ 
  whatsappNumbers, 
  callNumbers, 
  customFloatingButtons = [], 
  theme 
}: FloatingButtonsProps) {
  const [showWhatsappMenu, setShowWhatsappMenu] = useState(false);
  const [showCallMenu, setShowCallMenu] = useState(false);

  const whatsappRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLDivElement>(null);

  // Close menus if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (whatsappRef.current && !whatsappRef.current.contains(event.target as Node)) {
        setShowWhatsappMenu(false);
      }
      if (callRef.current && !callRef.current.contains(event.target as Node)) {
        setShowCallMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWhatsappAction = (number: string) => {
    const formatted = number.replace(/\s+/g, '');
    let finalUrl = `https://wa.me/${formatted}`;
    
    if (formatted.startsWith('01')) {
      finalUrl = `https://wa.me/20${formatted}`;
    }
    
    window.open(finalUrl, '_blank');
    setShowWhatsappMenu(false);
  };

  const handleCallAction = (number: string) => {
    const formatted = number.replace(/\s+/g, '');
    window.location.href = `tel:${formatted}`;
    setShowCallMenu(false);
  };

  const handleCustomAction = (url: string) => {
    window.open(url, '_blank');
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Send':
        return <Send className="w-6 h-6 animate-pulse" />;
      case 'MessageCircle':
        return <MessageCircle className="w-6 h-6 animate-pulse" />;
      case 'Phone':
        return <Phone className="w-6 h-6 animate-pulse" />;
      case 'Globe':
        return <Globe className="w-6 h-6 animate-pulse" />;
      case 'Instagram':
        return <Instagram className="w-6 h-6 animate-pulse" />;
      case 'Facebook':
        return <Facebook className="w-6 h-6 animate-pulse" />;
      case 'Info':
        return <Info className="w-6 h-6 animate-pulse" />;
      case 'Youtube':
        return <Youtube className="w-6 h-6 animate-pulse" />;
      case 'Twitter':
        return <Twitter className="w-6 h-6 animate-pulse" />;
      case 'Link':
      default:
        return <Link className="w-6 h-6 animate-pulse" />;
    }
  };

  const activeWhatsapp = whatsappNumbers.length > 0 
    ? whatsappNumbers 
    : [{ id: 'default', label: 'الرئيسي', number: '01091028501' }];

  const activeCalls = callNumbers.length > 0 
    ? callNumbers 
    : [{ id: 'default', label: 'الرئيسي', number: '01091028501' }];

  return (
    <>
      {/* Left Side: Call Buttons Container */}
      <div 
        ref={callRef} 
        className="fixed bottom-6 left-6 z-50 flex flex-col items-center gap-3"
        id="floating-call-container"
      >
        {showCallMenu && activeCalls.length > 1 && (
          <div className="mb-1 flex flex-col gap-1.5 rounded-2xl bg-white p-2 shadow-2xl border border-slate-105 min-w-[200px] animate-in fade-in slide-in-from-bottom-5 duration-200 text-right" dir="rtl">
            <p className="px-2.5 py-1 text-xs font-bold text-slate-400 border-b border-slate-100">
              اتصال هاتفى مباشر:
            </p>
            {activeCalls.map((item) => (
              <button
                key={item.id}
                onClick={() => handleCallAction(item.number)}
                className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition duration-150 flex items-center justify-between gap-2"
                id={`call-select-${item.id}`}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-slate-500 text-[10px]">{item.number}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (activeCalls.length === 1) {
              handleCallAction(activeCalls[0].number);
            } else {
              setShowCallMenu(!showCallMenu);
              setShowWhatsappMenu(false);
            }
          }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer hover:shadow-xl animate-3d-spin-float animate-rgb-glow border-2"
          style={{ backgroundColor: theme.primary || '#1e293b' }}
          title="اتصال هاتفي"
          id="floating-call-btn"
        >
          <Phone className="w-6 h-6 animate-pulse" />
        </button>
      </div>

      {/* Right Side: Custom Floating Buttons & WhatsApp vertical stack */}
      <div 
        ref={whatsappRef} 
        className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3"
        id="floating-whatsapp-container"
      >
        {/* Standalone Custom Floating Buttons */}
        {customFloatingButtons.filter(btn => btn.isFloating).map((btn) => (
          <button
            key={btn.id}
            onClick={() => handleCustomAction(btn.url)}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer hover:shadow-xl animate-3d-spin-float animate-rgb-glow border-2 bg-slate-900"
            title={btn.label}
          >
            {renderIcon(btn.icon)}
          </button>
        ))}

        {showWhatsappMenu && activeWhatsapp.length > 1 && (
          <div className="mb-1 flex flex-col gap-1.5 rounded-2xl bg-white p-2 shadow-2xl border border-slate-105 min-w-[200px] animate-in fade-in slide-in-from-bottom-5 duration-200 text-right" dir="rtl">
            <p className="px-2.5 py-1 text-xs font-bold text-slate-400 border-b border-slate-100">
              تواصل عبر واتساب:
            </p>
            {activeWhatsapp.map((item) => (
              <button
                key={item.id}
                onClick={() => handleWhatsappAction(item.number)}
                className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition duration-150 flex items-center justify-between gap-2"
                id={`whatsapp-select-${item.id}`}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-slate-500 text-[10px]">{item.number}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (activeWhatsapp.length === 1) {
              handleWhatsappAction(activeWhatsapp[0].number);
            } else {
              setShowWhatsappMenu(!showWhatsappMenu);
              setShowCallMenu(false);
            }
          }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white bg-emerald-500 hover:bg-emerald-600 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer hover:shadow-xl animate-3d-spin-float animate-rgb-glow border-2"
          style={{ borderColor: theme.accent || '#10b981' }}
          title="تواصل واتساب"
          id="floating-whatsapp-btn"
        >
          <MessageCircle className="w-6 h-6 animate-pulse" />
        </button>
      </div>
    </>
  );
}
