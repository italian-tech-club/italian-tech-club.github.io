import { useEffect } from 'react';

const WhatsAppRedirect = () => {
  useEffect(() => {
    window.location.href = 'https://chat.whatsapp.com/CllWSRvWX49GbLT7dGlSTm?mode=gi_t';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">Redirecting to WhatsApp...</p>
      </div>
    </div>
  );
};

export default WhatsAppRedirect;
