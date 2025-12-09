'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';

export function ContactModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Listen for open event
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-contact-modal', handleOpen);
    return () => window.removeEventListener('open-contact-modal', handleOpen);
  }, []);

  useEffect(() => {
    // Pre-fill email if user is logged in
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !message) {
      setStatus({
        type: 'error',
        message: 'Please fill in all fields',
      });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const result = await apiClient.post('/api/contact', {
        email: email.trim(),
        message: message.trim(),
        userId: user?.uid || null,
        userName: user?.displayName || user?.email || null,
        timestamp: new Date().toISOString(),
      }) as any;

      if (result.success) {
        setStatus({
          type: 'success',
          message: 'Thank you! Your message has been sent successfully.',
        });
        setEmail('');
        setMessage('');

        // Close modal after 2 seconds
        setTimeout(() => {
          setIsOpen(false);
          setStatus(null);
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error.message || 'Failed to send message. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEmail('');
    setMessage('');
    setStatus(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-lg max-w-[500px] w-[90%] max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="m-0">Contact Us</h2>
          <button
            className="bg-transparent border-none text-2xl cursor-pointer p-0 w-[30px] h-[30px] flex items-center justify-center"
            onClick={handleClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-5">
          <form id="contact-us-form" onSubmit={handleSubmit}>
            <div className="mb-5">
              <label
                htmlFor="contact-email"
                className="block mb-1 font-semibold"
              >
                Email
              </label>
              <input
                type="email"
                id="contact-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full p-2.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="mb-5">
              <label
                htmlFor="contact-message"
                className="block mb-1 font-semibold"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Please enter your message here..."
                required
                className="w-full p-2.5 border border-gray-300 rounded text-sm resize-y"
              />
            </div>
            <div className="flex gap-2.5 justify-end">
              <Button
                type="button"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Sending...
                  </>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
            {status && (
              <div
                className={cn(
                  'mt-4 p-2.5 rounded',
                  status.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                )}
              >
                {status.message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
