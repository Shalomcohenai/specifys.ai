'use client';

import { useEffect, useState } from 'react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose?: () => void;
  duration?: number;
}

export function Notification({ message, type, onClose, duration = 6000 }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRemoving(true);
      setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          onClose();
        }
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };

  return (
    <div
      className={`notification notification-${type} ${isRemoving ? 'notification-removing' : ''}`}
    >
      <div
        className="notification-content"
      >
        <div
          className="notification-icon"
        >
          <i className={`fa ${icons[type]}`}></i>
        </div>
        <div
          className="notification-text"
        >
          <span
            className="notification-message"
          >
            {message}
          </span>
        </div>
        <button
          className="notification-close"
          onClick={() => {
            setIsRemoving(true);
            setTimeout(() => {
              setIsVisible(false);
              if (onClose) {
                onClose();
              }
            }, 300);
          }}
        >
          <i className="fa fa-times"></i>
        </button>
      </div>
    </div>
  );
}

/**
 * Notification hook/utility
 */
let notificationContainer: HTMLDivElement | null = null;

export function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  if (typeof window === 'undefined') return;

  // Create container if it doesn't exist
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 10000;';
    document.body.appendChild(notificationContainer);
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };

  notification.innerHTML = `
    <div class="notification-content flex items-center p-4 gap-3">
      <div class="notification-icon text-lg flex-shrink-0">
        <i class="fa ${icons[type]}"></i>
      </div>
      <div class="notification-text flex-1 leading-normal">
        <span class="notification-message font-medium">${message}</span>
      </div>
      <button class="notification-close bg-transparent border-none cursor-pointer p-1 rounded flex-shrink-0">
        <i class="fa fa-times"></i>
      </button>
    </div>
  `;

  notification.className = `fixed bottom-[150px] left-1/2 -translate-x-1/2 translate-y-[100px] p-0 rounded-xl z-[10001] font-sans text-sm max-w-[700px] w-[95%] animate-slideUpIn overflow-hidden pointer-events-auto`;

  // Add CSS for animations if not already added
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideUpIn {
        from {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUpOut {
        from {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        to {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
      }
      .notification-removing {
        animation: slideUpOut 0.3s ease forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // Add close handler
  const closeBtn = notification.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      notification.classList.add('notification-removing');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    });
  }

  // Add to container
  notificationContainer.appendChild(notification);

  // Auto remove after duration
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('notification-removing');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    }
  }, 6000);
}

