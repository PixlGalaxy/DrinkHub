import { AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
  autoCloseDuration?: number;
}

export function Toast({ message, type, onClose, autoCloseDuration = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [autoCloseDuration]);

  if (!isVisible) return null;

  const bgColor = type === 'error' ? 'bg-red-500/20 border-red-500/40' : type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-blue-500/20 border-blue-500/40';
  const textColor = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-emerald-400' : 'text-blue-400';
  const iconColor = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-emerald-400' : 'text-blue-400';

  return (
    <div className={`fixed top-16 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60]
                    ${bgColor} border rounded-xl px-4 py-3 sm:px-5 sm:py-4
                    flex items-start gap-3 duration-300
                    ${isClosing ? 'animate-out fade-out slide-out-to-left' : 'animate-in fade-in slide-in-from-top'}`}>
      <AlertCircle size={18} className={`${iconColor} shrink-0 mt-0.5`} strokeWidth={2} />
      <p className={`${textColor} text-sm sm:text-base flex-1`}>
        {message}
      </p>
      <button
        onClick={handleClose}
        className={`${textColor} hover:opacity-70 transition-opacity shrink-0`}
      >
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
